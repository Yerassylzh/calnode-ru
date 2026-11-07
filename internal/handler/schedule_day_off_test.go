package handler_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/calnode/calnode/internal/booking"
)

func TestScheduleDayOffNotesAndLocalDate(t *testing.T) {
	h, database, key, staff := setupWorkspaceWithDB(t)
	seedFullAvailability(t, h, key)
	if _, err := database.Exec("UPDATE users SET iana_timezone='Asia/Qyzylorda' WHERE id=?", staff); err != nil {
		t.Fatal(err)
	}
	date := nextMonday()
	code, created := createOverride(t, h, key, fmt.Sprintf(`{"date":%q,"reason":"day_off","notes":"  Personal leave  "}`, date))
	if code != http.StatusCreated || created["notes"] != "Personal leave" {
		t.Fatalf("create: %d %v", code, created)
	}
	id := created["id"].(string)
	read := func() map[string]any {
		t.Helper()
		rec := httptest.NewRecorder()
		path := fmt.Sprintf("/v1/schedule/availability?staff_id=%s&from=%sT00:00:00%%2B05:00&to=%sT00:00:00%%2B05:00", staff, date, mustDate(t, date).AddDate(0, 0, 1).Format(time.DateOnly))
		h.RequireAuth(h.GetScheduleAvailability)(rec, authReq(http.MethodGet, path, "", key))
		mustStatus(t, rec, http.StatusOK, "availability")
		var response map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		return response
	}
	response := read()
	days := response["days"].([]any)
	if len(days) != 1 {
		t.Fatalf("local date bounds: %v", days)
	}
	day := days[0].(map[string]any)
	if day["date"] != date || day["is_day_off"] != true || day["notes"] != "Personal leave" || day["reason"] != "day_off" || day["override_id"] != id || len(response["windows"].([]any)) != 0 {
		t.Fatalf("day off: %v", response)
	}
	patch := httptest.NewRecorder()
	req := authReq(http.MethodPatch, "/v1/availability-overrides/"+id, `{"notes":"Updated reason"}`, key)
	req.SetPathValue("id", id)
	h.RequireAuth(h.UpdateAvailabilityOverride)(patch, req)
	mustStatus(t, patch, http.StatusOK, "update reason")
	if read()["days"].([]any)[0].(map[string]any)["notes"] != "Updated reason" {
		t.Fatal("updated notes missing")
	}
	list := httptest.NewRecorder()
	h.RequireAuth(h.ListAvailabilityOverrides)(list, authReq(http.MethodGet, "/v1/availability-overrides", "", key))
	mustStatus(t, list, http.StatusOK, "list")
	if !strings.Contains(list.Body.String(), "Updated reason") {
		t.Fatal(list.Body.String())
	}
	del := httptest.NewRecorder()
	req = authReq(http.MethodDelete, "/v1/availability-overrides/"+id, "", key)
	req.SetPathValue("id", id)
	h.RequireAuth(h.DeleteAvailabilityOverride)(del, req)
	mustStatus(t, del, http.StatusNoContent, "remove day off")
	if read()["days"].([]any)[0].(map[string]any)["is_day_off"] != false {
		t.Fatal("weekly schedule not restored")
	}
}

