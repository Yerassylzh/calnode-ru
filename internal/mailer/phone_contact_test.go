package mailer

import (
	"context"
	"html"
	"strings"
	"testing"
	"time"
)

func TestPhoneOnlySkipsAttendeeMailButNotHost(t *testing.T) {
	m := &captureMailer{}
	d := BookingData{BookingID: "phone-booking", OrganizerName: "Alex", OrganizerPhone: "+77011234567", HostName: "Host", HostEmail: "host@example.com", StartAt: time.Now(), EndAt: time.Now().Add(time.Hour)}
	for _, send := range []func(context.Context, Mailer, BookingData) error{SendConfirmationToAttendee, SendCancellationToAttendee, SendRescheduleToAttendee, SendReminder} {
		if err := send(context.Background(), m, d); err != nil {
			t.Fatal(err)
		}
	}
	if len(m.all()) != 0 {
		t.Fatal("attempted attendee delivery with no email")
	}
	if err := SendConfirmationToHost(context.Background(), m, d); err != nil {
		t.Fatal(err)
	}
	msgs := m.all()
	if len(msgs) != 1 || msgs[0].To[0] != d.HostEmail || !strings.Contains(msgs[0].Text, d.OrganizerPhone) || !strings.Contains(html.UnescapeString(msgs[0].HTML), d.OrganizerPhone) {
		t.Fatalf("host lost contact information: %+v", msgs)
	}
	ics := string(BuildICS(d, "REQUEST"))
	if strings.Contains(ics, "ATTENDEE;") {
		t.Fatal("phone-only booking acquired an empty calendar guest")
	}
	d.OrganizerEmail = "alex@example.com"
	if err := SendConfirmationToAttendee(context.Background(), m, d); err != nil {
		t.Fatal(err)
	}
	if len(m.all()) != 2 {
		t.Fatal("optional secondary email did not receive confirmation")
	}
}
