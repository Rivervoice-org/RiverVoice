package auth

type CreateAccountRequest struct {
	OrgName     string `json:"organizationName" validate:"required,min=2,max=100"`
	UserName    string `json:"userName"         validate:"required,min=2,max=100"`
	Email       string `json:"email"            validate:"required,email"`
	PhoneNumber string `json:"phoneNumber"      validate:"required,indianmobile"`
	Password    string `json:"password"         validate:"required,min=8,max=72"`
}

type CreateAccountResponse struct {
	UserID string `json:"userId"`
	OrgID  string `json:"orgId"`
	Role   string `json:"role"`
}
