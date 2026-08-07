package agent

import (
	"net/http"

	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
)

func (h *Handler) readDraft(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func (h *Handler) saveDraft(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func (h *Handler) commit(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}

func (h *Handler) publish(w http.ResponseWriter, r *http.Request) httpx.APIResponse[string] {
	return notImplemented()
}
