# The frame pipeline

How `ferry` turns one person's voice into another person's language, live,
without ever treating a call as one function call.

> A rendered, animated companion to this document: [The Frame Pipeline](https://claude.ai/code/artifact/9c09a5e0-a80b-4ec4-b501-0344320ed58b).
> This file is the version that lives in the repo and renders on GitHub.

---

## The core idea, before any code

The tempting way to build "translate what someone is saying, live" is a
function: `translate(audio_in) -> audio_out`. That shape is wrong for this
problem, for one reason — **a call has no end**. There is no final input to
call the function with. Speech arrives as an unbroken stream, in pieces, for
as long as two people keep talking, and translated speech has to come back
out the other side while more speech is still arriving.

So `ferry` doesn't model a call as a function. It models it as a **pipe**:
a chain of independent stages, each one only responsible for turning one
kind of thing into the next kind of thing, connected by queues instead of
return values.

```
raw audio  ──▶  STT  ──▶  transcript  ──▶  MT  ──▶  translated text  ──▶  TTS  ──▶  translated audio
```

Nobody in that chain waits for the whole call to finish. The STT stage
transcribes whatever chunk of audio just arrived and immediately forgets
about it; the MT stage translates whatever sentence STT just finished and
moves on; the TTS stage speaks whatever MT just produced. Each stage is a
small, dumb, tight loop: *take one thing off my input queue, turn it into
the next thing, put it on my output queue, repeat — forever, until the call
ends.*

That's the whole idea. Everything below is what it takes to make that idea
real: what's actually flowing through the pipe, how the pipe is built out
of stages, and — the part that trips people up first — why a real
two-person call is **two pipes**, not one.

---

## `Frame`: the unit that flows through the pipe

A `Frame` (`frames.rs`) is one thing moving through the pipeline at a given
moment. `FrameKind` is what it actually is:

| Kind | Carries | Produced by |
| --- | --- | --- |
| `RawAudio` | raw mic audio | the transport (WebRTC/Twilio), pushed in from outside the pipeline |
| `Transcription` | partial or final STT text, with `start_s`/`end_s` timestamps | STT |
| `UserTurnAggregation` | one whole spoken turn, stitched from final `Transcription` chunks | STT |
| `MtText` | translated text for one turn | MT |
| `TtsAudio` | synthesized speech audio | TTS |
| `TtsAudioStart` / `TtsAudioStop` | bookkeeping — "a TTS utterance is beginning/ending" | TTS |
| `Metrics` | one stage's time-to-first-byte for this turn | any stage |
| `SttUsage` / `MtUsage` / `TtsUsage` | billing-relevant usage (seconds, tokens, characters) | the matching stage |

Two things are worth noticing about this list. First, it's not just audio —
`Frame` also carries the *bookkeeping* of the call (metrics, usage,
start/stop markers) through the exact same pipe as the audio and text,
because those need to observe the same handoffs the audio does (see
Observers, below). Second, every stage only ever looks at the frame kinds
it cares about and passes the rest through untouched — the type is a tagged
union on purpose, not three separate channels, so one queue carries
everything a call produces in order.

---

## `FrameIo`: what a stage actually holds

A stage doesn't know what's upstream or downstream of it. All it gets is a
`FrameIo` (`processor.rs`) — one inbound queue, one outbound queue, and a
list of read-only observers:

```rust
pub struct FrameIo {
    upstream:   Receiver<Frame>,   // take() reads from here
    downstream: Sender<Frame>,     // push() writes to here
    observers:  Arc<[Arc<dyn FrameObserver>]>,
}
```

`take()` and `push()` are the entire vocabulary a stage needs. Every
`take()`/`push()` also notifies every observer with the frame that just
moved — which is how logging, latency measurement, billing, and transcript
recording all work *without any stage knowing they exist* (more on this in
Observers).

A stage implements one trait:

```rust
trait FrameProcessor {
    async fn run(self: Box<Self>, io: FrameIo);
}
```

`run` is just: loop, `io.take()`, do the stage's actual work (call an STT
provider, call an MT provider, whatever), `io.push()` the result, repeat.
That's the entire contract every stage — STT, MT, TTS — satisfies.

---

## `Pipeline::spawn`: chaining stages into one pipe

`Pipeline::spawn(stages, observers, call_span)` (`pipeline.rs`) takes a list
of stages and wires them into one chain, by giving each stage a channel to
the *next* stage and spawning each one as its own async task:

