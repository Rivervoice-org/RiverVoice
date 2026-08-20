use std::sync::{Arc, Mutex};

use bytes::BytesMut;
use rtc::media::Sample;
use rtc::media_stream::MediaStreamTrack;
use rtc::rtp_transceiver::rtp_sender::{
    RTCRtpCodec, RTCRtpCodecParameters, RTCRtpCodingParameters, RTCRtpEncodingParameters,
    RtpCodecKind,
};
use tokio::sync::mpsc::{self, Receiver, Sender};
use tokio::sync::oneshot;
use webrtc::data_channel::{DataChannel, DataChannelEvent};
use webrtc::media_stream::track_local::TrackLocal;
use webrtc::media_stream::track_local::static_sample::TrackLocalStaticSample;
use webrtc::media_stream::track_remote::{TrackRemote, TrackRemoteEvent};
use webrtc::peer_connection::{
    MediaEngine, PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler,
    RTCConfigurationBuilder, RTCIceGatheringState, RTCSessionDescription, Registry,
    register_default_interceptors,
};
use webrtc::runtime::default_runtime;

use crate::audio::opus::{OpusDecoder, OpusEncoder, SAMPLE_RATE};
use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;
use crate::transport::base::BaseTransport;

/// RTP payload type we assign Opus in our own SDP — arbitrary but fixed, since
/// we register the codec ourselves rather than negotiating dynamically.
const OPUS_PAYLOAD_TYPE: u8 = 120;

/// Per RFC 7587, Opus is always signaled at a 48000Hz clock rate and 2
/// channels in SDP regardless of the audio's actual encode/decode rate or
/// channel count — that's a wire-format convention, not what the codec
/// itself operates at (we run Opus at `SAMPLE_RATE`/mono, see `audio::opus`).
const OPUS_SDP_CLOCK_RATE: u32 = 48000;
const OPUS_SDP_CHANNELS: u16 = 2;

/// One 20ms frame at 16kHz mono, 16-bit PCM.
const FRAME_DURATION_MS: u64 = 20;
const FRAME_BYTES: usize = (SAMPLE_RATE as usize * FRAME_DURATION_MS as usize / 1000) * 2;

fn opus_codec() -> RTCRtpCodec {
    RTCRtpCodec {
        mime_type: "audio/opus".to_string(),
        clock_rate: OPUS_SDP_CLOCK_RATE,
        channels: OPUS_SDP_CHANNELS,
        sdp_fmtp_line: String::new(),
        rtcp_feedback: vec![],
    }
}

/// The WebRTC doorway: signaling (SDP offer/answer), the data-channel
/// read/write loop, and the Opus audio track in both directions.
/// Everything pipeline-facing lives in `BaseTransport`, same division of
/// labor as `WebSocketClient`.
///
/// Unlike the WebSocket path, connecting is two-phased: [`accept_offer`](Self::accept_offer)
/// does the signaling (synchronous with the HTTP request that carries
/// the SDP offer/answer) and returns as soon as an answer SDP exists;
/// the data channel itself opens afterward, off the HTTP request
/// entirely, once ICE connects — that is what [`run`](Self::run) waits
/// for, and it should be spawned onto its own task rather than awaited
/// inline in the HTTP handler.
///
/// No STUN/TURN server is configured — fine for same-machine/LAN dev,
/// where host candidates alone connect. A real (cross-network)
/// deployment needs at least a STUN server added to the `RTCConfiguration`
/// here.
///
/// Audio flows over a real Opus RTP track in both directions (inbound mic,
/// outbound TTS) rather than raw PCM on the data channel — the data channel
/// carries only transcripts (and any future control messages).
pub struct WebRtcClient<S: FrameSerializer<Message = bytes::Bytes>> {
    base: BaseTransport<S>,
    peer_connection: Box<dyn PeerConnection>,
    data_channel_rx: oneshot::Receiver<Arc<dyn DataChannel>>,
    /// Decoded mic audio (`RawAudioFrame`s), forwarded from the `on_track`
    /// handler's RTP-receive task into the pipeline.
    inbound_audio_rx: Receiver<Frame>,
    output_track: Arc<TrackLocalStaticSample>,
    output_ssrc: u32,
    opus_encoder: OpusEncoder,
    /// Accumulates PCM across `TtsAudio` frames (which arrive in
    /// provider-chosen chunk sizes, not 20ms-aligned) until a full Opus
    /// frame's worth is available.
    pcm_buffer: Vec<u8>,
}

