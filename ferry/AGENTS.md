# Working in ferry

ferry is the Rust/axum voice-translation calling backend. It builds
STT→MT→TTS pipelines and bridges them to real-time audio transports —
either a mobile WebSocket connection or a real phone call over Twilio.
This file is what a change needs to respect; the traps below already cost
an afternoon each.

---

## The short version

- **A pipeline is direction-specific.** `build_pipeline(source_lang,
  target_lang, ...)` builds one STT→MT→TTS chain for one language
  direction. A real two-leg call builds **two** of them (`a2b`, `b2a`),
  cross-wired — see "Two-leg calls" below.
- **`FrameSerializer::serialize` is not always how a frame goes out.** Both
  `MobileWsSerializer` and `TwilioSerializer` buffer `TtsAudio` and always
  return `Err` from `serialize` — `drain_paced` is the only thing that
  actually produces a wire message for it. Read the trait doc before
  assuming `serialize` is the delivery path.
- **TTS silently drops text with no speakable chars for the target
  language** (`stages/tts.rs::has_speakable_chars`) — this is
  language-aware, not English-only. If a whole translation direction goes
  silent with no errors, check this first.
- **Don't add `call_id`/`leg` fields by hand at a log call site.** Use
  `crate::call::call_span(call_id, leg)` and `.instrument()` it onto the
  task/pipeline that needs it. Every log line inside inherits the fields
  for free; stages/providers never need to know this exists.
- Verify with `cargo check --message-format=short` — expect zero warnings.

---

## Architecture

### Frames, `FrameIo`, `Pipeline`

`Frame` (`frames.rs`) wraps a `FrameKind` — audio, text, or bookkeeping
(`RawAudio`, `Transcription`, `UserTurnAggregation`, `MtText`,
`TtsAudio(Start/Stop)`, `Metrics`, `*Usage`). Stages are connected by
`FrameIo`, which is just an mpsc `Receiver` (`upstream`/"exit") + `Sender`
(`downstream`/"entrance") pair with observer hooks on push/take.
`Pipeline::spawn(stages, observers, call_span)` chains `SttStage → MtStage
→ TtsStage` with a channel between each, and returns the *outermost*
`FrameIo` — its `upstream` is the last stage's output, its `downstream` is
the first stage's input.

`FrameIo::into_parts()` breaks that outer `FrameIo` into its raw
`(Receiver, Sender)` halves. This is the mechanism the two-leg call uses to
cross-wire two independent pipelines — see below.

### Transports

`BaseTransport<S: FrameSerializer>` wraps one `FrameIo` + one serializer.
Both call legs now go through the same `transport::websockets::transport::WebSocketClient`
— a generic WS read/write loop with a `select!` branch for `pace_interval`
(`Event::Paced`) and an optional fourth branch that watches a
`watch::Receiver<CallStatus>` (`Event::StatusChanged`), used by the mobile
leg to learn when Twilio's leg connects/rings/ends and forward that as a
bare control byte — Twilio's own leg passes `status_rx: None` since there's
nothing else for it to watch. What differs per leg is only the
`FrameSerializer`:

- `codec::transport::mobile_ws::MobileWsSerializer` — tag-byte binary
  protocol (audio, transcript, translation, call-status control bytes) over
  one WebSocket, raw PCM16. No SDP, no ICE — a plain client-to-server
  connection needs neither, since ferry always has a reachable address.
- `codec::transport::telephony::twilio::TwilioSerializer` — Twilio's mulaw
  JSON-framed Media Streams protocol, plus the 8kHz↔16kHz resampling.

Both serializers buffer `TtsAudio` through `send_pacer` and always return
`Err` from `serialize` for it — `drain_paced` is the sole path that actually
produces a wire message, at a steady cadence instead of a burst.

Both transports share `transport::pacing::FramePacer` — buffer raw bytes,
dole out fixed-size chunks on a steady wall-clock cadence, "restart from
now" rather than bursting to catch up if a gap left the buffer briefly
empty. Whichever transport is naive about pacing (sending whatever burst
size arrived, whenever it arrived) produces choppy/garbled audio on the
receiving end — this happened once already (see Traps).

