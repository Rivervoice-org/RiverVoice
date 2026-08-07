package validate

import (
	"errors"
	"reflect"
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
)

// +91 followed by a 10-digit mobile number, which always starts 6-9.
var indianMobile = regexp.MustCompile(`^\+91[6-9]\d{9}$`)

var v = newValidator()

func newValidator() *validator.Validate {
	val := validator.New()

	val.RegisterTagNameFunc(func(f reflect.StructField) string {
		name := strings.Split(f.Tag.Get("json"), ",")[0]
		if name == "-" {
			return ""
		}
		return name
	})

	// The built-in e164 rule accepts any country, and accepts a number with no
	// leading + at all.
	if err := val.RegisterValidation("indianmobile", func(fl validator.FieldLevel) bool {
		return indianMobile.MatchString(fl.Field().String())
	}); err != nil {
		panic(err)
	}

	return val
}

var labels = map[string]string{
	"organizationName": "Company name",
	"userName":         "Your name",
	"email":            "Email",
	"phoneNumber":      "Phone number",
	"password":         "Password",
}

func Struct(s any) error {
	return v.Struct(s)
}

func FirstMessage(err error) string {
	var ve validator.ValidationErrors
	if !errors.As(err, &ve) || len(ve) == 0 {
		return "The request is not valid"
	}

	fe := ve[0]
	label := labels[fe.Field()]
	if label == "" {
		label = fe.Field()
	}

	switch fe.Tag() {
	case "required":
		return label + " is required"
	case "email":
		return "Email is incorrect"
	case "indianmobile":
		return "Enter an Indian mobile number, like +919845022118"
	case "min":
		return label + " must be at least " + fe.Param() + " characters"
	case "max":
		return label + " must be under " + fe.Param() + " characters"
	}
	return label + " is incorrect"
}
