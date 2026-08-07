package agent

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const uniqueViolation = "23505"

var errNameTaken = errors.New("agent name already used")

// A new agent arrives with an empty v1 draft, so the builder always has a
// version to write settings into.
func insertAgent(ctx context.Context, tx pgx.Tx, name, mascot string) (string, error) {
	var id string

	// org_id and created_by come from the session Postgres already has, rather
	// than from the token, so a forged claim cannot place a row elsewhere.
	// An unpicked mascot stays null, which is what makes the name draw one.
	if err := tx.QueryRow(ctx, `
		insert into agents (org_id, name, mascot, created_by)
		values (app.current_org_id(), $1, nullif($2, ''), app.current_user_id())
		returning id::text
	`, name, mascot).Scan(&id); err != nil {
		return "", asNameTaken(err)
	}

	_, err := tx.Exec(ctx, `
		insert into agent_versions (agent_id, org_id, version, state)
		values ($1, app.current_org_id(), 1, 'draft')
	`, id)

	return id, err
}

func asNameTaken(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation &&
		strings.Contains(pgErr.ConstraintName, "name") {
		return errNameTaken
	}
	return err
}
