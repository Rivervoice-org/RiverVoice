use ferry::{config, db, http, logging};

#[tokio::main]
async fn main() {
    config::load_dotenv();

    logging::init();
    config::init();
    db::init().await;

    if let Err(e) = http::router::start_server().await {
        tracing::error!("server error: {e:?}");
        std::process::exit(1);
    }
}
