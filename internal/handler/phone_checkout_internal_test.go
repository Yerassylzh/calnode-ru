package handler

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPhoneCheckoutReturnRequiresBoundPaidSession(t *testing.T) {
	for _, tc := range []struct {
		name, sessionID, bookingID, payment string
		status                              int
	}{
		{"paid", "cs_expected", "b-pay", "paid", http.StatusSeeOther},
		{"unpaid", "cs_expected", "b-pay", "unpaid", http.StatusBadRequest},
		{"other booking", "cs_expected", "other", "paid", http.StatusBadRequest},
		{"other session", "cs_other", "b-pay", "paid", http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h, database, _ := newRefundTestSetup(t)
			if _, err := database.Exec(`UPDATE bookings SET payment_status='pending',stripe_session_id='cs_expected' WHERE id='b-pay'`); err != nil {
				t.Fatal(err)
			}
			if _, err := database.Exec(`INSERT INTO booking_attendees (id,booking_id,name,email,iana_timezone,is_organizer,phone,contact_method) VALUES ('phone-attendee','b-pay','Alex','','UTC',1,'+77011234567','phone')`); err != nil {
				t.Fatal(err)
			}
			token, err := h.bookingSvc.IssueManageToken(context.Background(), "b-pay")
			if err != nil {
				t.Fatal(err)
			}
			refundTestClient(t, h, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprintf(w, `{"id":%q,"metadata":{"booking_id":%q},"payment_status":%q,"payment_intent":"pi_phone","amount_total":500,"currency":"usd"}`, tc.sessionID, tc.bookingID, tc.payment)
			})
			req := httptest.NewRequest("GET", "/manage/"+token+"?checkout_session_id="+tc.sessionID, nil)
			req.SetPathValue("token", token)
			rec := httptest.NewRecorder()
			h.ManagePage(rec, req)
			if rec.Code != tc.status {
				t.Fatalf("return %d: %s", rec.Code, rec.Body)
			}
			var payment string
			if err := database.QueryRow("SELECT payment_status FROM bookings WHERE id='b-pay'").Scan(&payment); err != nil {
				t.Fatal(err)
			}
			if tc.status == http.StatusSeeOther {
				if payment != "paid" || strings.Contains(rec.Header().Get("Location"), "checkout_session_id") {
					t.Fatal("verified payment did not finalize and strip checkout query")
				}
			} else if payment != "pending" {
				t.Fatal("unverified return changed payment state")
			}
		})
	}
}