<figure>
<svg viewBox="0 0 720 170" role="img" aria-label="Pipeline::spawn chains three stages — STT, MT, TTS — by creating one mpsc channel between each pair, then hands back a FrameIo whose upstream is the last stage's output channel and whose downstream is the first stage's input channel.">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
    </marker>
  </defs>
  <g font-family="ui-monospace, monospace" font-size="12" fill="currentColor">
    <rect x="140" y="60" width="90" height="50" rx="6" fill="none" stroke="currentColor"/>
    <text x="185" y="90" text-anchor="middle">STT</text>
    <rect x="315" y="60" width="90" height="50" rx="6" fill="none" stroke="currentColor"/>
    <text x="360" y="90" text-anchor="middle">MT</text>
    <rect x="490" y="60" width="90" height="50" rx="6" fill="none" stroke="currentColor"/>
    <text x="535" y="90" text-anchor="middle">TTS</text>

    <line x1="20" y1="85" x2="135" y2="85" stroke="currentColor" marker-end="url(#arrow)"/>
    <text x="20" y="72" font-size="11">into_first</text>

    <line x1="230" y1="85" x2="310" y2="85" stroke="currentColor" marker-end="url(#arrow)"/>
    <line x1="405" y1="85" x2="485" y2="85" stroke="currentColor" marker-end="url(#arrow)"/>

    <line x1="580" y1="85" x2="700" y2="85" stroke="currentColor" marker-end="url(#arrow)"/>
    <text x="595" y="72" font-size="11">prev_exit</text>

    <text x="185" y="140" text-anchor="middle" font-size="11">tokio::spawn</text>
    <text x="360" y="140" text-anchor="middle" font-size="11">tokio::spawn</text>
    <text x="535" y="140" text-anchor="middle" font-size="11">tokio::spawn</text>
  </g>
</svg>
<figcaption>Each arrow is its own <code>mpsc::channel</code>. The chain's own two loose ends — <code>into_first</code> and the last stage's <code>prev_exit</code> — become the <em>outer</em> <code>FrameIo</code> that <code>spawn</code> hands back.</figcaption>
</figure>

The subtle part is what the returned `FrameIo` means: its `downstream` is
`into_first` (push a frame in, it enters STT), and its `upstream` is the
*last* stage's output (take a frame out, it just left TTS). So from the
outside, one pipeline behaves exactly like one stage — you push raw audio
in, you take translated audio out — even though three independent tasks and
two internal queues are doing the actual work. That's what lets a
translation pipeline be treated as a single black box everywhere outside
`pipeline.rs`.

`call_span` (a `tracing::Span` carrying `call_id` + a leg tag) is applied to
every stage task via `.instrument()`. That's the entire mechanism by which
every log line any stage or provider emits automatically carries
`call_id`/`leg` — no stage ever threads those fields through itself.

One pipeline is **direction-specific**: `build_translation_pipeline` takes a
source language and a target language and builds one `STT(source) →
MT → TTS(target)` chain. It has no concept of "the other direction" at
all. Which is exactly why a real, two-person call needs two of them.

---

## The big one: a real call is two pipelines, cross-wired

Two people on a call, each speaking their own language, is **not** one
pipeline looping audio back on itself — it's two completely independent
direction-specific pipelines, built once per call, wired so each one's
*output* feeds the *other participant's* transport:

```
pipeline_a2b:  STT(A's lang) → MT → TTS(B's lang)     — what B hears
pipeline_b2a:  STT(B's lang) → MT → TTS(A's lang)     — what A hears
```

