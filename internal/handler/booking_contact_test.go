package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/calnode/calnode/internal/calendar"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestPhoneOnlyRESTBookingAndPrivateManageLink(t *testing.T) {
	h, database, key, _ := setupWorkspaceWithDB(t)
	slug, eventID := seedEventTypeHTTP(t, h, key)
	if _, err := database.Exec("UPDATE event_types SET location_type='in_person', location_value='Office' WHERE id=?", eventID); err != nil {
		t.Fatal(err)
	}
	body := fmt.Sprintf(`{"event_type_slug":%q,"start_at":"2026-06-15T09:00:00Z","name":"Alex","contact_phone":"+7 (701) 123-45-67"}`, slug)
	create := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/v1/bookings", strings.NewReader(body))
		req.Header.Set("Idempotency-Key", "phone-contact-retry")
		rec := httptest.NewRecorder()
		h.CreateBooking(rec, req)
		return rec
	}
	rec := create()
	if rec.Code != http.StatusCreated {
		t.Fatalf("create %d: %s", rec.Code, rec.Body)
	}
	var result struct {
		ID            string `json:"id"`
		ManageURL     string `json:"manage_url"`
		ContactMethod string `json:"contact_method"`
		Location      string `json:"location_value"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.ManageURL == "" || result.ContactMethod != "phone" || result.Location != "Office" {
		t.Fatalf("bad creator response: %s", rec.Body)
	}
	if replay := create(); replay.Code != 201 || replay.Body.String() != rec.Body.String() {
		t.Fatalf("retry lost original capability: %s", replay.Body)
	}
	var email, phone, method string
	if err := database.QueryRow("SELECT email, phone, contact_method FROM booking_attendees WHERE booking_id=?", result.ID).Scan(&email, &phone, &method); err != nil {
		t.Fatal(err)
	}
	if email != "" || phone != "+77011234567" || method != "phone" {
		t.Fatalf("stored %q %q %q", email, phone, method)
	}
	lookup := httptest.NewRequest("GET", "/v1/bookings/"+result.ID, nil)
	lookup.SetPathValue("id", result.ID)
	public := httptest.NewRecorder()
	h.GetBooking(public, lookup)
	if strings.Contains(public.Body.String(), "manage_url") || strings.Contains(public.Body.String(), phone) {
		t.Fatalf("public lookup leaked contact/capability: %s", public.Body)
	}
	u, err := url.Parse(result.ManageURL)
	if err != nil {
		t.Fatal(err)
	}
	manage := httptest.NewRequest("GET", u.Path, nil)
	manage.SetPathValue("token", strings.TrimPrefix(u.Path, "/manage/"))
	managed := httptest.NewRecorder()
	h.ManagePage(managed, manage)
	if managed.Code != 200 || !strings.Contains(managed.Body.String(), `id="reschedule-view"`) {
		t.Fatalf("creator cannot manage booking: %d", managed.Code)
	}
	list := httptest.NewRecorder()
	h.RequireAuth(h.ListBookings)(list, authReq("GET", "/v1/bookings", "", key))
	if list.Code != 200 || !strings.Contains(list.Body.String(), phone) {
		t.Fatalf("admin cannot see phone: %s", list.Body)
	}
	reschedule := httptest.NewRequest("POST", u.Path+"/reschedule", strings.NewReader(`{"start_at":"2026-06-15T10:00:00Z"}`))
	reschedule.SetPathValue("token", strings.TrimPrefix(u.Path, "/manage/"))
	rescheduled := httptest.NewRecorder()
	h.RescheduleByToken(rescheduled, reschedule)
	if rescheduled.Code != 200 {
		t.Fatalf("phone-only reschedule: %d %s", rescheduled.Code, rescheduled.Body)
	}
	var moved struct {
		ManageURL string `json:"manage_url"`
	}
	if err := json.Unmarshal(rescheduled.Body.Bytes(), &moved); err != nil {
		t.Fatal(err)
	}
	if moved.ManageURL == "" || moved.ManageURL == result.ManageURL {
		t.Fatal("reschedule did not return replacement capability")
	}
	staleRequest := httptest.NewRequest("POST", u.Path+"/reschedule", strings.NewReader(`{"start_at":"2026-06-15T11:00:00Z"}`))
	staleRequest.SetPathValue("token", strings.TrimPrefix(u.Path, "/manage/"))
	stale := httptest.NewRecorder()
	h.RescheduleByToken(stale, staleRequest)
	if stale.Code != 404 {
		t.Fatalf("old capability still usable after reschedule: %d", stale.Code)
	}
}

func TestPhonePrimaryCalendarAndEventPolicy(t *testing.T) {
	h, database, key, host := setupWorkspaceWithDB(t)
	slug, event := seedEventTypeHTTP(t, h, key)
	if _, err := database.Exec("UPDATE event_types SET location_type='google_meet', booking_contact_policy='phone_only' WHERE id=?", event); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`INSERT INTO calendar_connections (id,user_id,provider,access_token_enc,calendar_id,is_destination) VALUES ('phone-conn',?,'google','test','primary',1)`, host); err != nil {
		t.Fatal(err)
	}
	p := telephoneCalendar{events: make(chan calendar.CreateEventParams, 1)}
	svc := calendar.NewService(database)
	svc.Register(p)
	h.SetCalendar(svc)
	body := fmt.Sprintf(`{"event_type_slug":%q,"start_at":"2026-06-15T09:00:00Z","name":"Alex","contact_phone":"+77011234567"}`, slug)
	rec := httptest.NewRecorder()
	h.CreateBooking(rec, httptest.NewRequest("POST", "/v1/bookings", strings.NewReader(body)))
	if rec.Code != 201 {
		t.Fatalf("phone-only video booking: %d %s", rec.Code, rec.Body)
	}
	select {
	case event := <-p.events:
		if !event.AddMeet || event.OrganizerEmail != "" || strings.HasPrefix(event.Location, "tel:") {
			t.Fatalf("contact changed meeting or invited blank email: %+v", event)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("host calendar was not created")
	}
	// The public form's choice is enforced by the backend, not merely a UI default.
	bad := fmt.Sprintf(`{"event_type_slug":%q,"start_at":"2026-06-15T10:00:00Z","name":"Alex","email":"alex@example.com"}`, slug)
	rejected := httptest.NewRecorder()
	h.CreateBooking(rejected, httptest.NewRequest("POST", "/v1/bookings", strings.NewReader(bad)))
	if rejected.Code != 400 {
		t.Fatalf("event policy bypass: %d %s", rejected.Code, rejected.Body)
	}
}

func TestMCPPhoneOnlyContact(t *testing.T) {
	h, database, key, _ := setupWorkspaceWithDB(t)
	slug, event := seedEventTypeHTTP(t, h, key)
	if _, err := database.Exec("UPDATE event_types SET max_future_days=0 WHERE id=?", event); err != nil {
		t.Fatal(err)
	}
	client := connectMCP(t, h)
	res, err := client.CallTool(context.Background(), &mcp.CallToolParams{Name: "create_booking", Arguments: map[string]any{"event_type_id": slug, "slot_start": "2027-01-15T10:00:00Z", "attendee_name": "Alex", "attendee_phone": "+77011234567"}})
	if err != nil || res.IsError {
		t.Fatalf("MCP rejected phone-only contact: %v %+v", err, res)
	}
	data, err := json.Marshal(res.StructuredContent)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "manage_url") || !strings.Contains(string(data), `"contact_method":"phone"`) {
		t.Fatalf("MCP creator response missing contact/capability: %s", data)
	}
}
