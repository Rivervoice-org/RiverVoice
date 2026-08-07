package auth

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/golang-jwt/jwt/v5"

	"github.com/steverogersX/RiverVoice/harbor/internal/httpx"
)

type sessionKey struct{}

type Session struct {
	UserID string
	OrgID  string
	Role   string
}

// SessionFrom returns the caller. False on any route not behind RequireSession.
func SessionFrom(ctx context.Context) (Session, bool) {
	s, ok := ctx.Value(sessionKey{}).(Session)
	return s, ok
}

func (h *Handler) RequireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil {
			unauthorized(w)
			return
		}

		session, err := h.verifyToken(cookie.Value)
		if err != nil {
			unauthorized(w)
			return
		}

		ctx := context.WithValue(r.Context(), sessionKey{}, session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *Handler) verifyToken(token string) (Session, error) {
	var claims Claims

	// Pinning the method is what stops an alg=none forgery, and requiring exp
	// stops a token that never dies.
	parsed, err := jwt.ParseWithClaims(token, &claims, func(*jwt.Token) (any, error) {
		return h.jwtSecret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithExpirationRequired())
	if err != nil {
		return Session{}, err
	}
	if !parsed.Valid || claims.Subject == "" || claims.OrgID == "" {
		return Session{}, jwt.ErrTokenInvalidClaims
	}

	return Session{
		UserID: claims.Subject,
		OrgID:  claims.OrgID,
		Role:   claims.Role,
	}, nil
}

func unauthorized(w http.ResponseWriter) {
	res := httpx.Fail[string](http.StatusUnauthorized, "Sign in to continue")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(res.StatusCode)
	if err := json.NewEncoder(w).Encode(res); err != nil {
		log.Printf("write response: %v", err)
	}
}
