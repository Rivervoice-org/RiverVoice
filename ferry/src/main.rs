use ferry::http;
use ferry::logging::ColorEventFormatter;

#[tokio::main]
async fn main() {
    // rustls 0.23 no longer auto-selects a crypto backend; without this,
    // the first outbound wss:// connection (e.g. to an STT vendor) panics.
    // Must run before anything opens a TLS connection.
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("failed to install rustls crypto provider");

    // Repo root first, so one .env serves compose and every service. Missing
    // is fine: deployed environments set real variables.
    let _ = dotenvy::from_filename("../.env");
    let _ = dotenvy::dotenv();

    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    // Colored, human-shaped lines for a local terminal; structured JSON
    // once deployed, so log platforms (CloudWatch, Loki, ...) get real
    // queryable fields instead of ANSI escapes baked into a string.
    if std::env::var("LOG_FORMAT").as_deref() == Ok("json") {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(filter)
            .init();
    } else {
        tracing_subscriber::fmt()
            .event_format(ColorEventFormatter)
            .with_env_filter(filter)
            .init();
    }

    if let Err(e) = http::http::start_server().await {
        tracing::error!("server error: {e:?}");
        std::process::exit(1);
    }
}
