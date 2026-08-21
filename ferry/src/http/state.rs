use crate::auth::token::Session;

#[derive(Clone)]
pub struct AppState {
    pub session: Session,
}
