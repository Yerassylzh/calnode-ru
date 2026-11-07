package handler_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestScheduleBooksAnOffGridTimeAndRejectsOverlaps(t *testing.T) {
	h, database, key, staff := setupWorkspaceWithDB(t)
	seedFullAvailability(t, h, key)
	if _, err := database.Exec("UPDATE users SET iana_timezone = 'UTC' WHERE id = ?", staff); err != nil {
		t.Fatal(err)
	}
	addBreak := func(start, end string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		body := fmt.Sprintf("{\"kind\":\"date\",\"date\":\"2026-06-15\",\"start_time\":%q,\"end_time\":%q}", start, end)
		h.RequireAuth(h.CreateDoctorBreak)(rec, authReq(http.MethodPost, "/v1/doctor-breaks", body, key))
		return rec
	}
	mustStatus(t, addBreak("15:00", "15:10"), http.StatusCreated, "create break")
	mustStatus(t, addBreak("16:00", "16:30"), http.StatusCreated, "create break")
	path := "/v1/schedule/availability?from=2026-06-15T14:30:00Z&to=2026-06-15T16:30:00Z&duration_minutes=20"
	rec := httptest.NewRecorder()
	h.RequireAuth(h.GetScheduleAvailability)(rec, authReq(http.MethodGet, path, "", key))
	mustStatus(t, rec, http.StatusOK, "continuous windows")
	var availability struct {
		Windows []struct {
			Start time.Time `json:"start_at"`
			End   time.Time `json:"end_at"`
		} `json:"windows"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &availability); err != nil {
		t.Fatal(err)
	}
	windows := availability.Windows
	if len(windows) != 2 || windows[1].Start.Format("15:04") != "15:10" || windows[1].End.Format("15:04") != "16:00" {
		t.Fatalf("wrong windows: %s", rec.Body)
	}
	book := func(start, idemKey string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		body := fmt.Sprintf("{\"duration_minutes\":20,\"staff_id\":%q,\"start_at\":\"2026-06-15T%s:00Z\",\"name\":\"Alex\",\"email\":\"alex@example.com\"}", staff, start)
		req := authReq(http.MethodPost, "/v1/schedule/bookings", body, key)
		req.Header.Set("Idempotency-Key", idemKey)
		h.RequireAuth(h.CreateScheduleBooking)(rec, req)
		return rec
	}
	created := book("15:30", "off-grid")
	data := mustCreated(t, created, "staff appointment")
	id := mustString(t, data, "id", "staff appointment")
	var isNative bool
	if err := database.QueryRow("SELECT event_type_id IS NULL FROM bookings WHERE id = ?", id).Scan(&isNative); err != nil || !isNative {
		t.Fatalf("appointment requires an event type: %v", err)
	}
	manageURL, err := url.Parse(mustString(t, data, "manage_url", "staff appointment"))
	if err != nil {
		t.Fatal(err)
	}
	manage := httptest.NewRequest(http.MethodGet, manageURL.Path, nil)
	manage.SetPathValue("token", strings.TrimPrefix(manageURL.Path, "/manage/"))
	managePage := httptest.NewRecorder()
	h.ManagePage(managePage, manage)
	if managePage.Code != http.StatusOK || !strings.Contains(managePage.Body.String(), "Appointment") {
		t.Fatalf("appointment management link failed: %d", managePage.Code)
	}
	replayed := book("15:30", "off-grid")
	if replayed.Code != http.StatusCreated || replayed.Body.String() != created.Body.String() {
		t.Fatalf("replay differed: %d %s", replayed.Code, replayed.Body)
	}
	conflict := mustJSON(t, book("15:20", "overlap"), http.StatusConflict, "overlapping booking")
	if conflict["code"] != "time_unavailable" {
		t.Fatalf("missing conflict code: %v", conflict)
	}
	mustStatus(t, book("15:55", "break-overlap"), http.StatusConflict, "booking overlapping break")
	mustStatus(t, addBreak("15:40", "15:55"), http.StatusConflict, "break overlapping booking")
	mustStatus(t, addBreak("15:50", "16:00"), http.StatusCreated, "adjacent break")

	reschedule := authReq(http.MethodPatch, "/v1/bookings/"+id+"/reschedule", `{"start_at":"2026-06-15T16:35:00Z"}`, key)
	reschedule.SetPathValue("id", id)
	moved := httptest.NewRecorder()
	h.RequireAuth(h.RescheduleBooking)(moved, reschedule)
	mustStatus(t, moved, http.StatusOK, "reschedule staff appointment")
	if end := mustJSON(t, moved, http.StatusOK, "rescheduled appointment")["end_at"]; end != "2026-06-15T16:55:00Z" {
		t.Fatalf("reschedule changed duration: %v", end)
	}
}
