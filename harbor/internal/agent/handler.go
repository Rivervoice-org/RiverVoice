package agent

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/steverogersX/RiverVoice/harbor/internal/auth"
	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
)

type Handler struct {
	pool     *pgxpool.Pool
	sessions *auth.Handler
}

func NewHandler(pool *pgxpool.Pool, sessions *auth.Handler) *Handler {
	return &Handler{pool: pool, sessions: sessions}
}

func (h *Handler) Routes(mux *http.ServeMux) {
	h.guard(mux, "GET /v1/agent-templates", httpx.Handle(h.listTemplates))

	h.guard(mux, "GET /v1/agents", httpx.Handle(h.list))
	h.guard(mux, "POST /v1/agents", httpx.Handle(h.create))
	h.guard(mux, "GET /v1/agents/{id}", httpx.Handle(h.get))
	h.guard(mux, "PATCH /v1/agents/{id}", httpx.Handle(h.rename))
	h.guard(mux, "DELETE /v1/agents/{id}", httpx.Handle(h.remove))

	h.guard(mux, "GET /v1/agents/{id}/draft", httpx.Handle(h.readDraft))
	h.guard(mux, "PATCH /v1/agents/{id}/draft", httpx.Handle(h.saveDraft))
	h.guard(mux, "POST /v1/agents/{id}/commit", httpx.Handle(h.commit))
	h.guard(mux, "POST /v1/agents/{id}/publish", httpx.Handle(h.publish))

	h.guard(mux, "GET /v1/agents/{id}/tools", httpx.Handle(h.listTools))
	h.guard(mux, "POST /v1/agents/{id}/tools", httpx.Handle(h.addTool))
	h.guard(mux, "PATCH /v1/agents/{id}/tools/{toolID}", httpx.Handle(h.updateTool))
	h.guard(mux, "DELETE /v1/agents/{id}/tools/{toolID}", httpx.Handle(h.removeTool))
}

func (h *Handler) guard(mux *http.ServeMux, pattern string, next http.Handler) {
	mux.Handle(pattern, h.sessions.RequireSession(next))
}
