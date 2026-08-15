use std::sync::{Arc, Mutex};

use bytes::BytesMut;
use tokio::sync::oneshot;
use webrtc::data_channel::{DataChannel, DataChannelEvent};
use webrtc::peer_connection::{
    MediaEngine, PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler,
    RTCConfigurationBuilder, RTCIceGatheringState, RTCSessionDescription, Registry,
    register_default_interceptors,
};
use webrtc::runtime::default_runtime;

use crate::serializer::serializer::FrameSerializer;
use crate::transport::base::BaseTransport;

/// The WebRTC doorway: signaling (SDP offer/answer) and the data-channel
/// read/write loop. Everything pipeline-facing lives in `BaseTransport`,
/// same division of labor as `WebSocketClient`.
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
/// This connection only ever carries a data channel: no track is
/// registered or attached. `MediaEngine`/`Registry` still have to be
/// built and passed to the builder below regardless — that is
/// `PeerConnectionBuilder`'s required plumbing, not this module opting
/// into media/RTP.
pub struct WebRtcClient<S: FrameSerializer<Message = bytes::Bytes>> {
    base: BaseTransport<S>,
    peer_connection: Box<dyn PeerConnection>,
    data_channel_rx: oneshot::Receiver<Arc<dyn DataChannel>>,
}

/// Bridges `webrtc`'s callback-based peer connection events into the two
/// one-shot signals `accept_offer`/`run` actually wait on: ICE gathering
/// finishing, and the data channel the browser opens on this connection.
struct Handler {
    gather_complete_tx: Mutex<Option<oneshot::Sender<()>>>,
    data_channel_tx: Mutex<Option<oneshot::Sender<Arc<dyn DataChannel>>>>,
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
}

impl<S: FrameSerializer<Message = bytes::Bytes> + 'static> WebRtcClient<S> {
    /// Accepts a browser's SDP offer: builds a `PeerConnection`, exchanges
    /// descriptions, waits for ICE gathering to finish (see the struct
    /// doc on why this stays non-trickle — a single request/response has
    /// no side channel to trickle candidates back on), and returns the
    /// answer SDP to send back over HTTP alongside a `WebRtcClient` whose
    /// `run` should be spawned once that response has gone out.
    pub async fn accept_offer(
        base: BaseTransport<S>,
        offer_sdp: String,
    ) -> anyhow::Result<(Self, String)> {
        let (gather_complete_tx, gather_complete_rx) = oneshot::channel();
        let (data_channel_tx, data_channel_rx) = oneshot::channel();
        let handler = Arc::new(Handler {
            gather_complete_tx: Mutex::new(Some(gather_complete_tx)),
            data_channel_tx: Mutex::new(Some(data_channel_tx)),
        });

        let mut media_engine = MediaEngine::default();
        media_engine.register_default_codecs()?;
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

        Ok((
            Self {
                base,
                peer_connection: Box::new(peer_connection),
                data_channel_rx,
            },
            answer_sdp,
        ))
    }

    /// Waits for the browser's data channel to actually open, then runs
    /// the same push/take loop as `WebSocketClient::on_connect` until
    /// either side closes or the pipeline is torn down.
    pub async fn run(mut self) {
        let Ok(data_channel) = self.data_channel_rx.await else {
            tracing::warn!("webrtc: no data channel opened, dropping connection");
            let _ = self.peer_connection.close().await;
            return;
        };

        loop {
            let event = tokio::select! {
                event = data_channel.poll() => event,
                msg = self.base.next_wire_message() => {
                    let Some(msg) = msg else { break };
                    if data_channel.send(BytesMut::from(msg.as_ref())).await.is_err() {
                        break;
                    }
                    continue;
                }
            };

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

        let _ = self.peer_connection.close().await;
    }
}
