use ferry::{config, http, logging};

#[tokio::main]
async fn main() {
    config::load_dotenv();

    // Logging first, so a bad config below has somewhere to report to.
    logging::init();
    config::init();

    if let Err(e) = http::http::start_server().await {
        tracing::error!("server error: {e:?}");
        std::process::exit(1);
    }
}
