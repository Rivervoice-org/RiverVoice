use std::fmt;

use nu_ansi_term::Color;
use tracing::field::{Field, Visit};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::fmt::FormattedFields;
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::fmt::time::{FormatTime, SystemTime};
use tracing_subscriber::fmt::{FmtContext, FormatEvent, FormatFields};
use tracing_subscriber::registry::LookupSpan;

use crate::config::{self, Environment};

pub fn init() {
    let environment = config::environment();

    let default_level = match environment {
        // ferry's own targets at debug; everything else (hyper, reqwest,
        // rustls, h2...) at info so library chatter doesn't drown the
        // transcript. RUST_LOG still overrides.
        Environment::Dev => "ferry=debug,info",
        Environment::Prod => "info",
    };
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(default_level));

    match environment {
        Environment::Prod => {
            tracing_subscriber::fmt()
                .json()
                .with_env_filter(filter)
                .init();
        }
        Environment::Dev => {
            // Windows consoles don't interpret ANSI escape codes by default —
            // without this, every `paint()` call below just prints raw
            // escape sequences (or nothing) instead of actual color.
            #[cfg(windows)]
            let _ = nu_ansi_term::enable_ansi_support();

            tracing_subscriber::fmt()
                .event_format(ColorEventFormatter)
                .with_env_filter(filter)
                .init();
        }
    }
}

pub struct ColorEventFormatter;

fn stage_color(stage: &str) -> Color {
    match stage {
        "stt" => Color::Cyan,
        "mt" => Color::Purple,
        "tts" => Color::Blue,
        "transport" => Color::LightPurple,
        _ => Color::White,
    }
}

