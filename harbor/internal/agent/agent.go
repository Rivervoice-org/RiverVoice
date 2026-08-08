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
	"github.com/steverogersX/RiverVoice/harbor/internal/dbgen"
	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
	"github.com/steverogersX/RiverVoice/harbor/internal/validate"
)

func (h *Handler) list(w http.ResponseWriter, r *http.Request) httpx.APIResponse[[]dbgen.ListAgentsRow] {
	session, ok := auth.SessionFrom(r.Context())
	if !ok {
		return httpx.Fail[[]dbgen.ListAgentsRow](http.StatusUnauthorized, "Sign in to continue")
	}

	var out []dbgen.ListAgentsRow
	err := db.AsUser(r.Context(), h.pool, session.UserID, func(tx pgx.Tx) error {
		var err error
		out, err = dbgen.New(tx).ListAgents(r.Context())
		return err
	})
	if err != nil {
		log.Printf("list agents: %v", err)
		return httpx.Fail[[]dbgen.ListAgentsRow](http.StatusInternalServerError, "Could not load your agents")
	}

	return httpx.Ok(http.StatusOK, out)
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
		q := dbgen.New(tx)

		var err error
		id, err = q.CreateAgent(r.Context(), dbgen.CreateAgentParams{
			Name:   strings.TrimSpace(req.Name),
			Mascot: strings.TrimSpace(req.Mascot),
		})
		if err != nil {
			return asNameTaken(err)
		}

		return q.CreateFirstVersion(r.Context(), id)
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

// Taking a template is a clone, not a reference: the new agent keeps nothing
// pointing at the roster, so editing it later cannot change anybody else's, and
// a template we retire cannot take working agents down with it.
func (h *Handler) useTemplate(w http.ResponseWriter, r *http.Request) httpx.APIResponse[CreateAgentResponse] {
	session, ok := auth.SessionFrom(r.Context())
	if !ok {
		return httpx.Fail[CreateAgentResponse](http.StatusUnauthorized, "Sign in to continue")
	}

	req := UseTemplateRequest{TemplateID: r.PathValue("id")}

	// An id that is not a uuid cannot name a template, so it is the same 404 as
	// one that names nothing — and it never reaches Postgres.
	if err := validate.Struct(req); err != nil {
		return httpx.Fail[CreateAgentResponse](http.StatusNotFound, "No such template")
	}

	var id, name string
	err := db.AsUser(r.Context(), h.pool, session.UserID, func(tx pgx.Tx) error {
		q := dbgen.New(tx)

		// The one read that decides whether this is a template at all. Everything
		// after it is a write, so a bad id fails before anything is created.
		templateName, err := q.GetTemplateName(r.Context(), req.TemplateID)
		if err != nil {
			return err
		}

		// Taking the same template twice is ordinary, so the second one is named
		// rather than refused.
		name, err = q.FreeAgentName(r.Context(), templateName)
		if err != nil {
			return asNameTaken(err)
		}

		id, err = q.CloneTemplateAgent(r.Context(), dbgen.CloneTemplateAgentParams{
			Name:       name,
			TemplateID: req.TemplateID,
		})
		if err != nil {
			return asNameTaken(err)
		}

		// One transaction for all three: an agent with no version is something the
		// builder cannot open, and half-copied tools are worse than none.
		if err := q.CloneTemplateVersion(r.Context(), dbgen.CloneTemplateVersionParams{
			AgentID:    id,
			TemplateID: req.TemplateID,
		}); err != nil {
			return err
		}

		return q.CloneTemplateTools(r.Context(), dbgen.CloneTemplateToolsParams{
			AgentID:    id,
			TemplateID: req.TemplateID,
		})
	})

	switch {
	case isNotFound(err):
		return httpx.Fail[CreateAgentResponse](http.StatusNotFound, "No such template")
	case errors.Is(err, errNameTaken):
		return httpx.Fail[CreateAgentResponse](http.StatusConflict, "You already have an agent with that name")
	case err != nil:
		log.Printf("use template %s: %v", req.TemplateID, err)
		return httpx.Fail[CreateAgentResponse](http.StatusInternalServerError, "Could not create the agent")
	}

	return httpx.Ok(http.StatusCreated, CreateAgentResponse{
		Message: "Agent created from template",
		AgentID: id,
		Name:    name,
	})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) httpx.APIResponse[AgentDetail] {
	session, ok := auth.SessionFrom(r.Context())
	if !ok {
		return httpx.Fail[AgentDetail](http.StatusUnauthorized, "Sign in to continue")
	}

	version, err := readVersion(r.URL.Query().Get("version"))
	if err != nil {
		return httpx.Fail[AgentDetail](http.StatusBadRequest, "Version must be a number")
	}

	req := GetAgentRequest{ID: r.PathValue("id"), Version: version}

	// An id that is not a uuid cannot name an agent, so it is the same 404 as one
	// that names nobody's — and it never reaches Postgres.
	if err := validate.Struct(req); err != nil {
		if validate.FirstTag(err) == "uuid" {
			return httpx.Fail[AgentDetail](http.StatusNotFound, "No such agent")
		}
		return httpx.Fail[AgentDetail](http.StatusBadRequest, validate.FirstMessage(err))
	}

	var out AgentDetail
	err = db.AsUser(r.Context(), h.pool, session.UserID, func(tx pgx.Tx) error {
		q := dbgen.New(tx)

		var err error
		out.GetAgentRow, err = q.GetAgent(r.Context(), dbgen.GetAgentParams{
			ID:      req.ID,
			Version: req.Version,
		})
		if err != nil {
			return err
		}

		// Same transaction, so the tools cannot be from a moment after the agent.
		out.Tools, err = q.ListAgentTools(r.Context(), req.ID)
		return err
	})

	switch {
	case isNotFound(err):
		return httpx.Fail[AgentDetail](http.StatusNotFound, "No such agent")
	case err != nil:
		log.Printf("get agent: %v", err)
		return httpx.Fail[AgentDetail](http.StatusInternalServerError, "Could not load the agent")
	}

	return httpx.Ok(http.StatusOK, out)
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
