use std::fmt;

/// Every point a frame can be observed passing through.
///
/// These were bare `&str` literals compared at a dozen call sites, which
/// meant a typo could not fail: an observer matching on a stage name that no
/// stage ever produces simply never fires. `TranscriptLogObserver` was doing
/// exactly that against `"user-aggregator"`, silently logging every turn with
/// an empty transcript. An enum turns that class of mistake into a compile
/// error.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Stage {
    Stt,
    Mt,
    Tts,
    /// Not a pipeline stage: whatever is attached downstream of `tts` — a
    /// WebRTC track or a Twilio websocket. Named so log lines can colour it
    /// and `Stage::next` has something to point at.
    Transport,
    /// The two legs of a real call, each cross-wired into the other's
    /// pipeline. `a` is the app user, `b` the person they dialled.
    CallA,
    CallB,
    /// The pipeline as a whole, seen from outside it.
    Pipeline,
}

impl Stage {
    pub const fn as_str(self) -> &'static str {
        match self {
            Stage::Stt => "stt",
            Stage::Mt => "mt",
            Stage::Tts => "tts",
            Stage::Transport => "transport",
            Stage::CallA => "call-a",
            Stage::CallB => "call-b",
            Stage::Pipeline => "rivervoice",
        }
    }

    /// Who receives what this stage pushes.
    ///
    /// Pipeline order is fixed (`stt` -> `mt` -> `tts` -> transport), so
    /// hardcoding the chain here is simpler than threading "who is
    /// downstream of me" through every stage. The ends of the chain, and the
    /// stages that are not part of it, have no answer.
    pub const fn next(self) -> Option<Stage> {
        match self {
            Stage::Stt => Some(Stage::Mt),
            Stage::Mt => Some(Stage::Tts),
            Stage::Tts => Some(Stage::Transport),
            Stage::Transport | Stage::CallA | Stage::CallB | Stage::Pipeline => None,
        }
    }
}

impl fmt::Display for Stage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}