### Two-leg calls (`http/handlers/call.rs`)

A real call is **two independent pipelines**, not one self-looped pipeline:

```
pipeline_a2b: STT(A's lang) -> MT -> TTS(B's lang)   // what B hears
pipeline_b2a: STT(B's lang) -> MT -> TTS(A's lang)   // what A hears
```

Cross-wiring is entirely in which `into_parts()` halves get paired into
which transport's `FrameIo`:

```rust
let a_transport_io = FrameIo::new("call-a", b2a_exit, a2b_entrance, ...);
let b_transport_io = FrameIo::new("call-b", a2b_exit, b2a_entrance, ...);
```

A's transport (WebSocket) reads **b2a**'s output and feeds **a2b**'s input;
B's transport (Twilio) is the mirror. Nothing is "in flight" moved between
them later — the wiring at construction time is the whole mechanism.

`CallRegistry`/`CallHandle` (`call/registry.rs`) correlate A's WebSocket
request (which mints a `CallId` and knows both pipelines) with Twilio's
later, otherwise-unrelated WS connection and status webhook (which only
gets the `CallId` embedded in the URLs we hand Twilio). `b_transport_io`
sits in `CallHandle.pending_b_io` until Twilio's WS connects and
`take_b_io()`s it — `Mutex<Option<FrameIo>>` because it's claimed exactly
once, by whichever of "Twilio connects" / "call already ended" gets there
first. `CallHandle.status_tx: watch::Sender<CallStatus>` is how the two
legs learn about each other asynchronously (Twilio answered → tell A to
stop showing "ringing"; either leg hangs up → tear down the other) — A's
`WebSocketClient` watches it via `with_status()`.

`handlers/try_agent.rs::try_agent_ws` (the try-agent demo, `/v1/try-agent/ws`)
is deliberately the *one-way* self-looped case — one pipeline, no registry,
no Twilio. Don't add two-leg concepts to it.

### Codecs (`codec/`)

`FrameSerializer` trait: `serialize`/`deserialize` are the required
methods; `drain_paced`/`pace_interval` are default no-ops that a
pace-driven serializer (Twilio) overrides. `TwilioSerializer`
(`codec/transport/telephony/twilio.rs`) also owns the 16kHz↔8kHz
resampling (`SampleRateAdapter`, sinc-interpolated via `rubato` — **not**
naive decimation/repetition, which aliases/scrambles) and the mu-law
codec. The mu-law encode/decode pair must be a mathematically consistent
inverse of each other — a bias-value mismatch between them produced
audible, structured distortion that pacing and resampling fixes alone
didn't touch (see Traps).

---

## Logging

Two independent mechanisms:

**Span-based correlation.** `crate::call::call_span(call_id, leg)` builds
a `tracing::Span` carrying `call_id` + a free-form `leg` tag (`"a"`/`"b"`
for a participant's transport, `"a2b"`/`"b2a"` for a pipeline's
direction, `"solo"` for try-agent, `"dial"` for the outbound-dial task).
`.instrument()` it onto whatever task is spawned (`Pipeline::spawn` takes
one and applies it to every stage task; transport `run()`/`on_connect()`
tasks get theirs at the `tokio::spawn`/`on_upgrade` call site). Every log
line inside inherits the fields automatically — **stages and providers
never need to pass `call_id` themselves**, and never should; if you're
about to thread a call_id parameter into `SttStage`/`MtStage`/`TtsStage`,
stop and use a span instead. Separately, `http/router.rs`'s `log_request`
middleware puts a `req_id` span around every HTTP request, so any future
CRUD endpoint gets request correlation for free with zero logging code of
its own.

