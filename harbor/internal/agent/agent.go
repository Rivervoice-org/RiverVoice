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

// One page of the board, narrowed by name when the caller asks. The search and
// the paging are the database's work rather than the browser's: filtering a
// page the browser already holds can only find what happens to be on it.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) httpx.APIResponse[AgentPage] {
	session, ok := auth.SessionFrom(r.Context())
	if !ok {
		return httpx.Fail[AgentPage](http.StatusUnauthorized, "Sign in to continue")
	}

	limit, offset, err := readPaging(r.URL.Query())
	if err != nil {
		return httpx.Fail[AgentPage](http.StatusBadRequest, "Limit and offset must be whole numbers")
	}

	req := ListAgentsRequest{
		Search: strings.TrimSpace(r.URL.Query().Get("q")),
		Limit:  limit,
		Offset: offset,
	}

	if err := validate.Struct(req); err != nil {
		return httpx.Fail[AgentPage](http.StatusBadRequest, validate.FirstMessage(err))
	}

	var rows []dbgen.ListAgentsRow
	err = db.AsUser(r.Context(), h.pool, session.UserID, func(tx pgx.Tx) error {
		var err error
		rows, err = dbgen.New(tx).ListAgents(r.Context(), dbgen.ListAgentsParams{
			Search:     req.Search,
			PageSize:   req.Limit,
			PageOffset: req.Offset,
		})
		return err
	})
	if err != nil {
		log.Printf("list agents: %v", err)
		return httpx.Fail[AgentPage](http.StatusInternalServerError, "Could not load your agents")
	}

	out := AgentPage{Agents: rows, Limit: req.Limit, Offset: req.Offset}

	// The window count rides on every row, so it is only there when a row is.
	// Past the last page that is correct: no matches to count from here.
	if len(rows) > 0 {
		out.Total = rows[0].Total
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

// Cloning one of your own, which is the same shape as taking a template: read
// the name, find a free one, then copy the row, its newest settings and its
// tools. A copy rather than a link, so editing it cannot change the original.
func (h *Handler) clone(w http.ResponseWriter, r *http.Request) httpx.APIResponse[CreateAgentResponse] {
	session, ok := auth.SessionFrom(r.Context())
	if !ok {
		return httpx.Fail[CreateAgentResponse](http.StatusUnauthorized, "Sign in to continue")
	}

	req := CloneAgentRequest{ID: r.PathValue("id")}

	// An id that is not a uuid cannot name an agent, so it is the same 404 as one
	// that names nobody's — and it never reaches Postgres.
	if err := validate.Struct(req); err != nil {
		return httpx.Fail[CreateAgentResponse](http.StatusNotFound, "No such agent")
	}

	var id, name string
	err := db.AsUser(r.Context(), h.pool, session.UserID, func(tx pgx.Tx) error {
		q := dbgen.New(tx)

		// The one read, and the only thing between the caller and a copy. What
		// follows is all writes, so a bad id fails before anything is created.
		from, err := q.GetAgentName(r.Context(), req.ID)
		if err != nil {
			return err
		}

		// "Front desk 2". Cloning is meant to be repeatable, so the second one is
		// named rather than refused by the unique (org_id, name).
		name, err = q.FreeAgentName(r.Context(), from)
		if err != nil {
			return asNameTaken(err)
		}

		id, err = q.CloneAgentRow(r.Context(), dbgen.CloneAgentRowParams{
			Name:     name,
			SourceID: req.ID,
		})
		if err != nil {
			return asNameTaken(err)
		}

		// One transaction for all three: an agent with no version is something the
		// builder cannot open, and half-copied tools are worse than none.
		if err := q.CloneAgentVersion(r.Context(), dbgen.CloneAgentVersionParams{
			AgentID:  id,
			SourceID: req.ID,
		}); err != nil {
			return err
		}

		return q.CloneAgentTools(r.Context(), dbgen.CloneAgentToolsParams{
			AgentID:  id,
			SourceID: req.ID,
		})
	})

	switch {
	case isNotFound(err):
		return httpx.Fail[CreateAgentResponse](http.StatusNotFound, "No such agent")
	case errors.Is(err, errNameTaken):
		return httpx.Fail[CreateAgentResponse](http.StatusConflict, "You already have an agent with that name")
	case err != nil:
		log.Printf("clone agent %s: %v", req.ID, err)
		return httpx.Fail[CreateAgentResponse](http.StatusInternalServerError, "Could not clone the agent")
	}

	return httpx.Ok(http.StatusCreated, CreateAgentResponse{
		Message: "Agent cloned",
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

// One statement: the versions and the tools go with it on their cascades.
func (h *Handler) remove(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	session, ok := auth.SessionFrom(r.Context())
	if !ok {
		return httpx.Fail[string](http.StatusUnauthorized, "Sign in to continue")
	}

	req := DeleteAgentRequest{ID: r.PathValue("id")}

	// An id that is not a uuid cannot name an agent, so it is the same 404 as one
	// that names nobody's — and it never reaches Postgres.
	if err := validate.Struct(req); err != nil {
		return httpx.Fail[string](http.StatusNotFound, "No such agent")
	}

	var deleted int64
	err := db.AsUser(r.Context(), h.pool, session.UserID, func(tx pgx.Tx) error {
		var err error
		deleted, err = dbgen.New(tx).DeleteAgent(r.Context(), req.ID)
		return err
	})

	switch {
	case isNotFound(err):
		return httpx.Fail[string](http.StatusNotFound, "No such agent")
	case err != nil:
		log.Printf("delete agent %s: %v", req.ID, err)
		return httpx.Fail[string](http.StatusInternalServerError, "Could not delete the agent")
	// RLS hides another org's agent rather than refusing it, so "nothing deleted"
	// and "nothing there" arrive as the same answer. It has to be a 404 rather
	// than a cheerful 200, or the board would drop a row that still exists.
	case deleted == 0:
		return httpx.Fail[string](http.StatusNotFound, "No such agent")
	}

	return httpx.Ok(http.StatusOK, "Agent deleted")
}

func notImplemented() httpx.APIResponse[string] {
	return httpx.Fail[string](http.StatusNotImplemented, "Not built yet")
}