/// Derives a stage from an event's module-path target, for lines that don't
/// carry an explicit `stage` field (most don't — only the metrics/usage
/// events do). Lets any log line anywhere in a stage or transport module
/// pick up that stage's color automatically, with zero changes to the code
/// that emits it.
fn stage_from_target(target: &str) -> Option<&'static str> {
    if target.contains("::transport") {
        Some("transport")
    } else if target.contains("::stt") {
        Some("stt")
    } else if target.contains("::mt") {
        Some("mt")
    } else if target.contains("::tts") {
        Some("tts")
    } else {
        None
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

// One consistent color per log *kind* — so "this is a metrics line" / "this
// is a usage line" is recognizable at a glance regardless of which stage it
// came from. The stage name itself still gets `stage_color` within that line,
// so which stage is still visually distinct too.
const METRICS_COLOR: Color = Color::LightYellow;
const USAGE_COLOR: Color = Color::LightBlue;

#[derive(Default)]
struct Captured {
    message: String,
    stage: Option<String>,
    ttfb_ms: Option<i64>,
    latency_ms: Option<i64>,
    text: Option<String>,
    // ferry::frame_flow (handoff lines from LogObserver) only.
    next: Option<String>,
    payload: Option<String>,
    // ferry::usage fields — one event only ever carries the subset for its
    // own frame kind (stt/mt/tts), the rest stay None.
    audio_seconds: Option<f64>,
    total_audio_seconds: Option<f64>,
    prompt_tokens: Option<i64>,
    completion_tokens: Option<i64>,
    total_tokens: Option<i64>,
    total_prompt_tokens: Option<i64>,
    total_completion_tokens: Option<i64>,
    characters: Option<i64>,
    total_characters: Option<i64>,
}

impl Visit for Captured {
    fn record_str(&mut self, field: &Field, value: &str) {
        match field.name() {
            "stage" => self.stage = Some(value.to_string()),
            "text" => self.text = Some(value.to_string()),
            "next" => self.next = Some(value.to_string()),
            "payload" => self.payload = Some(value.to_string()),
            _ => {}
        }
    }

    fn record_f64(&mut self, field: &Field, value: f64) {
        match field.name() {
            "audio_seconds" => self.audio_seconds = Some(value),
            "total_audio_seconds" => self.total_audio_seconds = Some(value),
            _ => {}
        }
    }

    fn record_i64(&mut self, field: &Field, value: i64) {
        match field.name() {
            "ttfb_ms" => self.ttfb_ms = Some(value),
            "latency_ms" => self.latency_ms = Some(value),
            "prompt_tokens" => self.prompt_tokens = Some(value),
            "completion_tokens" => self.completion_tokens = Some(value),
            "total_tokens" => self.total_tokens = Some(value),
            "total_prompt_tokens" => self.total_prompt_tokens = Some(value),
            "total_completion_tokens" => self.total_completion_tokens = Some(value),
            "characters" => self.characters = Some(value),
            "total_characters" => self.total_characters = Some(value),
            _ => {}
        }
    }

    fn record_u64(&mut self, field: &Field, value: u64) {
        self.record_i64(field, value as i64);
    }

    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        let rendered = format!("{value:?}");
        match field.name() {
            "message" => self.message = rendered.trim_matches('"').to_string(),
            "stage" => self.stage = Some(rendered.trim_matches('"').to_string()),
            "text" => self.text = Some(rendered.trim_matches('"').to_string()),
            "payload" => self.payload = Some(rendered.trim_matches('"').to_string()),
            _ => {}
        }
    }
}

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

        let mut body = String::new();
        {
            let mut w = Writer::new(&mut body);

            SystemTime.format_time(&mut w)?;
            write!(
                w,
                " {:>5} ",
                paint(level_color(meta.level()), ansi, meta.level().as_str())
            )?;

            // Span context (req_id / call_id / leg, set up in
            // `http::router::log_request` and `call::call_span`) — printed
            // as one bracketed prefix so any log line, anywhere in a stage
            // or provider, is traceable back to the request/call it belongs
            // to without that code needing to pass those fields itself.
            if let Some(scope) = ctx.event_scope() {
                let mut span_fields = String::new();
                for span in scope.from_root() {
                    let ext = span.extensions();
                    if let Some(fields) = ext.get::<FormattedFields<N>>()
                        && !fields.is_empty()
                    {
                        if !span_fields.is_empty() {
                            span_fields.push(' ');
                        }
                        span_fields.push_str(fields.as_str());
                    }
                }
                if !span_fields.is_empty() {
                    write!(
                        w,
                        "{} ",
                        paint(Color::DarkGray, ansi, &format!("[{span_fields}]"))
                    )?;
                }
            }

            let mut fields = Captured::default();
            event.record(&mut fields);

            match target {
                "ferry::metrics" => {
                    let stage = fields.stage.as_deref().unwrap_or("?");
                    let stage_col = stage_color(stage);
                    write!(
                        w,
                        "{}: {} {}={} {}={}",
                        paint(METRICS_COLOR, ansi, target),
                        paint(METRICS_COLOR, ansi, "ttfb"),
                        paint(METRICS_COLOR, ansi, "stage"),
                        paint(stage_col, ansi, stage),
                        paint(METRICS_COLOR, ansi, "ttfb_ms"),
                        paint(
                            METRICS_COLOR,
                            ansi,
                            &fields.ttfb_ms.unwrap_or_default().to_string()
                        ),
                    )?;
                }
                "ferry::usage" => {
                    let stage = fields.stage.as_deref().unwrap_or("?");
                    let stage_col = stage_color(stage);
                    let label = |s: &str| paint(USAGE_COLOR, ansi, s);

                    write!(
                        w,
                        "{}: {} {}={}",
                        label(target),
                        label(&fields.message),
                        label("stage"),
                        paint(stage_col, ansi, stage),
                    )?;

                    match fields.message.as_str() {
                        "stt_usage" => write!(
                            w,
                            " {}={:.2} {}={:.2}",
                            label("audio_seconds"),
                            fields.audio_seconds.unwrap_or_default(),
                            label("total_audio_seconds"),
                            fields.total_audio_seconds.unwrap_or_default(),
                        )?,
                        "mt_usage" => write!(
                            w,
                            " {}={} {}={} {}={} {}={} {}={}",
                            label("prompt_tokens"),
                            fields.prompt_tokens.unwrap_or_default(),
                            label("completion_tokens"),
                            fields.completion_tokens.unwrap_or_default(),
                            label("total_tokens"),
                            fields.total_tokens.unwrap_or_default(),
                            label("total_prompt_tokens"),
                            fields.total_prompt_tokens.unwrap_or_default(),
                            label("total_completion_tokens"),
                            fields.total_completion_tokens.unwrap_or_default(),
                        )?,
                        "tts_usage" => write!(
                            w,
                            " {}={} {}={}",
                            label("characters"),
                            fields.characters.unwrap_or_default(),
                            label("total_characters"),
                            fields.total_characters.unwrap_or_default(),
                        )?,
                        _ => {}
                    }
                }
                "ferry::latency" => {
                    let color = Color::LightGreen;
                    write!(
                        w,
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

                "ferry::transcript" => {
                    // Just the raw STT text, nothing else — the whole line
                    // is the transcript so it scans clean in any language.
                    write!(
                        w,
                        "{}",
                        paint(
                            stage_color("stt"),
                            ansi,
                            fields.text.as_deref().unwrap_or_default()
                        )
                    )?;
                }

                // LogObserver's handoff line — "stt -> mt: <transcribed
                // text>", "mt -> tts: <translated text>", "tts -> transport:
                // <N> bytes" — colored by the *sending* stage, so you can
                // watch what each stage produces for the next one without
                // wading through every other frame kind. Frame kinds with no
                // human-meaningful payload (usage/metrics, start/stop
                // markers) never set `payload`, so they fall through to the
                // generic branch below (and stay at TRACE, so invisible by
                // default).
                "ferry::frame_flow" if fields.payload.is_some() => {
                    let stage = fields.stage.as_deref().unwrap_or("?");
                    let next = fields.next.as_deref().unwrap_or("?");
                    write!(
                        w,
                        "{}",
                        paint(
                            stage_color(stage),
                            ansi,
                            &format!(
                                "{stage} -> {next}: {}",
                                fields.payload.as_deref().unwrap_or_default()
                            )
                        )
                    )?;
                }

                _ => {
                    let color = stage_from_target(target).map(stage_color);
                    let mut rendered = String::new();
                    {
                        let mut rw = Writer::new(&mut rendered);
                        write!(rw, "{target}: ")?;
                        ctx.format_fields(rw, event)?;
                    }
                    match color {
                        Some(color) => write!(w, "{}", paint(color, ansi, &rendered))?,
                        None => write!(w, "{rendered}")?,
                    }
                }
            }
        }

        if *meta.level() == Level::ERROR {
            write!(writer, "{}", paint(Color::Red, ansi, &body))?;
        } else {
            write!(writer, "{body}")?;
        }

        writeln!(writer)
    }
}
