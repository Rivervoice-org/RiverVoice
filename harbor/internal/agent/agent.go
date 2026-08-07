package agent

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/steverogersX/RiverVoice/harbor/internal/auth"
	"github.com/steverogersX/RiverVoice/harbor/internal/db"
	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
	"github.com/steverogersX/RiverVoice/harbor/internal/validate"
)

func (h *Handler) list(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) httpx.APIResponse[CreateAgentResponse] {
	session, ok := auth.SessionFrom(r.Context())
	if !ok {
		return httpx.Fail[CreateAgentResponse](http.StatusUnauthorized, "Sign in to continue")
	}

	var req CreateAgentRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return httpx.Fail[CreateAgentResponse](http.StatusBadRequest, "The request body is not valid JSON")
	}

	if err := validate.Struct(req); err != nil {
		return httpx.Fail[CreateAgentResponse](http.StatusBadRequest, validate.FirstMessage(err))
	}

	var id string
	err := db.AsUser(r.Context(), h.pool, session.UserID, func(tx pgx.Tx) error {
		var err error
		id, err = insertAgent(r.Context(), tx, strings.TrimSpace(req.Name), strings.TrimSpace(req.Mascot))
		return err
	})

	switch {
	case errors.Is(err, errNameTaken):
		return httpx.Fail[CreateAgentResponse](http.StatusConflict, "You already have an agent with that name")
	case err != nil:
		log.Printf("create agent: %v", err)
		return httpx.Fail[CreateAgentResponse](http.StatusInternalServerError, "Could not create the agent")
	}

	return httpx.Ok(http.StatusCreated, CreateAgentResponse{
		Message: "Agent created",
		AgentID: id,
	})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func (h *Handler) rename(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func notImplemented() httpx.APIResponse[string] {
	return httpx.Fail[string](http.StatusNotImplemented, "Not built yet")
}