/// Bridges `webrtc`'s callback-based peer connection events into the signals
/// `accept_offer`/`run` actually wait on: ICE gathering finishing, the data
/// channel the browser opens on this connection, and inbound RTP audio.
struct Handler {
    gather_complete_tx: Mutex<Option<oneshot::Sender<()>>>,
    data_channel_tx: Mutex<Option<oneshot::Sender<Arc<dyn DataChannel>>>>,
    inbound_audio_tx: Sender<Frame>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for Handler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete
            && let Some(tx) = self.gather_complete_tx.lock().unwrap().take()
        {
            let _ = tx.send(());
        }
    }

    async fn on_data_channel(&self, data_channel: Arc<dyn DataChannel>) {
        if let Some(tx) = self.data_channel_tx.lock().unwrap().take() {
            let _ = tx.send(data_channel);
        }
    }

    async fn on_track(&self, track: Arc<dyn TrackRemote>) {
        if track.kind().await != RtpCodecKind::Audio {
            return;
        }

        let tx = self.inbound_audio_tx.clone();
        tokio::spawn(async move {
            let mut decoder = match OpusDecoder::new() {
                Ok(decoder) => decoder,
                Err(e) => {
                    tracing::error!("webrtc: failed to init opus decoder: {e}");
                    return;
                }
            };

            while let Some(event) = track.poll().await {
                let TrackRemoteEvent::OnRtpPacket(packet) = event else {
                    continue;
                };
                let pcm = match decoder.decode(&packet.payload) {
                    Ok(pcm) => pcm,
                    Err(e) => {
                        tracing::warn!("webrtc: opus decode failed: {e}");
                        continue;
                    }
                };
                let num_frames = pcm.len() as u32 / 2;
                let frame = Frame::new(FrameKind::RawAudio(RawAudioFrame {
                    audio: pcm,
                    sample_rate: SAMPLE_RATE,
                    num_channels: 1,
                    num_frames,
                }));
                if tx.send(frame).await.is_err() {
                    break;
                }
            }
        });
    }
}

