// `frames::frames`, `http::http`, `pipeline::pipeline`, `processor::processor`,
// `serializer::serializer`: each of these folders bundles its module's own
// doc comment, re-exports, and tests alongside vendor-specific submodules
// (`stt/`, `transport/`, ...) — the repeated name is the folder's contents
// module, not an accident clippy needs to flag on every one of them.
#![allow(clippy::module_inception)]

pub mod audio;
pub mod auth;
pub mod frames;
pub mod http;
pub mod observer;
pub mod pipeline;
pub mod processor;
pub mod serializer;
pub mod services;
pub mod stages;
pub mod transport;
pub mod turns;
