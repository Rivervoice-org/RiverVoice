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

type CreateAgentResponse struct {
	Message string `json:"message"`
	AgentID string `json:"agent_id"`
}
