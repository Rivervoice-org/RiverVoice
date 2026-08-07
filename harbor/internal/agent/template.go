package agent

import (
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/steverogersX/RiverVoice/harbor/internal/auth"
	"github.com/steverogersX/RiverVoice/harbor/internal/db"
	"github.com/steverogersX/RiverVoice/harbor/internal/dbgen"
	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
)

// The roster everyone starts from. Still behind a session — not because the
// rows are secret, but because there is no reason to serve them to nobody.
func (h *Handler) listTemplates(w http.ResponseWriter, r *http.Request) httpx.APIResponse[[]dbgen.ListAgentTemplatesRow] {
	session, ok := auth.SessionFrom(r.Context())
	if !ok {
		return httpx.Fail[[]dbgen.ListAgentTemplatesRow](http.StatusUnauthorized, "Sign in to continue")
	}

	var out []dbgen.ListAgentTemplatesRow
	err := db.AsUser(r.Context(), h.pool, session.UserID, func(tx pgx.Tx) error {
		var err error
		out, err = dbgen.New(tx).ListAgentTemplates(r.Context())
		return err
	})
	if err != nil {
		log.Printf("list templates: %v", err)
		return httpx.Fail[[]dbgen.ListAgentTemplatesRow](http.StatusInternalServerError, "Could not load the templates")
	}

	return httpx.Ok(http.StatusOK, out)
}
