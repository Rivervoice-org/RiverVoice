use std::fmt;

use nu_ansi_term::Color;
use tracing::field::{Field, Visit};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::fmt::time::{FormatTime, SystemTime};
use tracing_subscriber::fmt::{FmtContext, FormatEvent, FormatFields};
use tracing_subscriber::registry::LookupSpan;

use crate::config::{self, LogFormat};

/// Installs the global `tracing` subscriber: colored, human-shaped lines
/// for a local terminal; structured JSON once deployed (`LOG_FORMAT=json`,
/// see [`config::Config`]) so log platforms (CloudWatch, Loki, ...) get
/// real queryable fields instead of ANSI escapes baked into a string.
/// Level defaults to `info` but honors `RUST_LOG` if set.
///
/// `tracing-subscriber`'s `tracing-log` feature is deliberately left off
/// (see Cargo.toml) so `log`-crate output from `webrtc` and its
/// sub-crates (ice/dtls/sctp/srtp/...) never reaches this subscriber at
/// all — no per-packet noise (`bypass ice read`, `recv dtls RAW`, ...)
/// regardless of `RUST_LOG`, and nothing to filter here.
///
/// Call before [`config::init`] — this needs to be up first so a
/// `Config` validation failure has somewhere to log to, which is why
/// this reads `LOG_FORMAT` via [`config::log_format`] directly rather
/// than through the fallible, not-yet-installed `Config`.
pub fn init() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    match config::log_format() {
        LogFormat::Json => {
            tracing_subscriber::fmt()
                .json()
                .with_env_filter(filter)
                .init();
        }
        LogFormat::Pretty => {
            tracing_subscriber::fmt()
                .event_format(ColorEventFormatter)
                .with_env_filter(filter)
                .init();
        }
    }
}

/// Color-codes ferry's own structured logs by *meaning* — which pipeline
/// stage, a transcription, an interruption, the end-to-end latency —
/// instead of only by level, so a scrolling terminal reads at a glance.
/// Anything outside these known targets (vendor crates like `hyper_util`,
/// `tungstenite`) falls back to the stock field formatter.
pub struct ColorEventFormatter;

fn stage_color(stage: &str) -> Color {
    match stage {
        "stt" => Color::Cyan,
        "llm" => Color::Purple,
        "tts" => Color::Blue,
        _ => Color::White,
    }
}

fn level_color(level: &Level) -> Color {
    match *level {
        Level::TRACE => Color::Purple,
        Level::DEBUG => Color::Blue,
        Level::INFO => Color::Green,
        Level::WARN => Color::Yellow,
        Level::ERROR => Color::Red,
    }
}

#[derive(Default)]
struct Captured {
    message: String,
    stage: Option<String>,
    ttfb_ms: Option<i64>,
    latency_ms: Option<i64>,
    text: Option<String>,
    by_timeout: Option<bool>,
}

impl Visit for Captured {
    fn record_str(&mut self, field: &Field, value: &str) {
        match field.name() {
            "stage" => self.stage = Some(value.to_string()),
            "text" => self.text = Some(value.to_string()),
            _ => {}
        }
    }

    fn record_i64(&mut self, field: &Field, value: i64) {
        match field.name() {
            "ttfb_ms" => self.ttfb_ms = Some(value),
            "latency_ms" => self.latency_ms = Some(value),
            _ => {}
        }
    }

    fn record_u64(&mut self, field: &Field, value: u64) {
        self.record_i64(field, value as i64);
    }

    fn record_bool(&mut self, field: &Field, value: bool) {
        if field.name() == "by_timeout" {
            self.by_timeout = Some(value);
        }
    }

    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        let rendered = format!("{value:?}");
        match field.name() {
            "message" => self.message = rendered.trim_matches('"').to_string(),
            "stage" => self.stage = Some(rendered.trim_matches('"').to_string()),
            "text" => self.text = Some(rendered.trim_matches('"').to_string()),
            _ => {}
        }
    }
}

/// Paints `s` with `color` when the writer has ANSI enabled, otherwise
/// returns it unchanged — keeps the special-cased branches below from
/// hand-rolling this check every time.
fn paint(color: Color, ansi: bool, s: &str) -> String {
    if ansi {
        color.paint(s).to_string()
    } else {
        s.to_string()
    }
}

impl<S, N> FormatEvent<S, N> for ColorEventFormatter
where
    S: Subscriber + for<'a> LookupSpan<'a>,
    N: for<'a> FormatFields<'a> + 'static,
{
    fn format_event(
        &self,
        ctx: &FmtContext<'_, S, N>,
        mut writer: Writer<'_>,
        event: &Event<'_>,
    ) -> fmt::Result {
        let ansi = writer.has_ansi_escapes();
        let meta = event.metadata();
        let target = meta.target();

        SystemTime.format_time(&mut writer)?;
        write!(
            writer,
            " {:>5} ",
            paint(level_color(meta.level()), ansi, meta.level().as_str())
        )?;

        let mut fields = Captured::default();
        event.record(&mut fields);

        match target {
            "ferry::metrics" => {
                let stage = fields.stage.as_deref().unwrap_or("?");
                let color = stage_color(stage);
                write!(
                    writer,
                    "{}: ttfb {}={} {}={}",
                    target,
                    paint(color, ansi, "stage"),
                    paint(color, ansi, stage),
                    paint(color, ansi, "ttfb_ms"),
                    paint(color, ansi, &fields.ttfb_ms.unwrap_or_default().to_string()),
                )?;
            }
            "ferry::latency" => {
                let color = Color::LightGreen;
                write!(
                    writer,
                    "{}: {} {}={}",
                    target,
                    paint(color, ansi, &fields.message),
                    paint(color, ansi, "latency_ms"),
                    paint(
                        color,
                        ansi,
                        &fields.latency_ms.unwrap_or_default().to_string()
                    ),
                )?;
            }
            // Both events come from `user_aggregator`'s turn-tracking, so
            // they share a target — distinguish by which fields are set.
            _ if fields.message == "user-aggregator: turn started" => {
                write!(
                    writer,
                    "{}",
                    paint(Color::Red, ansi, &format!("{target}: {}", fields.message))
                )?;
            }
            _ if fields.text.is_some() => {
                let by_timeout = fields.by_timeout.unwrap_or_default();
                write!(
                    writer,
                    "{}: {} by_timeout={by_timeout} text={}",
                    target,
                    fields.message,
                    paint(
                        Color::Yellow,
                        ansi,
                        &format!("{:?}", fields.text.unwrap_or_default())
                    ),
                )?;
            }
            _ => {
                write!(writer, "{target}: ")?;
                ctx.format_fields(writer.by_ref(), event)?;
            }
        }

        writeln!(writer)
    }
}
