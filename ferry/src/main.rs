mod http;

#[tokio::main]
async fn main() {
    if let Err(e) = http::http::start_server().await {
        eprintln!("server error: {e}");
        std::process::exit(1);
    }
}
