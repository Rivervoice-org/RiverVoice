package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/steverogersX/RiverVoice/harbor/internal/agent"
	"github.com/steverogersX/RiverVoice/harbor/internal/auth"
	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Repo root first, so one .env serves compose and every service. Missing is
	// fine: deployed environments set real variables.
	_ = godotenv.Load("../.env", ".env")

	pool, err := pgxpool.New(ctx, mustEnv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return err
	}

	// Plain http locally, where a Secure cookie would be dropped.
	secureCookies := envOr("COOKIE_SECURE", "true") != "false"

	sessions := auth.NewHandler(pool, mustEnv("JWT_SECRET"), secureCookies)

	router := httpx.NewRouter(pool,
		sessions,
		agent.NewHandler(pool, sessions),
	)

	origins := strings.Split(envOr("WEB_ORIGIN", "http://localhost:3000"), ",")
	handler := httpx.CORS(origins)(router)

	return httpx.Serve(ctx, ":"+envOr("PORT", "8080"), handler)
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s is required", key)
	}
	return v
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
