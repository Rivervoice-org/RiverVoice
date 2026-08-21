use ferry::{config, http, logging};

#[tokio::main]
async fn main() {
    config::load_dotenv();

    logging::init();
    config::init();

    if let Err(e) = http::router::start_server().await {
        tracing::error!("server error: {e:?}");
        std::process::exit(1);
    }
}
