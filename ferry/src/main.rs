use ferry::{config, db, http, logging};

/// On Windows the console decodes stdout bytes with its output codepage
/// (437/850/936...) unless told otherwise, and Rust writes UTF-8 regardless.
/// Pinning it to 65001 keeps non-ASCII transcripts readable no matter what
/// shell launched `cargo run` — no `chcp 65001` needed in front.
///
/// The second half is the font: the default console font (Cascadia Mono /
/// Consolas) has no Telugu glyphs, so clean UTF-8 bytes still render as tofu
/// boxes. Swapping the console font to Nirmala UI — which ships with Windows
/// and covers Telugu, Devanagari, Tamil, etc. — makes any script legible.
/// Both are per-console, so the user never has to run a command themselves.
#[cfg(windows)]
fn setup_console() {
    use windows_sys::Win32::System::Console::{
        CONSOLE_FONT_INFOEX, GetCurrentConsoleFontEx, GetStdHandle, STD_OUTPUT_HANDLE,
        SetConsoleOutputCP, SetCurrentConsoleFontEx,
    };

    const CP_UTF8: u32 = 65001;
    const LF_FACESIZE: usize = 32;

    unsafe {
        SetConsoleOutputCP(CP_UTF8);

        let handle = GetStdHandle(STD_OUTPUT_HANDLE);
        let mut info: CONSOLE_FONT_INFOEX = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<CONSOLE_FONT_INFOEX>() as u32;
        if GetCurrentConsoleFontEx(handle, 0, &mut info) != 0 {
            let name = "Nirmala UI\0";
            let bytes = name.encode_utf16();
            for (slot, unit) in info.FaceName.iter_mut().zip(bytes) {
                *slot = unit;
            }
            SetCurrentConsoleFontEx(handle, 0, &info);
        }
    }
}

#[tokio::main]
async fn main() {
    #[cfg(windows)]
    setup_console();

    config::load_dotenv();

    logging::init();
    config::init();

    if let Err(e) = db::db::init().await {
        tracing::error!("failed to connect to database: {e:?}");
        std::process::exit(1);
    }

    if let Err(e) = http::http::start_server().await {
        tracing::error!("server error: {e:?}");
        std::process::exit(1);
    }
}
