package auth

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
	"github.com/steverogersX/RiverVoice/harbor/internal/validate"
)

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

func (h *Handler) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/auth/signup", httpx.Handle(h.createAccount))
}

func (h *Handler) createAccount(r *http.Request) httpx.APIResponse[string] {
	var req CreateAccountRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return httpx.Fail[string](http.StatusBadRequest, "The request body is not valid JSON")
	}

	if err := validate.Struct(req); err != nil {
		return httpx.Fail[string](http.StatusBadRequest, validate.FirstMessage(err))
	}

	// h.pool is the database handle from here on.

	// 1. Have to check the whether email was already in db or not.
	// if yes then throw err

	// 2. check hte phonumber. if yes, throw error

	// 3. then save the user into db.

	// 4. creates the jwt and put in res cookies. httponly

	return httpx.Ok(http.StatusOK, "OKAY")
}
