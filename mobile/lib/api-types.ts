/** Mirrors ferry/src/http/response.rs ApiError. */
export type ApiError = {
  message: string;
};

/** Shape of every response ferry sends (see ferry/src/http/response.rs ApiResponse). */
export type ApiResponse<T> = {
  statusCode: number;
  data?: T;
  error?: ApiError;
};
