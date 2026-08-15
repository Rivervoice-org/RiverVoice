use ferry::{config, db, http, logging};

#[tokio::main]
async fn main() {
    config::load_dotenv();

    // Logging first, so a bad config below has somewhere to report to.
    logging::init();
    config::init();

    if let Err(e) = db::init().await {
        tracing::error!("failed to connect to database: {e:?}");
        std::process::exit(1);
    }

    if let Err(e) = http::http::start_server().await {
        tracing::error!("server error: {e:?}");
        std::process::exit(1);
    }
}
