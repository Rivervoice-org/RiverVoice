package auth

import (
	"errors"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/steverogersX/RiverVoice/harbor/internal/db"
	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
)

func (h *Handler) me(w http.ResponseWriter, r *http.Request) httpx.APIResponse[MeResponse] {
	session, ok := SessionFrom(r.Context())
	if !ok {
		return httpx.Fail[MeResponse](http.StatusUnauthorized, "Sign in to continue")
	}

	var out MeResponse
	err := db.AsUser(r.Context(), h.pool, session.UserID, func(tx pgx.Tx) error {
		// No org filter: RLS supplies it.
		return tx.QueryRow(r.Context(), `
			select u.id::text, u.name, u.email::text, u.phone, u.role::text,
			       o.id::text, o.name
			  from users u
			  join orgs o on o.id = u.org_id
			 where u.id = app.current_user_id()
		`).Scan(&out.User.ID, &out.User.Name, &out.User.Email, &out.User.Phone, &out.User.Role,
			&out.Org.ID, &out.Org.Name)
	})

	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return httpx.Fail[MeResponse](http.StatusUnauthorized, "Sign in to continue")
	case err != nil:
		log.Printf("me: %v", err)
		return httpx.Fail[MeResponse](http.StatusInternalServerError, "Could not load your account")
	}

	return httpx.Ok(http.StatusOK, out)
}
