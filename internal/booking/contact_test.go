package booking_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/calnode/calnode/internal/booking"
)

func TestNormalizeContact(t *testing.T) {
	for _, tc := range []struct {
		name          string
		in            booking.Attendee
		phone, method string
		valid         bool
	}{
		{"phone default", booking.Attendee{Name: "Alex", Phone: "+7 (701) 123-45-67"}, "+77011234567", "phone", true},
		{"email legacy", booking.Attendee{Name: "Alex", Email: "Alex <Alex@example.com>"}, "", "email", true},
		{"both default phone", booking.Attendee{Name: "Alex", Email: "alex@example.com", Phone: "+77011234567"}, "+77011234567", "phone", true},
		{"explicit email", booking.Attendee{Name: "Alex", ContactMethod: "email", Email: "alex@example.com", Phone: "+77011234567"}, "+77011234567", "email", true},
		{"no contact", booking.Attendee{Name: "Alex"}, "", "", false},
		{"missing selected", booking.Attendee{Name: "Alex", ContactMethod: "phone", Email: "alex@example.com"}, "", "", false},
		{"local number", booking.Attendee{Name: "Alex", Phone: "87011234567"}, "", "", false},
		{"extension", booking.Attendee{Name: "Alex", Phone: "+77011234567x1"}, "", "", false},
		{"too long", booking.Attendee{Name: "Alex", Phone: "+1234567890123456"}, "", "", false},
		{"bad secondary", booking.Attendee{Name: "Alex", Phone: "+77011234567", Email: "x\r\nBcc: other@example.com"}, "", "", false},
		{"unknown method", booking.Attendee{Name: "Alex", Phone: "+77011234567", ContactMethod: "sms"}, "", "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := booking.NormalizeContact(tc.in)
			if !tc.valid {
				if !errors.Is(err, booking.ErrInvalidContact) {
					t.Fatalf("expected contact error, got %v", err)
				}
				return
			}
			if err != nil || got.Phone != tc.phone || got.ContactMethod != tc.method {
				t.Fatalf("got %+v, %v", got, err)
			}
		})
	}
}

func TestPhoneContactLimitsAndPolicy(t *testing.T) {
	database := newTestDB(t)
	host := seedHost(t, database)
	event := seedEventType(t, database, host)
	svc := booking.New(database)
	start := time.Now().UTC().Add(24 * time.Hour)
	params := booking.CreateParams{EventTypeID: event, HostIDs: []string{host}, StartAt: start, EndAt: start.Add(30 * time.Minute), MaxActivePerInvitee: 1, Organizer: booking.Attendee{Name: "Alex", Phone: "+7 (701) 1234567"}}
	b, err := svc.Create(context.Background(), params)
	if err != nil {
		t.Fatal(err)
	}
	if b.ManageToken == "" {
		t.Fatal("creator must receive a manage capability")
	}
	if _, err := svc.ValidateManageToken(context.Background(), b.ManageToken); err != nil {
		t.Fatal(err)
	}
	params.StartAt = start.Add(time.Hour)
	params.EndAt = params.StartAt.Add(30 * time.Minute)
	params.Organizer.Phone = "+77011234567"
	if _, err := svc.Create(context.Background(), params); !errors.Is(err, booking.ErrBookingLimitReached) {
		t.Fatalf("normalized phone bypassed limit: %v", err)
	}
	params.MaxActivePerInvitee = 0
	params.MaxBookingsPerHour = 1
	if _, err := svc.Create(context.Background(), params); !errors.Is(err, booking.ErrEmailThrottled) {
		t.Fatalf("phone bypassed hourly limit: %v", err)
	}
	params.Organizer.Phone = "+77011234568"
	if _, err := svc.Create(context.Background(), params); err != nil {
		t.Fatalf("blank email grouped different phones: %v", err)
	}
	if _, err := database.Exec("UPDATE event_types SET booking_contact_policy = 'email_only', default_contact_method = 'email' WHERE id = ?", event); err != nil {
		t.Fatal(err)
	}
	params.StartAt = start.Add(2 * time.Hour)
	params.EndAt = params.StartAt.Add(30 * time.Minute)
	if _, err := svc.Create(context.Background(), params); !errors.Is(err, booking.ErrInvalidContact) {
		t.Fatalf("service bypassed event policy: %v", err)
	}
}
