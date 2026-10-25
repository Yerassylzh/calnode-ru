package db_test

import (
	"testing"

	"github.com/calnode/calnode/internal/db"
	"github.com/pressly/goose/v3"
)

func TestContactMigrationPreservesLegacyBooking(t *testing.T) {
	database, err := db.Open("sqlite://:memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if err := db.Migrate(database); err != nil {
		t.Fatal(err)
	}
	// Rehearse the upgrade from the last email-only schema, not just a fresh install.
	if err := goose.DownTo(database, "migrations", 70); err != nil {
		t.Fatal(err)
	}
	for _, query := range []string{
		`INSERT INTO users (id,email,name) VALUES ('host','host@example.com','Host')`,
		`INSERT INTO event_types (id,user_id,slug,name,duration_minutes) VALUES ('event','host','consultation','Consultation',30)`,
		`INSERT INTO bookings (id,event_type_id,host_id,start_at,end_at,status) VALUES ('booking','event','host','2026-11-02T09:00:00Z','2026-11-02T09:30:00Z','confirmed')`,
		`INSERT INTO booking_attendees (id,booking_id,name,email,iana_timezone,is_organizer) VALUES ('attendee','booking','Alex','Alex@example.com','UTC',1)`,
	} {
		if _, err := database.Exec(query); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 2; i++ {
		if err := db.Migrate(database); err != nil {
			t.Fatal(err)
		}
	}
	var email, phone, method, policy, defaultMethod string
	if err := database.QueryRow(`SELECT email,phone,contact_method FROM booking_attendees WHERE id='attendee'`).Scan(&email, &phone, &method); err != nil {
		t.Fatal(err)
	}
	if email != "Alex@example.com" || phone != "" || method != "email" {
		t.Fatalf("legacy attendee changed: %q %q %q", email, phone, method)
	}
	if err := database.QueryRow(`SELECT booking_contact_policy,default_contact_method FROM event_types WHERE id='event'`).Scan(&policy, &defaultMethod); err != nil {
		t.Fatal(err)
	}
	if policy != "email_or_phone" || defaultMethod != "phone" {
		t.Fatalf("wrong new defaults: %s %s", policy, defaultMethod)
	}
	var integrity string
	if err := database.QueryRow("PRAGMA integrity_check").Scan(&integrity); err != nil || integrity != "ok" {
		t.Fatalf("integrity: %s %v", integrity, err)
	}
	rows, err := database.Query("PRAGMA foreign_key_check")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	if rows.Next() {
		t.Fatal("migration introduced a foreign-key violation")
	}
}
