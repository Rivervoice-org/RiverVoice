package main

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// Embedded, so the binary and its schema can never be out of step and there is
// nothing to copy to a server.
//
//go:embed db/migrations/*.sql
var migrations embed.FS

// Runs as the owner, not as app_worker: the application roles own no tables and
// cannot create types, which is what keeps RLS honest.
//
// One instance today, so nothing guards against two of these racing. At more
// than one replica this moves to a deploy step, or takes an advisory lock.
func migrate(ctx context.Context, dsn string) error {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return fmt.Errorf("open: %w", err)
	}
	defer db.Close() //nolint:errcheck // nothing useful to do if a close fails

	goose.SetBaseFS(migrations)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}

	return goose.UpContext(ctx, db, "db/migrations")
}
