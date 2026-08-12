mod audio;
mod auth;
mod frames;
mod http;
mod pipeline;
mod processor;
mod serializer;
mod stages;
mod transport;

#[tokio::main]
async fn main() {
    // Repo root first, so one .env serves compose and every service. Missing
    // is fine: deployed environments set real variables.
    let _ = dotenvy::from_filename("../.env");
    let _ = dotenvy::dotenv();

    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    if let Err(e) = http::http::start_server().await {
        tracing::error!("server error: {e:?}");
        std::process::exit(1);
    }
}