<figure>
<svg viewBox="0 0 760 300" role="img" aria-label="A's transport reads pipeline_b2a's exit and writes into pipeline_a2b's entrance. B's transport is the mirror: reads pipeline_a2b's exit, writes into pipeline_b2a's entrance. The two pipelines never talk to each other directly — only through this cross-wiring at each transport's FrameIo.">
  <defs>
    <marker id="arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
    </marker>
  </defs>
  <g font-family="ui-monospace, monospace" font-size="12" fill="currentColor">
    <rect x="20" y="20" width="130" height="50" rx="6" fill="none" stroke="currentColor"/>
    <text x="85" y="50" text-anchor="middle">A · WebRTC</text>

    <rect x="20" y="230" width="130" height="50" rx="6" fill="none" stroke="currentColor"/>
    <text x="85" y="260" text-anchor="middle">B · Twilio</text>

    <rect x="280" y="20" width="200" height="50" rx="6" fill="none" stroke="currentColor" class="accent-tts"/>
    <text x="380" y="50" text-anchor="middle">pipeline_a2b</text>

    <rect x="280" y="230" width="200" height="50" rx="6" fill="none" stroke="currentColor" class="accent-mt"/>
    <text x="380" y="260" text-anchor="middle">pipeline_b2a</text>

    <!-- A mic -> a2b entrance -->
    <path d="M150,45 C220,45 220,45 280,45" fill="none" stroke="currentColor" marker-end="url(#arrow2)"/>
    <text x="160" y="35" font-size="10">a2b_entrance (A's mic)</text>

    <!-- a2b exit -> B hears -->
    <path d="M480,45 C620,45 620,255 150,255" fill="none" stroke="currentColor" marker-end="url(#arrow2)"/>
    <text x="500" y="150" font-size="10">a2b_exit → B hears</text>

    <!-- B mic -> b2a entrance -->
    <path d="M150,255 C220,255 220,255 280,255" fill="none" stroke="currentColor" marker-end="url(#arrow2)"/>
    <text x="160" y="245" font-size="10">b2a_entrance (B's mic)</text>

    <!-- b2a exit -> A hears -->
    <path d="M480,255 C620,255 620,45 150,45" fill="none" stroke="currentColor" marker-end="url(#arrow2)" transform="translate(0,-4)"/>
    <text x="560" y="150" font-size="10">b2a_exit → A hears</text>
  </g>
</svg>
<figcaption><code>FrameIo::into_parts()</code> splits each pipeline into a raw <code>(Receiver, Sender)</code> pair. The cross-wiring is entirely which halves get paired into which transport's <code>FrameIo</code> at construction — nothing is moved "in flight" later.</figcaption>
</figure>

Concretely (`http/handlers/call.rs`):

```rust
let (a2b_exit, a2b_entrance) = build_translation_pipeline(..., false, ...).into_parts();
let (b2a_exit, b2a_entrance) = build_translation_pipeline(..., true,  ...).into_parts();

// A's transport: reads what B's pipeline produced, feeds what A said in.
let a_transport_io = FrameIo::new(Stage::CallA, b2a_exit, a2b_entrance, ...);
// B's transport: the mirror.
let b_transport_io = FrameIo::new(Stage::CallB, a2b_exit, b2a_entrance, ...);
```

That's the whole mechanism. There is no "bridge" object, no in-flight
rerouting once the call is live — the wiring *is* two `FrameIo::new` calls,
each one built from one pipeline's exit and the *other* pipeline's
entrance. Once those two `FrameIo`s exist, A's transport pushing raw audio
in automatically ends up, several async hops later, as translated audio
coming out of B's transport, and vice versa.

`/v1/try-agent/offer` (the "preview an agent's voice" demo) deliberately
skips all of this — one pipeline, self-looped back on itself, one
participant, no registry, no second leg. If you're touching that handler,
resist the urge to add cross-wiring to it; it's supposed to be the simple
case.

---

## Correlating two legs that connect at different times

A's WebRTC connection and B's Twilio call don't start at the same moment —
A's `POST /v1/call/start` mints a `call_id` and builds both pipelines
immediately, but Twilio doesn't connect *back* to ferry (its own Media
Streams websocket) until seconds later, once the outbound call actually
rings through. `CallRegistry`/`CallHandle` (`call/registry.rs`) is what
lets that later, otherwise-unrelated connection find the call A already
started:

```mermaid
sequenceDiagram
    participant M as mobile (leg A)
    participant F as ferry
    participant T as Twilio (leg B)
    M->>F: POST /v1/call/start (WebRTC offer)
    F->>F: mint call_id, build pipeline_a2b + pipeline_b2a
    F->>F: register(call_id, b_transport_io) — parked in pending_b_io
    F->>T: place outbound call, call_id embedded in webhook/WS URLs
    F-->>M: SDP answer — A's leg is live
    T->>F: GET /v1/twilio/ws/{call_id}
    F->>F: take_b_io(call_id) — claims the parked FrameIo
    Note over F,T: both legs wired; the call is live end to end
```

`pending_b_io` is a `Mutex<Option<FrameIo>>` specifically because it's
claimed exactly **once**, by whichever happens first: Twilio actually
connecting, or the call already having ended (hung up before Twilio ever
rang through). `CallHandle.status_tx` (a `watch::Sender<CallStatus>`) is
the other half of this correlation — it's how each leg learns about the
other asynchronously afterward: Twilio answering tells A to stop showing
"ringing"; either leg hanging up tears down the other.

---

## Transports: holding the sockets open

A transport's job is narrow: hold a call's socket(s) open, turn incoming
wire bytes into `RawAudio` frames pushed into its `FrameIo`, and turn
`TtsAudio` frames taken from its `FrameIo` back into outgoing wire bytes.
`BaseTransport<S: FrameSerializer>` is the shared plumbing both transport
kinds build on:

- **`WebRtcClient`** — SDP offer/answer, a data channel for
  transcripts/control only, and a **real Opus RTP track** for audio in both
  directions. `TtsAudio` frames bypass the serializer entirely here — paced
  (see below), Opus-encoded, and written straight to the RTP track.
- **`WebSocketClient`** (Twilio's Media Streams) — a generic WS read/write
  loop. `TwilioSerializer` *does* buffer `TtsAudio` through `serialize`, but
  `serialize` itself always returns `Err` — the only path that actually
  produces an outbound wire message is `drain_paced`, driven by a
  `pace_interval` tick.

Both share `FramePacer`: buffer raw bytes, dole out fixed-size chunks on a
steady wall-clock cadence, and — if a gap left the buffer briefly empty —
resume from *now* rather than bursting to catch up. This exists because a
single `TtsAudio` frame can be hundreds of milliseconds of audio; writing
it to the wire in one shot arrives far faster than real-time playback, and
the receiving phone's jitter buffer can't absorb that burst. Skipping the
pacer is exactly how "choppy/garbled audio" happens — it already did, once.

---

## Codec: `Frame ⇄ wire bytes` is a separate concern from providers

It would be easy to let each STT/MT/TTS *provider* also own its own wire
format. `ferry` deliberately keeps those as two different jobs:

- **`services/{stt,mt,tts}/provider.rs`** — what a vendor integration must
  implement to be usable by a stage at all. Swapping the MT vendor, or
  adding a new STT provider, is a new file under `services/`.
- **`codec/`** — `FrameSerializer`, converting a `Frame` to and from
  whatever bytes one specific transport or vendor protocol expects.
  `codec/transport/telephony/twilio.rs` additionally owns the 16kHz↔8kHz
  resampling telephony-quality audio needs (`rubato`'s sinc interpolation —
  naive decimation/repetition scrambles audio, it doesn't just alias it)
  and the mu-law codec Twilio's PSTN leg requires.

Keeping these separate is why adding a transport doesn't touch a provider,
and swapping a provider doesn't touch a transport.

---

## Observers: everything that watches without touching

Billing, usage tracking, latency measurement, transcript logging, and
recording a call to Postgres all need to see every frame that moves through
a pipeline — none of them should be a `if` branch inside `SttStage`. They're
all `FrameObserver`s instead: read-only taps registered on a pipeline's
`FrameIo`, notified on every `push`/`take`, that can't affect the frame
itself.

| Observer | Watches for |
| --- | --- |
| `LogObserver` | human-meaningful handoffs (`stt -> mt: <text>`) — logged, not just traced |
| `LatencyObserver` / `StageLatencyObserver` | time-to-first-byte per stage, per turn |
| `UsageObserver` | `SttUsage`/`MtUsage`/`TtsUsage` frames, for billing |
| `TranscriptLogObserver` | turn-level transcript lines |
| `CallRecordObserver` | writes the call's row/utterances straight to Postgres |

This is the same reason `Frame` carries bookkeeping kinds (`Metrics`,
`*Usage`) through the same pipe as audio and text: an observer only sees
what passes through `push`/`take`, so anything it needs to react to has to
travel as a frame like everything else.

---

## Traps already paid for

Battle-tested, not theoretical — each of these produced a real, confusing
symptom before it was understood.

- **Naive resampling scrambles audio, not just aliases it.** Byte-repeating
  16-bit samples for upsampling reinterprets byte pairs at the wrong
  offsets. Always go through `SampleRateAdapter` (`audio/resampler.rs`).
- **A mismatched mu-law encode/decode pair sounds like audio, just wrong** —
  structured, consistent distortion on every sample, not silence and not an
  error. If Twilio-leg audio sounds "noisy but present," verify the
  encode/decode pair round-trips a sample exactly before suspecting
  anything else.
- **No pacing = bursty delivery** the receiving phone's jitter buffer can't
  absorb. Always drain `TtsAudio` through `FramePacer`.
- **`has_speakable_chars` is per-target-language, not English-only.**
  Extending a pipeline to a new target language without extending this
  check means MT translates correctly and TTS silently swallows every
  response — total, errorless silence on that leg.
- **`WebSocketClient::on_connect`'s `select!` needs an explicit `break` for
  every "nothing left to do" case** (peer closed, protocol error, pipeline
  closed). A stray `_ => {}` spins the loop forever instead of running
  hangup cleanup.

---

## In one paragraph

A call is a pipe, not a function. `Frame` is what flows through it;
`FrameIo` is what a stage holds to move frames one step; `Pipeline::spawn`
chains stages into one pipe that behaves like a single black box from
outside. A pipeline only ever knows one language direction, so a real call
builds two of them and cross-wires each one's output into the *other*
participant's transport — the entire mechanism of "translate both ways at
once" is just which halves of which pipeline get paired into which
`FrameIo`. Everything else — transports, codec, observers, the call
registry — exists to get real audio in and out of that pipe reliably, and
to watch it happen without touching it.
