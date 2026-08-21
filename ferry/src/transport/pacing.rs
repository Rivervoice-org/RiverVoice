use std::collections::VecDeque;
use std::time::Duration;

use tokio::time::Instant;

/// Buffers raw bytes and doles them out in fixed-size chunks at a steady
/// wall-clock cadence. Shared by the WebRTC (Opus/RTP track) and Twilio
/// (mulaw/WebSocket) audio-out paths, which otherwise each independently
/// implement the same "don't just send whatever burst size arrived, drip it
/// out in real-time frames" arithmetic — including "if we fell behind,
/// restart from now rather than bursting to catch up," which is easy to get
/// subtly wrong twice. What actually happens with each drained chunk
/// (encode to Opus and write an RTP sample vs base64-encode and send a JSON
/// WS message) stays specific to each transport — only the buffering and
/// timing are shared here.
pub struct FramePacer {
    buffer: VecDeque<u8>,
    chunk_bytes: usize,
    frame_duration: Duration,
    next_frame_at: Option<Instant>,
}

impl FramePacer {
    pub fn new(chunk_bytes: usize, frame_duration: Duration) -> Self {
        Self {
            buffer: VecDeque::new(),
            chunk_bytes,
            frame_duration,
            next_frame_at: None,
        }
    }

    pub fn push(&mut self, bytes: impl IntoIterator<Item = u8>) {
        self.buffer.extend(bytes);
    }

    /// Bytes currently queued, purely for debug logging.
    pub fn buffered_len(&self) -> usize {
        self.buffer.len()
    }

    /// `None` while there isn't even one full chunk buffered yet — callers
    /// building a `select!` should gate their timer branch's `if` guard on
    /// this, so a stalled/empty pacer doesn't spin a timer with nothing to
    /// send.
    pub fn next_deadline(&self) -> Option<Instant> {
        if self.buffer.len() < self.chunk_bytes {
            return None;
        }
        Some(self.pacing_target())
    }

    /// If we've fallen more than one frame behind (e.g. a gap between
    /// bursts left the buffer briefly empty), catching up by bursting the
    /// backlog would recreate the exact bursty-delivery problem this exists
    /// to prevent — restart pacing from now instead of chasing a stale
    /// deadline.
    fn pacing_target(&self) -> Instant {
        let now = Instant::now();
        match self.next_frame_at {
            Some(t) if t > now.checked_sub(self.frame_duration).unwrap_or(now) => t,
            _ => now,
        }
    }

    /// Pops exactly one chunk's worth of bytes if a full one is buffered,
    /// advancing the schedule for the next call. No-op (`None`) otherwise.
    pub fn try_drain(&mut self) -> Option<Vec<u8>> {
        if self.buffer.len() < self.chunk_bytes {
            return None;
        }
        let chunk: Vec<u8> = self.buffer.drain(..self.chunk_bytes).collect();
        self.next_frame_at = Some(self.pacing_target() + self.frame_duration);
        Some(chunk)
    }
}
