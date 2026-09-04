use ferry::{config, db, http, logging};

#[tokio::main]
async fn main() {
    logging::init();

    config::load_dotenv();
    config::init();
    db::init().await;

    if let Err(e) = http::router::start_server().await {
        tracing::error!("server error: {e:?}");
        std::process::exit(1);
    }
}
