package agent

import (
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

const uniqueViolation = "23505"

var errNameTaken = errors.New("agent name already used")

func asNameTaken(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation &&
		strings.Contains(pgErr.ConstraintName, "name") {
		return errNameTaken
	}
	return err
}
