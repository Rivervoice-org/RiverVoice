package agent

import (
	"net/http"

	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
)

func (h *Handler) listTools(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func (h *Handler) addTool(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func (h *Handler) updateTool(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func (h *Handler) removeTool(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}
