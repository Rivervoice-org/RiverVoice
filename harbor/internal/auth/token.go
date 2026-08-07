package auth

import (
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	sessionCookieName = "rv_session"
	tokenTTL          = 24 * time.Hour
)

// Claims carry the tenant so a request can be scoped without reading users
// first. They go stale: a user demoted from owner keeps the old role until the
// token expires.
type Claims struct {
	OrgID string `json:"org"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

func (h *Handler) issueToken(userID, orgID, role string) (string, error) {
	now := time.Now()
	claims := Claims{
		OrgID: orgID,
		Role:  role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(h.jwtSecret)
}

// HttpOnly is what stops an XSS bug from becoming a stolen session.
func (h *Handler) sessionCookie(token string) *http.Cookie {
	return &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(tokenTTL.Seconds()),
		HttpOnly: true,
		Secure:   h.secureCookies,
		SameSite: http.SameSiteLaxMode,
	}
}
