package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AsUser runs fn in a transaction scoped to userID, so RLS filters every query
// inside it to that user's org.
//
// Both settings are transaction-local: a session-scoped one would leak onto
// whoever borrows the connection next. SET ROLE matters as much as the
// identity, since the pool connects as app_worker, which has BYPASSRLS.
func AsUser(ctx context.Context, pool *pgxpool.Pool, userID string, fn func(pgx.Tx) error) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	if _, err := tx.Exec(ctx, "select set_config('app.user_id', $1, true)", userID); err != nil {
		return fmt.Errorf("set identity: %w", err)
	}
	if _, err := tx.Exec(ctx, "set local role app_user"); err != nil {
		return fmt.Errorf("set role: %w", err)
	}

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
