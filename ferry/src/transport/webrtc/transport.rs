use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use bytes::BytesMut;
use rtc::media::Sample;
use rtc::media_stream::MediaStreamTrack;
use rtc::rtp_transceiver::rtp_sender::{
    RTCRtpCodec, RTCRtpCodecParameters, RTCRtpCodingParameters, RTCRtpEncodingParameters,
    RtpCodecKind,
};
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
use crate::call::CallStatus;
use crate::codec::frame_serializer::FrameSerializer;
use crate::codec::transport::webrtc_dc::{CALL_ENDED_TAG, CALL_RINGING_TAG, PEER_CONNECTED_TAG};
use crate::frames::{Frame, FrameKind, RawAudioFrame};
use crate::transport::base::BaseTransport;

/// RTP payload type we assign Opus in our own SDP — arbitrary but fixed,
/// since we register the codec ourselves rather than negotiating
/// dynamically.
const OPUS_PAYLOAD_TYPE: u8 = 120;

/// Per RFC 7587, Opus is always signaled at a 48000Hz clock rate and 2
/// channels in SDP regardless of the audio's actual encode/decode rate or
/// channel count — that's a wire-format convention, not what the codec
/// itself operates at (we run Opus at `SAMPLE_RATE`/mono, see `audio::opus`).
const OPUS_SDP_CLOCK_RATE: u32 = 48000;
const OPUS_SDP_CHANNELS: u16 = 2;

/// One 20ms frame at 16kHz mono, 16-bit PCM — Opus only accepts fixed frame
/// durations (2.5/5/10/20/40/60ms); this is the size TTS chunks get grouped
/// into before encoding, since providers hand back audio in their own
/// chunk sizes, not 20ms-aligned ones.
const FRAME_DURATION_MS: u64 = 20;
const FRAME_BYTES: usize = (SAMPLE_RATE as usize * FRAME_DURATION_MS as usize / 1000) * 2;

/// The answerer must echo back whatever payload type number the offer used
/// for a matching codec (JSEP) — not necessarily `OPUS_PAYLOAD_TYPE`, which
/// is only the number we register the codec under locally. Reads the number
/// actually written into our own answer SDP so outgoing packets are tagged
/// with what the client was told to expect.
fn parse_negotiated_opus_payload_type(sdp: &str) -> Option<u8> {
    sdp.lines().find_map(|line| {
        let (pt, rest) = line.strip_prefix("a=rtpmap:")?.split_once(' ')?;
        rest.starts_with("opus/").then(|| pt.parse().ok())?
    })
}

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
/// Audio flows over a real Opus RTP track in both directions (inbound mic,
/// outbound TTS) rather than raw PCM on the data channel — the data channel
/// carries only transcripts, translations, and call-status control bytes.
/// The client's native WebRTC stack (e.g. `react-native-webrtc`'s NetEQ)
/// handles jitter buffering and steady playout on receipt; nothing here
/// paces the outgoing send.
pub struct WebRtcClient<S: FrameSerializer<Message = bytes::Bytes>> {
    base: BaseTransport<S>,
    peer_connection: Box<dyn PeerConnection>,
    data_channel_rx: oneshot::Receiver<Arc<dyn DataChannel>>,
    /// Decoded mic audio (`RawAudioFrame`s), forwarded from the `on_track`
    /// handler's RTP-receive task into the pipeline.
    inbound_audio_rx: tokio::sync::mpsc::Receiver<Frame>,
    output_track: Arc<TrackLocalStaticSample>,
    output_ssrc: u32,
    /// The Opus payload type actually negotiated in the answer SDP for this
    /// call — varies per client/call, not the fixed `OPUS_PAYLOAD_TYPE` we
    /// register our codec under locally. Sending with the wrong value means
    /// the client silently drops every audio packet as unrecognized.
    output_payload_type: u8,
    opus_encoder: OpusEncoder,
    /// Accumulates PCM across `TtsAudio` frames (which arrive in
    /// provider-chosen chunk sizes, not 20ms-aligned) until a full
    /// `FRAME_BYTES` chunk is available to encode and send. No pacing here
    /// — every full chunk currently buffered is encoded and written
    /// immediately, back to back.
    pcm_buffer: VecDeque<u8>,
    /// Running count across the whole call, purely for the debug log.
    frames_sent: u32,
    /// Fires when the call's `CallRegistry` entry transitions to `Ended` —
    /// Twilio reporting busy/no-answer/failed, or the Twilio leg hanging up
    /// — so this side hangs up too instead of sitting connected with no
    /// audio ever arriving. `None` for one-way/no-registry calls (e.g. the
    /// try-agent screen), which have no other leg to watch.
    status_rx: Option<tokio::sync::watch::Receiver<CallStatus>>,
}

