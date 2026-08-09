package agent

import "github.com/steverogersX/RiverVoice/harbor/internal/dbgen"

// What the builder opens with: one version's settings, plus the tools, which
// belong to the agent and so are the same list whichever version you are on.
//
// Embedded rather than nested, so the settings stay flat in the JSON and the
// browser reads agent.voice rather than agent.version.voice.
type AgentDetail struct {
	dbgen.GetAgentRow
	Tools []dbgen.ListAgentToolsRow `json:"tools"`
}

// The query of a board read: which agents, and which slice of them. The bounds
// live here so a search cannot hand Postgres a megabyte to match against, and
// nobody can ask for every row at once.
type ListAgentsRequest struct {
	Search string `json:"q" validate:"omitempty,max=100"`
	Limit  int32  `json:"limit" validate:"gte=1,lte=100"`
	Offset int32  `json:"offset" validate:"gte=0"`
}

// A page of the board, and the size of the whole match rather than of the page
// — that is what the pager counts against. It sits beside the rows because the
// count rides on each one, so an empty page would otherwise carry no total.
type AgentPage struct {
	Agents []dbgen.ListAgentsRow `json:"agents"`
	Total  int64                 `json:"total"`
	Limit  int32                 `json:"limit"`
	Offset int32                 `json:"offset"`
}

// The path and query of a read, checked before anything touches the database.
type GetAgentRequest struct {
	ID string `json:"id" validate:"required,uuid"`
	// Absent means the newest version. Present but unreadable is a mistake worth
	// reporting rather than quietly serving something else.
	Version *int32 `json:"version" validate:"omitnil,gte=1"`
}

type CreateAgentRequest struct {
	Name string `json:"name" validate:"required,min=2,max=100"`
	// A style and seed, like "notionists:Meera". Left empty, the name draws one.
	Mascot string `json:"mascot" validate:"omitempty,max=100"`
}

// The path of a clone. There is no body: everything the new agent starts with
// comes from the template, and the name is settled server-side so taking the
// same template twice cannot collide.
type UseTemplateRequest struct {
	TemplateID string `json:"template_id" validate:"required,uuid"`
}

// The whole of a delete: no body, and no version — a delete takes the agent and
// every version with it, so naming one would be misleading.
type DeleteAgentRequest struct {
	ID string `json:"id" validate:"required,uuid"`
}

// The whole of a clone. No body either: the copy takes its settings, its tools
// and its name from the agent being copied, and the name is settled server-side
// so cloning twice cannot collide.
type CloneAgentRequest struct {
	ID string `json:"id" validate:"required,uuid"`
}

type CreateAgentResponse struct {
	Message string `json:"message"`
	AgentID string `json:"agent_id"`
	// Only set by a clone, where the server chose it — "Front desk 2" when the
	// first one is already on the board.
	Name string `json:"name,omitempty"`
}