func mustDate(t *testing.T, date string) time.Time {
	t.Helper()
	parsed, err := time.Parse(time.DateOnly, date)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

func TestScheduleDistinguishesUnscheduledBookedAndBreakDays(t *testing.T) {
	for _, kind := range []string{"unscheduled", "booked", "break"} {
		t.Run(kind, func(t *testing.T) {
			h, database, key, staff := setupWorkspaceWithDB(t)
			date := nextMonday()
			if _, err := database.Exec("UPDATE users SET iana_timezone='UTC' WHERE id=?", staff); err != nil {
				t.Fatal(err)
			}
			if kind != "unscheduled" {
				body := `{"day_of_week":1,"start_time":"09:00","end_time":"10:00"}`
				rec := httptest.NewRecorder()
				h.RequireAuth(h.CreateAvailabilityRule)(rec, authReq(http.MethodPost, "/v1/availability-rules", body, key))
				mustStatus(t, rec, 201, "hours")
			}
			if kind == "booked" {
				_, err := booking.New(database).Create(context.Background(), booking.CreateParams{HostIDs: []string{staff}, StartAt: mustDate(t, date).Add(9 * time.Hour), EndAt: mustDate(t, date).Add(10 * time.Hour), Organizer: booking.Attendee{Name: "Alex", Email: "alex@example.com"}})
				if err != nil {
					t.Fatal(err)
				}
			} else if kind == "break" {
				rec := httptest.NewRecorder()
				h.RequireAuth(h.CreateDoctorBreak)(rec, authReq(http.MethodPost, "/v1/doctor-breaks", fmt.Sprintf(`{"kind":"date","date":%q,"start_time":"09:00","end_time":"10:00"}`, date), key))
				mustStatus(t, rec, 201, "break")
			}
			rec := httptest.NewRecorder()
			h.RequireAuth(h.GetScheduleAvailability)(rec, authReq(http.MethodGet, fmt.Sprintf("/v1/schedule/availability?from=%sT00:00:00Z&to=%sT00:00:00Z", date, mustDate(t, date).AddDate(0, 0, 1).Format(time.DateOnly)), "", key))
			mustStatus(t, rec, 200, "availability")
			var response struct {
				Windows []any `json:"windows"`
				Days    []struct {
					IsDayOff bool   `json:"is_day_off"`
					Reason   string `json:"reason"`
				} `json:"days"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if len(response.Windows) != 0 || len(response.Days) != 1 || response.Days[0].IsDayOff != (kind == "unscheduled") {
				t.Fatal(rec.Body.String())
			}
			if kind == "unscheduled" && response.Days[0].Reason != "not_scheduled" {
				t.Fatal(rec.Body.String())
			}
		})
	}
}

func TestDayOffConflictsAndTransactionalBookingGuard(t *testing.T) {
	h, database, key, staff := setupWorkspaceWithDB(t)
	if _, err := database.Exec("UPDATE users SET iana_timezone='UTC' WHERE id=?", staff); err != nil {
		t.Fatal(err)
	}
	date := nextMonday()
	svc := booking.New(database)
	params := booking.CreateParams{HostIDs: []string{staff}, StartAt: mustDate(t, date).Add(9 * time.Hour), EndAt: mustDate(t, date).Add(10 * time.Hour), Organizer: booking.Attendee{Name: "Alex", Email: "alex@example.com"}}
	b, err := svc.Create(context.Background(), params)
	if err != nil {
		t.Fatal(err)
	}
	body := fmt.Sprintf(`{"date":%q,"reason":"day_off"}`, date)
	code, response := createOverride(t, h, key, body)
	if code != 409 || response["code"] != "bookings_conflict" {
		t.Fatalf("conflict: %d %v", code, response)
	}
	var count int
	if err := database.QueryRow("SELECT COUNT(*) FROM availability_overrides WHERE user_id=?", staff).Scan(&count); err != nil || count != 0 {
		t.Fatalf("partial override: %d %v", count, err)
	}
	if _, err := database.Exec("UPDATE bookings SET status='cancelled' WHERE id=?", b.ID); err != nil {
		t.Fatal(err)
	}
	code, response = createOverride(t, h, key, body)
	if code != 201 {
		t.Fatalf("create: %d %v", code, response)
	}
	_, err = svc.Create(context.Background(), params)
	if !errors.Is(err, booking.ErrDoubleBooked) {
		t.Fatalf("booking on day off: %v", err)
	}
	code, response = createOverride(t, h, key, fmt.Sprintf(`{"date":%q,"notes":%q}`, date, strings.Repeat("я", 5001)))
	if code != 400 || response["code"] != "invalid_notes" {
		t.Fatalf("notes validation: %d %v", code, response)
	}
}

func TestAdminManagesSpecialistDayOffRange(t *testing.T) {
	h, database, key, owner := setupWorkspaceWithDB(t)
	if _, err := database.Exec(`INSERT INTO users (id,email,name,iana_timezone,is_admin) VALUES ('specialist','specialist@example.com','Specialist','UTC',0)`); err != nil {
		t.Fatal(err)
	}
	date := nextMonday()
	end := mustDate(t, date).AddDate(0, 0, 1).Format(time.DateOnly)
	code, result := createOverride(t, h, key, fmt.Sprintf(`{"user_id":"specialist","date":%q,"end_date":%q,"reason":"day_off","notes":"Conference"}`, date, end))
	if code != 201 || result["days"] != float64(2) {
		t.Fatalf("range: %d %v", code, result)
	}
	var count int
	if err := database.QueryRow("SELECT COUNT(*) FROM availability_overrides WHERE user_id=?", owner).Scan(&count); err != nil || count != 0 {
		t.Fatalf("owner changed: %d %v", count, err)
	}
	var id string
	if err := database.QueryRow("SELECT id FROM availability_overrides WHERE user_id='specialist' AND date=?", date).Scan(&id); err != nil {
		t.Fatal(err)
	}
	req := authReq(http.MethodPatch, "/v1/availability-overrides/"+id, `{"notes":"Annual leave"}`, key)
	req.SetPathValue("id", id)
	rec := httptest.NewRecorder()
	h.RequireAuth(h.UpdateAvailabilityOverride)(rec, req)
	mustStatus(t, rec, 200, "admin update")
	rec = httptest.NewRecorder()
	h.RequireAuth(h.GetScheduleAvailability)(rec, authReq(http.MethodGet, fmt.Sprintf("/v1/schedule/availability?staff_id=specialist&from=%sT00:00:00Z&to=%sT00:00:00Z", date, mustDate(t, end).AddDate(0, 0, 1).Format(time.DateOnly)), "", key))
	mustStatus(t, rec, 200, "specialist days")
	var response struct {
		Days []struct {
			Notes    string `json:"notes"`
			IsDayOff bool   `json:"is_day_off"`
		} `json:"days"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Days) != 2 || response.Days[0].Notes != "Annual leave" || response.Days[1].Notes != "Conference" || !response.Days[0].IsDayOff || !response.Days[1].IsDayOff {
		t.Fatal(rec.Body.String())
	}
}
