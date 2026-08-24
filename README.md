# RiverVoice

Voice agents that answer the phone in Indian languages. You describe an agent in
a browser, give it a voice, and it takes calls — over WebRTC from the mobile app,
or as a real phone call bridged through Twilio.

Three services, two languages:

|            | what it does                                              | stack                |
| ---------- | ---------------------------------------------------------- | --------------------- |
| **web**    | the builder and dashboard                                   | Next.js, TypeScript   |
| **ferry**  | the live call: WebRTC, Twilio, speech, translation, audio   | Rust, axum, tokio     |
| **mobile** | the calling client — one of two things that talk to ferry   | Expo, React Native    |

There used to be a fourth service (Go, Postgres) — accounts, agents,
tools, everything that persisted. It's gone. web now runs on mock data
(`web/src/lib/mock-data.ts`) standing in for what the backend used to serve, so the
builder UI works with no backend behind it. There is currently no service that
persists an agent's settings — ferry's call handlers take the call
configuration as request input, not a lookup by agent id. Rebuilding that is
the next real backend work; nothing in this repo does it yet.

---

## Contents

- [The shape of the system](#the-shape-of-the-system)
- [Running it](#running-it)
- [web](#web)
- [ferry](#ferry)
- [mobile](#mobile)
- [Conventions](#conventions)

---

## The shape of the system

```
   browser ────────▶  web       :3000    Next.js — builder, dashboard
                                          (mock data, no backend yet)

   mobile ──WebRTC─▶  ferry     :8085    Rust — STT, MT, TTS, call bridging
   Twilio  ──PSTN───▶
```

web and ferry don't talk to each other in production use — web is a design-time
tool for building an agent's config; ferry is the run-time engine that answers
a call. The one place they meet is ferry's `/v1/try-agent/offer` route, a
one-way WebRTC demo web's builder can open directly in the browser to preview
an agent without going through mobile or Twilio at all.

A real, two-leg call, end to end:

```
mobile places a call ──POST /v1/call/start──▶ ferry
                                                 │
                          ┌──────────────────────┴──────────────────────┐
                          │                                              │
                 leg A: WebRTC (mobile)                       leg B: Twilio (PSTN)
                          │                                              │
                          └──────────two independent pipelines──────────┘
                                 pipeline a2b: STT(A) → MT → TTS(B)   → what B hears
                                 pipeline b2a: STT(B) → MT → TTS(A)   → what A hears
```

Twilio's leg connects back to ferry over its own Media Streams websocket
(`GET /v1/twilio/ws/{call_id}`) and status webhook
(`POST /v1/twilio/status/{call_id}`), correlated to the WebRTC leg by the
`call_id` ferry mints when the call starts. See [ferry](#ferry) for how the
two pipelines get cross-wired.

---

## Running it

You need Node 20+ and Rust (only for ferry). No Docker, no database.

```bash
cp .env.example .env          # fill in the API keys — see ferry/.env.example
                               # for the current, accurate list

cd web     && npm install && npm run dev     # :3000
cd ferry   && cargo run                      # :8085
cd mobile  && npm install && npx expo run:android   # or run:ios — needs a dev client
```

> The root `.env.example` still has leftover `POSTGRES_*`/`DATABASE_URL`/
> `JWT_SECRET`-for-sessions/`WEB_ORIGIN` entries that nothing reads anymore.
> **[ferry/.env.example](ferry/.env.example)** is the
> accurate list: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
> `TWILIO_TWIML_APP_SID`, `TWILIO_FROM_NUMBER`, `TWILIO_TO_NUMBER`,
> `PUBLIC_BASE_URL` (a public tunnel URL Twilio can reach — e.g. a Cloudflare
> Tunnel — since Twilio calls back into ferry over the open internet),
> `DEEPGRAM_STT_API_KEY`, `OPENROUTER_API_KEY`, `SARVAM_TTS_API_KEY`. ferry
> loads the root `.env` first, then falls back to its own.

mobile needs `EXPO_PUBLIC_FERRY_URL` pointing at ferry — `http://127.0.0.1:8085`
works from an emulator on the same machine; a physical device needs ferry's LAN
IP, and `WEBRTC_BIND_IP` set to that same address so the media actually
connects.

---

## web

Next.js App Router, TypeScript, Tailwind v4, Base UI primitives.

```
src/
  app/
    (auth)/          sign-in, sign-up, verify
    (app)/           home, agents        — the shell with the sidebar
    (site)/          marketing pages
    build-agent/     the builder, its own layout
    artifacts/, shelf-preview/    standalone preview routes
  components/
    dashboard/       agent board, composer, templates
    builder/         settings, tools, variables, assistant
    ui/              Base UI wrappers — button, dialog, data-table
  lib/
    mock-data.ts     stand-ins for persisted data
    agents/          queries and schemas per resource, reading mock-data
    auth/, pricing/, tools/    same pattern — mocked, not fetched
    webrtc/          the try-agent WebRTC demo client, talks to ferry directly
  mascots/           the agent avatars — art, not components
  motion/            the hand-drawn walkthrough engine
```

**There is no live API call for agents, auth, or pricing.** `lib/api.ts` is
now just an `ApiError` type — the fetch wrapper it used to hold is gone.
`lib/agents/server.ts` and friends resolve against
`lib/mock-data.ts` through the same async function shapes a real fetch would
have, so swapping in a real backend later is a matter of replacing the
function bodies, not the call sites or the TanStack Query hooks around them:

```ts
export const agentsQueryKey = ["agents"] as const;

export function useAgents() {
  return useQuery({
    queryKey: agentsQueryKey,
    queryFn: () => getAgents(), // reads lib/mock-data.ts today
  });
}
```

**The one thing web does talk to for real is ferry**, and only for the
try-agent preview: `lib/webrtc/` opens a WebRTC connection straight to
`POST /v1/try-agent/offer` so you can hear an agent from the browser while
building it, without mobile or a phone call involved.

**`mascots/` and `motion/` are libraries, not components.** Nothing in them
imports from `components/`, which is what lets the art render server-side, or
in a script that uploads an avatar. `mascots/parts.ts` is path data;
`mascots/bot.ts` is the seeded assembler that picks from it.

---

## ferry

Rust, axum, tokio. Holds a call's sockets open for its whole duration and runs
the pipeline that turns what someone says into translated speech, frame by
frame, in real time — for a WebRTC connection, a Twilio phone call, or both at
once, bridged.

```
ferry/src/
  main.rs
  config.rs           env vars — API keys, PUBLIC_BASE_URL, WEBRTC_BIND_IP
  logging.rs           ColorEventFormatter — [call_id=... leg=...] prefixes, per-stage colors
  pricing.rs            per-vendor cost tables, for the billing/usage observers
  auth/                 session token verification (unused today — see router.rs)
  call/
    mod.rs                call_span(call_id, leg) — the tracing correlation helper
    registry.rs           CallRegistry / CallHandle — correlates a WebRTC leg with
                           Twilio's later, otherwise-unrelated WS connection
  http/
    router.rs             axum Router, routes, CORS, request-id middleware
    handlers/
      webrtc.rs              POST /v1/try-agent/offer — one-way demo, no registry
      call.rs                POST /v1/call/start — the real two-leg call
      twilio.rs              GET /v1/twilio/ws/{id}, POST /v1/twilio/status/{id}
    state.rs
  frames.rs            Frame / FrameKind — the value every stage passes on
  processor.rs         FrameProcessor / FrameIo — the contract a stage implements
  pipeline.rs          Pipeline::spawn — chains stages + observers into one call
  stages/               one file per pipeline stage: stt.rs, mt.rs, tts.rs
  services/             outbound clients that call vendor APIs
    stt/, mt/, tts/        provider.rs trait + one file per vendor
    twilio/                TwilioClient — fires outbound calls, hangs up by CallSid
    ws_client.rs            reconnecting websocket client shared by STT/TTS
  codec/                FrameSerializer impls — Frame ⇄ wire bytes, one per protocol
    frame_serializer.rs    the FrameSerializer trait
    transport/               webrtc_dc.rs, telephony/twilio.rs (mu-law, resampling)
    stt/, tts/                vendors' own wire framing (Deepgram JSON, Sarvam stream)
  transport/            holds a call's sockets open
    base.rs               BaseTransport<S: FrameSerializer>
    pacing.rs              FramePacer — steady wall-clock cadence, no bursts
    webrtc/                WebRtcClient — SDP offer/answer, real Opus RTP track
    websockets/             WebSocketClient — generic WS loop, used by Twilio
  observer/             read-only taps on the frame stream
    billing_observer.rs, usage_observer.rs, latency_observer.rs, log_observer.rs
  audio/                 opus, resampling (rubato, sinc — not naive decimation), VAD
```

There is no `db/` — ferry doesn't persist anything. `POST /v1/call/start`
takes the call's configuration in the request; nothing is looked up by agent
id. See [ferry/AGENTS.md](ferry/AGENTS.md) for the full internals doc this
section summarizes.

```
GET  /health
POST /v1/try-agent/offer          SDP offer in, SDP answer out — one-way demo
POST /v1/call/start               starts a real two-leg call (WebRTC + Twilio)
GET  /v1/twilio/ws/{call_id}      Twilio's Media Streams websocket
POST /v1/twilio/status/{call_id}  Twilio's call-status webhook
```

### The frame pipeline

Every stage — STT, MT, TTS — implements `FrameProcessor` and gets a `FrameIo`:
an inbound channel, an outbound channel, and the observer list.
`Pipeline::spawn` chains the stages' channels into one queue, audio in one
end, translated audio out the other:

```rust
pub trait FrameProcessor {
    fn name(&self) -> &'static str;
    async fn run(self: Box<Self>, io: FrameIo);
}
```

A pipeline is direction-specific — one `STT(lang) → MT → TTS(lang)` chain.

### Two-leg calls are two pipelines, cross-wired

A real call (`http/handlers/call.rs`) builds **two** pipelines, not one
self-looped one:

```
pipeline_a2b: STT(A's lang) → MT → TTS(B's lang)   // what B hears
pipeline_b2a: STT(B's lang) → MT → TTS(A's lang)   // what A hears
```

`FrameIo::into_parts()` splits each pipeline into raw `(Receiver, Sender)`
halves, and those halves are paired into the *other* leg's transport at
construction time — A's WebRTC transport reads `b2a`'s output and feeds
`a2b`'s input; Twilio's transport is the mirror. Nothing is moved "in flight"
later; the wiring at construction is the whole mechanism.

`CallRegistry`/`CallHandle` (`call/registry.rs`) is what lets Twilio's later,
otherwise-unrelated websocket connection and status webhook find the call A
already started — both only carry the `call_id` embedded in the URLs ferry
handed Twilio. `/v1/try-agent/offer` deliberately skips all of this: one
pipeline, self-looped, no registry, no Twilio — a way to hear an agent from a
browser tab.

### Providers are traits, codec is the wire format — two different jobs

`services/{stt,mt,tts}/provider.rs` define what a vendor integration must
implement. Swapping the MT vendor from Sarvam to an OpenRouter model, or
adding a new STT provider, is a new file under `services/`, not a change to
`stages/`.

`codec/` is a separate concern: it implements `FrameSerializer`, converting a
`Frame` to and from whatever bytes a specific transport or vendor protocol
expects. `codec/transport/telephony/twilio.rs` also owns the 16kHz↔8kHz
resampling and the mu-law codec Twilio's phone-quality audio needs — done with
`rubato`'s sinc interpolation, not naive decimation, which scrambles audio
rather than just aliasing it.

### Why Rust

A call is a WebRTC connection or a Twilio phone call held open for minutes,
with a second socket to the STT provider and a third to TTS, per leg. The work
is IO-bound with hard latency limits and no room for a GC pause during
someone's sentence.

Providers drop idle sockets — Deepgram closes on inactivity — so the STT
client sends a keepalive frame periodically and reconnects with backoff
(`services/ws_client.rs`) rather than dropping the call.

---

## mobile

Expo (React Native), TypeScript, NativeWind. The calling client — one of the
two things that talk to ferry directly (the other is web's try-agent preview).

```
mobile/
  app/                    expo-router routes
    (auth)/                  sign-in, sign-up
    (tabs)/                  agents, call, phonebook, settings
    agent-detail.tsx, call-detail.tsx, transcript.tsx, try-agent.tsx, ...
  screens/                 the screen implementations, one folder per screen
  components/
    ui/                      rn-primitives wrappers — button, dialog, select, toast
  lib/
    webrtc/
      signaling.ts            POSTs to ferry (/v1/call/start or /v1/try-agent/offer)
      ferry-call.ts            RTCPeerConnection lifecycle for one call
      wire.ts                  the mobile-side frame wire format
    mascots/                 shared with web's avatar system, kept in sync by hand
    theme.tsx
  providers/, state/session/  auth session — mirrors web's session handling
```

**mobile calls ferry directly** — web only does for its try-agent preview.
`lib/webrtc/signaling.ts` posts to ferry, gets back an SDP answer, and
`ferry-call.ts` drives the `RTCPeerConnection` from there:

```ts
const DEFAULT_FERRY_URL = "http://127.0.0.1:8085";
process.env["EXPO_PUBLIC_FERRY_URL"] ?? DEFAULT_FERRY_URL;
```

The default only works from an emulator on the same machine as ferry. A
physical device needs `EXPO_PUBLIC_FERRY_URL` set to ferry's LAN address, and
ferry's own `WEBRTC_BIND_IP` set to that same address — otherwise the SDP
negotiates fine and no audio ever arrives.

**`lib/webrtc/wire.ts` mirrors web's `lib/webrtc/wire.ts` by hand**, the same
way `components/ui/` and `lib/mascots/` mirror web's — there's no shared
package between the two clients, so a change to ferry's data-channel tag
bytes needs the same edit made twice. They are currently out of sync: web's
copy has two tag kinds (`PeerConnected`, `Ringing`) mobile's doesn't yet have.
Check both before assuming ferry's wire format is fully documented in either
one.

```bash
cd mobile && npm install
npx expo run:android   # or run:ios
```

Native modules (`react-native-webrtc`, `react-native-incall-manager`) mean
Expo Go can't run this app — use `run:android`/`run:ios` to build a dev
client, or `expo-dev-client` if one's already installed on the device.

---

## Conventions

**Comments explain why, not what.** If the code says it, the comment does
not. The ones worth writing are the non-obvious constraints — why a mu-law
bias mismatch sounds like distortion and not silence, why the mouth animation
only works on one mascot style, why a stroke carries `pathLength="1"`.

**Errors are mapped, not pre-checked**, wherever there's a place that would
apply — check-then-act races two simultaneous requests; prefer doing the
thing and mapping the failure.

**Commits are small and explain the reasoning.** The subject says what
changed, the body says why it was done that way.

**Pre-commit runs** prettier and rustfmt, plus the usual whitespace and
merge-conflict checks. CI runs one workflow per service
(`.github/workflows/ferry.yml`, `web.yml`, `mobile-android-build.yml`),
path-filtered so a web change does not rebuild ferry.

**PRs get two automated reviewers.** CodeRabbit comments on every PR (config
in [.coderabbit.yaml](.coderabbit.yaml)); Claude Code reviews are run manually
via `/code-review`. Neither replaces a human review before merge.
