package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

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

	if err := migrate(ctx, mustEnv("MIGRATE_DATABASE_URL")); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	pool, err := pgxpool.New(ctx, mustEnv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()

	// Bounded, or an unreachable database leaves the process silent instead of
	// telling you what is wrong.
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		return fmt.Errorf("database unreachable: %w", err)
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