`logging.rs`'s `ColorEventFormatter` renders the active span's fields as a
`[call_id=... leg=...]` / `[req_id=...]` prefix (via
`ctx.event_scope()` + `FormattedFields`), and colors lines by stage:
`stt`=Cyan, `mt`=Purple, `tts`=Blue, `transport`=LightPurple — either from
an explicit `stage` field (metrics/usage lines) or derived from the
event's module-path target (`stage_from_target`), so any line from a
stage/transport module picks up its color with no code changes there.

**Frame handoff visibility.** `observer::log_observer::LogObserver` (wired
into every pipeline's `observers` list) inspects the frame kind on every
`push` and, when it carries a human-meaningful payload, logs one line:
`stt -> mt: <transcribed text>`, `mt -> tts: <translated text>`, `tts ->
transport: <N> bytes` — colored by the *sending* stage. Frame kinds with
nothing meaningful to show (usage/metrics frames, `TtsAudio{Start,Stop}`)
don't get a handoff line; they stay at the old trace-only push log. This
is the way to add "show me what X sends to Y" for a new stage — extend
`payload_summary()` in `log_observer.rs`, not the stage itself.

**Per-chunk audio logs are TRACE, not DEBUG.** Twilio's inbound/outbound
mulaw chunks and the mobile leg's paced PCM chunks fire every ~20ms — at
DEBUG (the default dev level) they'd drown every other log line in a call
within seconds. They're TRACE-only; each side logs one summary line
instead (frame count + seconds) when streaming starts/stops. Set
`RUST_LOG=ferry=trace` if you actually need per-chunk detail.

Default filter is `ferry=debug,info` in dev (own code at debug, library
chatter at info so it doesn't drown the transcript), `info` json in prod.

---

## Traps already paid for

**Naive resampling scrambles audio, not just aliases it.** Byte-repeating
16-bit samples for upsampling reinterprets byte pairs at the wrong
offsets, not just duplicating them cleanly. Use `SampleRateAdapter`
(`audio/resampler.rs`), never hand-rolled decimation/repetition.

**A mismatched mu-law encode/decode pair sounds like audio, just
wrong.** It's not silence or an error — it's structured, consistent
distortion on every sample ("very very noisy/rough" per the person who
found it), because the decode side used a different bias/prescale
convention than the encode side. If Twilio-leg audio sounds
distorted-but-present, verify the encode/decode pair round-trips
correctly by hand (e.g. sample 0 → encode → decode → exactly 0) before
suspecting anything else.

**No pacing = bursty delivery, which the receiving phone's jitter buffer
can't absorb.** A `TtsAudio` frame can be hundreds of ms of audio in one
chunk; writing it to the wire in one shot arrives far faster than
real-time playback. Always drain through `FramePacer`, one fixed chunk per
tick.

**`has_speakable_chars` is per-target-language, not English-only.** It
existed originally to stop pure-Telugu text from being sent to an
English-only Sarvam voice (400 + dead connection). Extending a pipeline to
a new target language without extending this check means MT translates
correctly and TTS silently swallows every single response — no error
anywhere, just total silence on that leg.

**`WebSocketClient::on_connect`'s `select!` needs explicit `break` arms
for every "nothing left to do" case.** `Incoming(None)` (peer closed),
`Incoming(Some(Err(_)))` (protocol error), and `Outgoing(None)` (pipeline
closed) all must `break` the loop — a `_ => {}` catch-all here means the
loop spins forever re-polling an already-ended stream instead of running
the caller's post-loop cleanup (hangup propagation to the other leg).

**`TranscriptLogObserver` currently never fires.** It matches on stage
name `"user-aggregator"` (`observer/transcript_log_observer.rs:42`), but
the stage that actually produces `UserTurnAggregation` is named `"stt"`
(`stages/stt.rs:32`) — turn aggregation moved into `SttStage` at some
point and this observer wasn't updated. Known, not yet fixed.

---

## Style

Comments explain **why**, not what — a hidden constraint, a workaround for
a specific bug, why a bound exists. Don't add fields/parameters to a stage
or provider to solve a cross-cutting concern (logging, correlation IDs)
that a span or observer already solves from outside.
