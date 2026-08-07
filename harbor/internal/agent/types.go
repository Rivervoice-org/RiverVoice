package agent

type CreateAgentRequest struct {
	Name string `json:"name" validate:"required,min=2,max=100"`
	// A style and seed, like "notionists:Meera". Left empty, the name draws one.
	Mascot string `json:"mascot" validate:"omitempty,max=100"`
}

type CreateAgentResponse struct {
	Message string `json:"message"`
	AgentID string `json:"agent_id"`
}
