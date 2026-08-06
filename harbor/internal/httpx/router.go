package httpx

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type APIFunc[T any] func(*http.Request) APIResponse[T]

func Handle[T any](fn APIFunc[T]) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res := fn(r)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(res.StatusCode)
		if err := json.NewEncoder(w).Encode(res); err != nil {
			log.Printf("write response: %v", err)
		}
	}
}

// RouteGroup is one domain's set of routes. Passing them in keeps httpx from
// importing auth, agent and the rest, which would be an import cycle.
type RouteGroup interface {
	Routes(*http.ServeMux)
}

func NewRouter(pool *pgxpool.Pool, groups ...RouteGroup) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		if err := pool.Ping(r.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	for _, g := range groups {
		g.Routes(mux)
	}

	return mux
}