struct Handler {
    gather_complete_tx: Mutex<Option<oneshot::Sender<()>>>,
    data_channel_tx: Mutex<Option<oneshot::Sender<Arc<dyn DataChannel>>>>,
    inbound_audio_tx: tokio::sync::mpsc::Sender<Frame>,
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
    pub async fn accept_offer(
        base: BaseTransport<S>,
        offer_sdp: String,
        status_rx: Option<tokio::sync::watch::Receiver<CallStatus>>,
    ) -> anyhow::Result<(Self, String)> {
        let (gather_complete_tx, gather_complete_rx) = oneshot::channel();
        let (data_channel_tx, data_channel_rx) = oneshot::channel();
        let (inbound_audio_tx, inbound_audio_rx) =
            tokio::sync::mpsc::channel(EVENT_CHANNEL_CAPACITY);

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

        let bind_ip = crate::config::get()
            .map_err(|e| anyhow::anyhow!("webrtc: {e}"))?
            .webrtc_bind_ip
            .clone();

        let peer_connection = PeerConnectionBuilder::new()
            .with_configuration(config)
            .with_media_engine(media_engine)
            .with_interceptor_registry(registry)
            .with_handler(handler)
            .with_runtime(runtime)
            .with_udp_addrs(vec![format!("{bind_ip}:0")])
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

        let _ = gather_complete_rx.await;

        let answer_sdp = peer_connection
            .local_description()
            .await
            .ok_or_else(|| anyhow::anyhow!("webrtc: no local description after ICE gathering"))?
            .sdp;

        let output_payload_type =
            parse_negotiated_opus_payload_type(&answer_sdp).unwrap_or(OPUS_PAYLOAD_TYPE);

        let opus_encoder = OpusEncoder::new().map_err(|e| anyhow::anyhow!("webrtc: {e}"))?;

        Ok((
            Self {
                base,
                peer_connection: Box::new(peer_connection),
                data_channel_rx,
                inbound_audio_rx,
                output_track,
                output_ssrc,
                output_payload_type,
                opus_encoder,
                pcm_buffer: VecDeque::new(),
                frames_sent: 0,
                status_rx,
            },
            answer_sdp,
        ))
    }

    /// Encodes and writes every complete `FRAME_BYTES` chunk currently
    /// buffered, immediately and back to back — no pacing/timer, this just
    /// groups PCM into the fixed frame size Opus requires.
    async fn flush_full_frames(&mut self) {
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
                .write_sample(self.output_ssrc, self.output_payload_type, &sample, &[])
                .await
            {
                Ok(()) => {
                    self.frames_sent += 1;
                    tracing::trace!(
                        "webrtc: wrote opus frame #{}, {opus_len} bytes, ssrc={}, payload_type={}",
                        self.frames_sent,
                        self.output_ssrc,
                        self.output_payload_type
                    );
                }
                Err(e) => {
                    tracing::warn!("webrtc: write_sample failed: {e}");
                }
            }
        }
    }

    pub async fn run(mut self) {
        let data_channel = tokio::select! {
            result = &mut self.data_channel_rx => {
                match result {
                    Ok(dc) => dc,
                    Err(_) => {
                        tracing::warn!("webrtc: no data channel opened, dropping connection");
                        let _ = self.peer_connection.close().await;
                        return;
                    }
                }
            }
            _ = async {
                let rx = self.status_rx.as_mut().expect("guarded by `if` below");
                loop {
                    if rx.changed().await.is_err() {
                        return;
                    }
                    if matches!(*rx.borrow(), CallStatus::Ended(_)) {
                        return;
                    }
                }
            }, if self.status_rx.is_some() => {
                tracing::info!(
                    "webrtc: call ended before data channel opened, waiting briefly to deliver hangup signal"
                );
                if let Ok(Ok(dc)) = tokio::time::timeout(
                    std::time::Duration::from_secs(3),
                    &mut self.data_channel_rx,
                )
                .await
                {
                    let _ = dc.send(BytesMut::from(&[CALL_ENDED_TAG][..])).await;
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                }
                let _ = self.peer_connection.close().await;
                return;
            }
        };

        loop {
            tokio::select! {
                changed = async {
                    self.status_rx.as_mut().unwrap().changed().await
                }, if self.status_rx.is_some() => {
                    if changed.is_err() {
                        break;
                    }
                    let status = *self.status_rx.as_ref().unwrap().borrow();
                    match status {
                        CallStatus::Ended(_) => {
                            tracing::info!("webrtc: call ended (other leg), hanging up");
                            let _ = data_channel
                                .send(BytesMut::from(&[CALL_ENDED_TAG][..]))
                                .await;
                            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                            break;
                        }
                        CallStatus::Connected => {
                            let msg = BytesMut::from(&[PEER_CONNECTED_TAG][..]);
                            if data_channel.send(msg).await.is_err() {
                                break;
                            }
                        }
                        CallStatus::Ringing => {
                            let msg = BytesMut::from(&[CALL_RINGING_TAG][..]);
                            if data_channel.send(msg).await.is_err() {
                                break;
                            }
                        }
                        CallStatus::Dialing => {}
                    }
                }
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
                            self.pcm_buffer.extend(audio.audio);
                            self.flush_full_frames().await;
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

        tracing::debug!(
            frames_sent = self.frames_sent,
            seconds_sent = self.frames_sent as f64 * FRAME_DURATION_MS as f64 / 1000.0,
            "webrtc: audio streaming stopped"
        );

        let _ = self.peer_connection.close().await;
    }
}

const EVENT_CHANNEL_CAPACITY: usize = 32;
