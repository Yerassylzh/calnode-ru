package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/calnode/calnode/internal/booking"
)

func TestStaffBookingNotesAndCustomerLookup(t *testing.T) {
	h, database, key, host := setupWorkspaceWithDB(t)
	seedFullAvailability(t, h, key)
	start := futureAt(2, 10, 0)
	payload := map[string]any{
		"staff_id": host, "start_at": start.Format(time.RFC3339), "duration_minutes": 20,
		"name": "Alex", "email": "Alex@example.com", "contact_phone": "+77011234567",
		"notes": "Follow-up visit.\nBring previous results.",
	}
	raw, _ := json.Marshal(payload)
	created := httptest.NewRecorder()
	h.RequireAuth(h.CreateScheduleBooking)(created, authReq(http.MethodPost, "/v1/bookings", string(raw), key))
	data := mustCreated(t, created, "booking with notes")
	id := mustString(t, data, "id", "booking with notes")
	if data["notes"] != payload["notes"] {
		t.Fatalf("creation lost notes: %s", created.Body)
	}
	service := booking.New(database)
	for _, item := range []struct {
		start time.Time
		email string
		phone string
	}{
		{time.Now().Add(-time.Hour), "Alex@example.com", "+77011234567"},
		{start.Add(time.Hour), "other@example.com", "+77011234568"},
	} {
		if _, err := service.Create(t.Context(), booking.CreateParams{
			HostIDs: []string{host}, StartAt: item.start, EndAt: item.start.Add(20 * time.Minute),
			Organizer: booking.Attendee{Name: "Other", Email: item.email, Phone: item.phone},
		}); err != nil {
			t.Fatal(err)
		}
	}
	for _, filter := range []url.Values{
		{"email": {"alex@EXAMPLE.com"}},
		{"phone": {"+77011234567"}},
		{"email": {"alex@example.com"}, "phone": {"+77011234567"}},
	} {
		filter.Set("scope", "all")
		filter.Set("when", "future")
		result := listBookings(t, h, key, "?"+filter.Encode())
		if result.Total != 1 || len(result.Items) != 1 || result.Items[0].ID != id {
			t.Fatalf("customer lookup returned wrong bookings: %+v", result)
		}
	}
	checkNotes := func() {
		t.Helper()
		request := authReq(http.MethodGet, "/v1/bookings/"+id, "", key)
		request.SetPathValue("id", id)
		rec := httptest.NewRecorder()
		h.RequireAuth(h.GetBooking)(rec, request)
		body := mustJSON(t, rec, http.StatusOK, "get notes")
		if body["notes"] != payload["notes"] || len(body["attendees"].([]any)) != 1 {
			t.Fatalf("detail response lost notes or attendee: %s", rec.Body)
		}
		if _, exists := body["manage_url"]; exists {
			t.Fatal("detail response exposed a management capability")
		}
	}
	checkNotes()
	moved := patchReschedule(t, h, id, start.Add(2*time.Hour).Format(time.RFC3339), key)
	mustStatus(t, moved, http.StatusOK, "reschedule with notes")
	checkNotes()

	if _, err := database.Exec(`INSERT INTO users (id,email,name) VALUES ('notes-member','member@example.com','Member')`); err != nil {
		t.Fatal(err)
	}
	memberKey := "notes-member-key"
	if _, err := database.Exec(`INSERT INTO api_keys (id,user_id,name,key_hash,created_at)
		VALUES ('notes-key','notes-member','test',?,'2026-01-01')`, sha256HexForTest(memberKey)); err != nil {
		t.Fatal(err)
	}
	if result := listBookings(t, h, memberKey, "?scope=all&when=future&phone=%2B77011234567"); result.Total != 0 {
		t.Fatalf("customer lookup bypassed staff visibility: %+v", result)
	}
	for _, apiKey := range []string{"", memberKey} {
		request := authReq(http.MethodGet, "/v1/bookings/"+id, "", apiKey)
		request.SetPathValue("id", id)
		rec := httptest.NewRecorder()
		h.RequireAuth(h.GetBooking)(rec, request)
		if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusNotFound {
			t.Fatalf("notes leaked to unauthorized caller: %d", rec.Code)
		}
	}
}

func TestStaffBookingRejectsNonInternationalPhoneAndOversizedNotes(t *testing.T) {
	h, database, key, host := setupWorkspaceWithDB(t)
	seedFullAvailability(t, h, key)
	start := futureAt(2, 10, 0).Format(time.RFC3339)
	for _, phone := range []string{"87011234567", "0077011234567", "+7 (701) 123-45-67", "+7-701-1234567", " +77011234567 ", "+07011234567"} {
		body, _ := json.Marshal(map[string]any{
			"staff_id": host, "start_at": start, "duration_minutes": 20, "name": "Alex", "contact_phone": phone,
		})
		rec := httptest.NewRecorder()
		h.RequireAuth(h.CreateScheduleBooking)(rec, authReq(http.MethodPost, "/v1/bookings", string(body), key))
		response := mustJSON(t, rec, http.StatusBadRequest, "invalid phone")
		if response["code"] != "invalid_phone" || response["field"] != "contact_phone" {
			t.Fatalf("unclear phone error: %s", rec.Body)
		}
		filter := url.Values{"phone": {phone}, "when": {"future"}}
		query := httptest.NewRecorder()
		h.RequireAuth(h.ListBookings)(query, authReq(http.MethodGet, "/v1/bookings?"+filter.Encode(), "", key))
		response = mustJSON(t, query, http.StatusBadRequest, "invalid lookup phone")
		if response["code"] != "invalid_phone" || response["field"] != "phone" {
			t.Fatalf("unclear lookup phone error: %s", query.Body)
		}
	}
	body, _ := json.Marshal(map[string]any{
		"staff_id": host, "start_at": start, "duration_minutes": 20, "name": "Alex",
		"contact_phone": "+77011234567", "notes": strings.Repeat("a", 5001),
	})
	rec := httptest.NewRecorder()
	h.RequireAuth(h.CreateScheduleBooking)(rec, authReq(http.MethodPost, "/v1/bookings", string(body), key))
	response := mustJSON(t, rec, http.StatusBadRequest, "oversized notes")
	if response["code"] != "invalid_notes" {
		t.Fatalf("wrong notes error: %s", rec.Body)
	}
	var count int
	if err := database.QueryRow("SELECT COUNT(*) FROM bookings").Scan(&count); err != nil || count != 0 {
		t.Fatalf("invalid requests created bookings: %d %v", count, err)
	}
}
