pub struct ApiError {
    message: String,
}

pub struct ApiResponse<T> {
    status: u32,
    data: Option<T>,
    error: Option<ApiError>,
}


