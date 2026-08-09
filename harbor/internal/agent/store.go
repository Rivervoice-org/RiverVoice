package agent

import (
	"errors"
	"net/url"
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

// A board read with no paging is the first page, sized so an org that has never
// thought about it still gets a bounded query.
const defaultPageSize = 20

var errBadPaging = errors.New("limit and offset are not numbers")

// Absent means the first page at the default size. Present and unreadable is a
// caller mistake, so it is reported rather than quietly serving another page —
// silently ignoring a bad offset would show page one and call it page nine.
func readPaging(query url.Values) (limit int32, offset int32, err error) {
	limit, err = readInt32(query.Get("limit"), defaultPageSize)
	if err != nil {
		return 0, 0, err
	}

	offset, err = readInt32(query.Get("offset"), 0)
	if err != nil {
		return 0, 0, err
	}

	return limit, offset, nil
}

func readInt32(raw string, fallback int32) (int32, error) {
	if raw == "" {
		return fallback, nil
	}

	n, err := strconv.Atoi(raw)
	if err != nil {
		return 0, errBadPaging
	}

	return int32(n), nil
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
