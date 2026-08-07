package agent

import (
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	uniqueViolation = "23505"
	invalidText     = "22P02"
)

var errNameTaken = errors.New("agent name already used")

// A uuid nobody owns and a uuid in another org are the same answer: there is no
// such agent here. Anything else would confirm it exists.
func isNotFound(err error) bool {
	if errors.Is(err, pgx.ErrNoRows) {
		return true
	}
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == invalidText
}

var errBadVersion = errors.New("version is not a number")

// Absent means the newest version. Present and unreadable is a caller mistake,
// so it is reported rather than quietly serving something else.
func readVersion(raw string) (*int32, error) {
	if raw == "" {
		return nil, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return nil, errBadVersion
	}
	v := int32(n)
	return &v, nil
}

func asNameTaken(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation &&
		strings.Contains(pgErr.ConstraintName, "name") {
		return errNameTaken
	}
	return err
}
