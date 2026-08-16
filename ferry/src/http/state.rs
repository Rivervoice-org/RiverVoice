use diesel_async::AsyncPgConnection;
use diesel_async::pooled_connection::deadpool::Pool;

use crate::auth::token::Session;

#[derive(Clone)]
pub struct AppState {
    pub session: Session,
    pub pool: Pool<AsyncPgConnection>,
}
