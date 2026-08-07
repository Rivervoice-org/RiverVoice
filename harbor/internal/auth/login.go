package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
	"github.com/steverogersX/RiverVoice/harbor/internal/validate"
)

// Compared against when no user matches, so response time does not reveal
// which addresses are registered.
var dummyHash = []byte("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")

const badCredentials = "Email or password is incorrect"

func (h *Handler) login(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	var req LoginRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return httpx.Fail[string](http.StatusBadRequest, "The request body is not valid JSON")
	}

	if err := validate.Struct(req); err != nil {
		return httpx.Fail[string](http.StatusBadRequest, validate.FirstMessage(err))
	}

	acc, hash, err := h.findByEmail(r.Context(), strings.TrimSpace(req.Email))
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		log.Printf("login lookup: %v", err)
		return httpx.Fail[string](http.StatusInternalServerError, "Could not sign you in")
	}

	if errors.Is(err, pgx.ErrNoRows) {
		bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password)) //nolint:errcheck // timing only
		return httpx.Fail[string](http.StatusUnauthorized, badCredentials)
	}

	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		return httpx.Fail[string](http.StatusUnauthorized, badCredentials)
	}

	token, err := h.issueToken(acc.userID, acc.orgID, acc.role)
	if err != nil {
		log.Printf("issue token: %v", err)
		return httpx.Fail[string](http.StatusInternalServerError, "Could not sign you in")
	}

	http.SetCookie(w, h.sessionCookie(token))

	return httpx.Ok(http.StatusOK, "Signed in")
}

// On the pool as app_worker, not db.AsUser: there is no session yet, so RLS
// would match zero rows.
func (h *Handler) findByEmail(ctx context.Context, email string) (account, string, error) {
	var acc account
	var hash string

	err := h.pool.QueryRow(ctx,
		`select id::text, org_id::text, role::text, password_hash
		   from users
		  where email = $1`,
		email,
	).Scan(&acc.userID, &acc.orgID, &acc.role, &hash)

	return acc, hash, err
}
