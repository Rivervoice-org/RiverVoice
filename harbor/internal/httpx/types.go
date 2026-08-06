package httpx

type APIError struct {
	Message string `json:"message"`
}

type APIResponse[T any] struct {
	StatusCode int       `json:"statusCode"`
	Data       *T        `json:"data,omitempty"`
	Error      *APIError `json:"error,omitempty"`
}

func Ok[T any](statusCode int, data T) APIResponse[T] {
	return APIResponse[T]{
		StatusCode: statusCode,
		Data:       &data,
	}
}

func Fail[T any](statusCode int, message string) APIResponse[T] {
	return APIResponse[T]{
		StatusCode: statusCode,
		Error:      &APIError{Message: message},
	}
}
