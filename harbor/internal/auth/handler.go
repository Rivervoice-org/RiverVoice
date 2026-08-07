package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
	"github.com/steverogersX/RiverVoice/harbor/internal/validate"
)

const uniqueViolation = "23505"

var (
	errEmailTaken = errors.New("email already registered")
	errPhoneTaken = errors.New("phone already registered")
)

type Handler struct {
	pool          *pgxpool.Pool
	jwtSecret     []byte
	secureCookies bool
}

func NewHandler(pool *pgxpool.Pool, jwtSecret string, secureCookies bool) *Handler {
	return &Handler{
		pool:          pool,
		jwtSecret:     []byte(jwtSecret),
		secureCookies: secureCookies,
	}
}

func (h *Handler) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/auth/signup", httpx.Handle(h.createAccount))
	mux.HandleFunc("POST /v1/auth/login", httpx.Handle(h.login))
	mux.HandleFunc("POST /v1/auth/logout", httpx.Handle(h.logout))
	mux.Handle("GET /v1/me", h.RequireSession(httpx.Handle(h.me)))
}

func (h *Handler) createAccount(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	var req CreateAccountRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return httpx.Fail[string](http.StatusBadRequest, "The request body is not valid JSON")
	}

	if err := validate.Struct(req); err != nil {
		return httpx.Fail[string](http.StatusBadRequest, validate.FirstMessage(err))
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("hash password: %v", err)
		return httpx.Fail[string](http.StatusInternalServerError, "Could not create the account")
	}

	acc, err := h.insertAccount(r.Context(), req, string(hash))
	switch {
	case errors.Is(err, errEmailTaken):
		return httpx.Fail[string](http.StatusConflict, "That email is already registered")
	case errors.Is(err, errPhoneTaken):
		return httpx.Fail[string](http.StatusConflict, "That phone number is already registered")
	case err != nil:
		log.Printf("create account: %v", err)
		return httpx.Fail[string](http.StatusInternalServerError, "Could not create the account")
	}

	token, err := h.issueToken(acc.userID, acc.orgID, acc.role)
	if err != nil {
		// The account exists, so a retry would only collide with their own email.
		log.Printf("issue token: %v", err)
		return httpx.Fail[string](http.StatusInternalServerError, "Account created, please sign in")
	}

	http.SetCookie(w, h.sessionCookie(token))

	return httpx.Ok(http.StatusCreated, "Account created")
}

func (h *Handler) insertAccount(ctx context.Context, req CreateAccountRequest, hash string) (account, error) {
	var out account

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	if err := tx.QueryRow(ctx,
		`insert into orgs (name) values ($1) returning id::text`,
		strings.TrimSpace(req.OrgName),
	).Scan(&out.orgID); err != nil {
		return out, err
	}

	// No pre-check on email or phone: the unique constraints already answer
	// that, and check-then-insert races two simultaneous signups.
	if err := tx.QueryRow(ctx,
		`insert into users (org_id, email, phone, name, role, password_hash)
		 values ($1, $2, $3, $4, 'owner', $5)
		 returning id::text, role::text`,
		out.orgID,
		strings.TrimSpace(req.Email),
		req.PhoneNumber,
		strings.TrimSpace(req.UserName),
		hash,
	).Scan(&out.userID, &out.role); err != nil {
		return out, asTakenError(err)
	}

	return out, tx.Commit(ctx)
}

func asTakenError(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != uniqueViolation {
		return err
	}
	switch {
	case strings.Contains(pgErr.ConstraintName, "email"):
		return errEmailTaken
	case strings.Contains(pgErr.ConstraintName, "phone"):
		return errPhoneTaken
	}
	return err
}