impl<S: FrameSerializer<Message = bytes::Bytes> + 'static> WebRtcClient<S> {
    /// Accepts a browser's SDP offer: builds a `PeerConnection`, registers the
    /// Opus audio codec and our outbound track, exchanges descriptions, waits
    /// for ICE gathering to finish (see the struct doc on why this stays
    /// non-trickle — a single request/response has no side channel to trickle
    /// candidates back on), and returns the answer SDP to send back over HTTP
    /// alongside a `WebRtcClient` whose `run` should be spawned once that
    /// response has gone out.
    pub async fn accept_offer(
        base: BaseTransport<S>,
        offer_sdp: String,
    ) -> anyhow::Result<(Self, String)> {
        let (gather_complete_tx, gather_complete_rx) = oneshot::channel();
        let (data_channel_tx, data_channel_rx) = oneshot::channel();
        let (inbound_audio_tx, inbound_audio_rx) = mpsc::channel(EVENT_CHANNEL_CAPACITY);
        let handler = Arc::new(Handler {
            gather_complete_tx: Mutex::new(Some(gather_complete_tx)),
            data_channel_tx: Mutex::new(Some(data_channel_tx)),
            inbound_audio_tx,
        });

        let mut media_engine = MediaEngine::default();
        let audio_codec = RTCRtpCodecParameters {
            rtp_codec: opus_codec(),
            payload_type: OPUS_PAYLOAD_TYPE,
        };
        media_engine.register_codec(audio_codec.clone(), RtpCodecKind::Audio)?;
        let registry = register_default_interceptors(Registry::new(), &mut media_engine)?;

        let runtime = default_runtime()
            .ok_or_else(|| anyhow::anyhow!("webrtc: no async runtime available"))?;

        let config = RTCConfigurationBuilder::new().build();

        let peer_connection = PeerConnectionBuilder::new()
            .with_configuration(config)
            .with_media_engine(media_engine)
            .with_interceptor_registry(registry)
            .with_handler(handler)
            .with_runtime(runtime)
            .with_udp_addrs(vec!["0.0.0.0:0".to_string()])
            .build()
            .await?;

        let output_ssrc: u32 = rand::random();
        let output_track = Arc::new(TrackLocalStaticSample::new(MediaStreamTrack::new(
            "ferry-stream".to_string(),
            "ferry-tts-audio".to_string(),
            "ferry TTS audio".to_string(),
            RtpCodecKind::Audio,
            vec![RTCRtpEncodingParameters {
                rtp_coding_parameters: RTCRtpCodingParameters {
                    ssrc: Some(output_ssrc),
                    ..Default::default()
                },
                codec: audio_codec.rtp_codec,
                ..Default::default()
            }],
        ))?);
        peer_connection
            .add_track(output_track.clone() as Arc<dyn TrackLocal>)
            .await?;

        let offer = RTCSessionDescription::offer(offer_sdp)?;
        peer_connection.set_remote_description(offer).await?;
        let answer = peer_connection.create_answer(None).await?;
        peer_connection.set_local_description(answer).await?;

        // Blocks until every ICE candidate is gathered and baked into
        // the local description read back below.
        let _ = gather_complete_rx.await;

        let answer_sdp = peer_connection
            .local_description()
            .await
            .ok_or_else(|| anyhow::anyhow!("webrtc: no local description after ICE gathering"))?
            .sdp;

        let opus_encoder = OpusEncoder::new().map_err(|e| anyhow::anyhow!("webrtc: {e}"))?;

        Ok((
            Self {
                base,
                peer_connection: Box::new(peer_connection),
                data_channel_rx,
                inbound_audio_rx,
                output_track,
                output_ssrc,
                opus_encoder,
                pcm_buffer: Vec::new(),
            },
            answer_sdp,
        ))
    }

    /// Encodes and sends as many complete 20ms Opus frames as `pcm_buffer`
    /// now holds, leaving any partial trailing frame buffered for next time.
    async fn flush_outbound_audio(&mut self) {
        let mut frames_sent = 0u32;
        while self.pcm_buffer.len() >= FRAME_BYTES {
            let chunk: Vec<u8> = self.pcm_buffer.drain(..FRAME_BYTES).collect();
            let samples: Vec<i16> = chunk
                .chunks_exact(2)
                .map(|b| i16::from_le_bytes([b[0], b[1]]))
                .collect();

            let opus_bytes = match self.opus_encoder.encode(&samples) {
                Ok(bytes) => bytes,
                Err(e) => {
                    tracing::warn!("webrtc: opus encode failed: {e}");
                    continue;
                }
            };
            let opus_len = opus_bytes.len();

            let sample = Sample {
                data: opus_bytes.into(),
                duration: std::time::Duration::from_millis(FRAME_DURATION_MS),
                ..Default::default()
            };
            match self
                .output_track
                .write_sample(self.output_ssrc, OPUS_PAYLOAD_TYPE, &sample, &[])
                .await
            {
                Ok(()) => {
                    frames_sent += 1;
                    tracing::debug!(
                        "webrtc: wrote opus frame #{frames_sent}, {opus_len} bytes, ssrc={}, payload_type={}",
                        self.output_ssrc,
                        OPUS_PAYLOAD_TYPE
                    );
                }
                Err(e) => {
                    tracing::warn!("webrtc: write_sample failed: {e}");
                }
            }
        }
    }

    /// Waits for the browser's data channel to actually open, then runs
    /// the same push/take loop as `WebSocketClient::on_connect` until
    /// either side closes or the pipeline is torn down — plus the Opus
    /// encode/decode plumbing for the audio track in both directions.
    pub async fn run(mut self) {
        let Ok(data_channel) = (&mut self.data_channel_rx).await else {
            tracing::warn!("webrtc: no data channel opened, dropping connection");
            let _ = self.peer_connection.close().await;
            return;
        };

        loop {
            tokio::select! {
                event = data_channel.poll() => {
                    match event {
                        Some(DataChannelEvent::OnMessage(msg)) => {
                            if msg.is_string {
                                tracing::warn!("webrtc: dropping unexpected text message");
                                continue;
                            }
                            if !self.base.push_wire_message(msg.data.freeze()).await {
                                break;
                            }
                        }
                        Some(DataChannelEvent::OnClose) | None => break,
                        Some(_) => {}
                    }
                }
                frame = self.base.next_frame() => {
                    let Some(frame) = frame else { break };
                    match frame.into_kind() {
                        FrameKind::TtsAudio(audio) => {
                            tracing::debug!(
                                "webrtc: got TtsAudio frame, {} bytes (sample_rate={}), buffer now {} bytes",
                                audio.audio.len(),
                                audio.sample_rate,
                                self.pcm_buffer.len() + audio.audio.len()
                            );
                            self.pcm_buffer.extend_from_slice(&audio.audio);
                            self.flush_outbound_audio().await;
                        }
                        other => {
                            if let Ok(msg) = self.base.serialize(Frame::new(other))
                                && data_channel.send(BytesMut::from(msg.as_ref())).await.is_err()
                            {
                                break;
                            }
                        }
                    }
                }
                frame = self.inbound_audio_rx.recv() => {
                    let Some(frame) = frame else { continue };
                    if !self.base.push_frame(frame).await {
                        break;
                    }
                }
            }
        }

        let _ = self.peer_connection.close().await;
    }
}

const EVENT_CHANNEL_CAPACITY: usize = 32;
