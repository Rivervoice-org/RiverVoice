mod config;
mod http;
mod retry;
mod state;
mod twilio;
mod telephony;

#[tokio::main]
async fn main() {
    // Loads .env if present; real env vars still win.
    let _ = dotenvy::dotenv();

    if let Err(e) = http::http::start_server().await {
        eprintln!("server error: {e}");
        std::process::exit(1);
    }
}
