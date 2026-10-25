package booking

import (
	"errors"
	"net/mail"
	"strings"
)

var ErrInvalidContact = errors.New("booking: invalid contact")

// ContactError is safe to return to an API caller. Never include the raw contact.
type ContactError struct{ Message string }

func (e *ContactError) Error() string { return e.Message }
func (e *ContactError) Unwrap() error { return ErrInvalidContact }

func contactError(message string) error { return &ContactError{Message: message} }

// NormalizeContact validates both supplied channels and resolves the primary one.
// Phone is contact information, independent of the appointment's location.
func NormalizeContact(a Attendee) (Attendee, error) {
	a.Name = strings.TrimSpace(a.Name)
	a.Email = strings.TrimSpace(a.Email)
	a.Phone = strings.TrimSpace(a.Phone)
	if a.Name == "" {
		return a, contactError("name is required")
	}
	if a.Email != "" {
		if len(a.Email) > 320 {
			return a, contactError("email must be a valid email address")
		}
		address, err := mail.ParseAddress(a.Email)
		if err != nil {
			return a, contactError("email must be a valid email address")
		}
		a.Email = address.Address
	}
	if a.Phone != "" {
		if len(a.Phone) > 64 {
			return a, contactError("contact_phone must be an international number, e.g. +77011234567")
		}
		var number strings.Builder
		for i, c := range a.Phone {
			switch {
			case c == '+' && i == 0:
				number.WriteRune(c)
			case c >= '0' && c <= '9':
				number.WriteRune(c)
			case c == ' ' || c == '-' || c == '(' || c == ')' || c == '.':
			default:
				return a, contactError("contact_phone must be an international number, e.g. +77011234567")
			}
		}
		a.Phone = number.String()
		if len(a.Phone) < 8 || len(a.Phone) > 16 || a.Phone[0] != '+' || a.Phone[1] == '0' {
			return a, contactError("contact_phone must have + followed by 7–15 digits, e.g. +77011234567")
		}
	}
	if a.ContactMethod == "" {
		if a.Phone != "" {
			a.ContactMethod = "phone"
		} else {
			a.ContactMethod = "email"
		}
	}
	switch a.ContactMethod {
	case "phone":
		if a.Phone == "" {
			return a, contactError("contact_phone is required when contact_method is phone")
		}
	case "email":
		if a.Email == "" {
			return a, contactError("email is required when contact_method is email")
		}
	default:
		return a, contactError("contact_method must be phone or email")
	}
	return a, nil
}

func ValidateContactPolicy(policy, method string) error {
	if policy == "" || policy == "email_or_phone" {
		return nil
	}
	if policy == method+"_only" {
		return nil
	}
	return contactError("this event requires " + strings.TrimSuffix(policy, "_only") + " as the primary contact")
}

// ContactSettings resolves defaults and rejects contradictory event settings.
func ContactSettings(policy, method string) (string, string, error) {
	if policy == "" {
		policy = "email_or_phone"
	}
	if method == "" {
		method = "phone"
	}
	if policy != "email_or_phone" && policy != "phone_only" && policy != "email_only" {
		return "", "", contactError("booking_contact_policy must be email_or_phone, phone_only, or email_only")
	}
	if method != "phone" && method != "email" {
		return "", "", contactError("default_contact_method must be phone or email")
	}
	if err := ValidateContactPolicy(policy, method); err != nil {
		return "", "", err
	}
	return policy, method, nil
}
