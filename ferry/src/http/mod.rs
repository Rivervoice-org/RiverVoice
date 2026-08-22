pub mod handlers;
pub mod response;
pub mod router;
pub mod state;

/// Cap on raw request bodies read via `to_bytes` in handlers that take a raw
/// `Request` instead of an extractor (see agent.rs/auth.rs/call.rs/etc.) —
/// generous enough for a full SDP offer (the largest body any handler here
/// expects) while still bounding an unauthenticated or malicious caller from
/// forcing an unbounded in-memory buffer.
pub const MAX_REQUEST_BODY_SIZE: usize = 256 * 1024;
