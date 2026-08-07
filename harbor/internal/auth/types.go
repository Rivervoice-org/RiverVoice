package auth

type CreateAccountRequest struct {
	OrgName     string `json:"organizationName" validate:"required,min=2,max=100"`
	UserName    string `json:"userName"         validate:"required,min=2,max=100"`
	Email       string `json:"email"            validate:"required,email"`
	PhoneNumber string `json:"phoneNumber"      validate:"required,indianmobile"`
	Password    string `json:"password"         validate:"required,min=8,max=72"`
}

type LoginRequest struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// Internal only: the ids go into the token's claims, not the response body.
type account struct {
	userID string
	orgID  string
	role   string
}

type MeResponse struct {
	User MeUser `json:"user"`
	Org  MeOrg  `json:"org"`
}

type MeUser struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone"`
	Role  string `json:"role"`
}

type MeOrg struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
