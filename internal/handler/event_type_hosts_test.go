package handler_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/calnode/calnode/internal/handler"
)

type hostsResp struct {
	Items []struct {
		UserID   string `json:"user_id"`
		Role     string `json:"role"`
		Priority int    `json:"priority"`
		Archived bool   `json:"archived"`
	} `json:"items"`
}

func getHosts(t *testing.T, h *handler.Handler, slug, key string) hostsResp {
	t.Helper()
	req := authReq(http.MethodGet, "/v1/event-types/"+slug+"/hosts", "", key)
	req.SetPathValue("slug", slug)
	rec := httptest.NewRecorder()
	h.RequireAuth(h.ListEventTypeHosts)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("get hosts: %d — %s", rec.Code, rec.Body.String())
	}
	var resp hostsResp
	json.Unmarshal(rec.Body.Bytes(), &resp)
	return resp
}

func putHosts(t *testing.T, h *handler.Handler, slug, key, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := authReq(http.MethodPut, "/v1/event-types/"+slug+"/hosts", body, key)
	req.SetPathValue("slug", slug)
	rec := httptest.NewRecorder()
	h.RequireAuth(h.SetEventTypeHosts)(rec, req)
	return rec
}

func TestEventTypeHosts_ownerSeededAsRequired(t *testing.T) {
	h, _, key, ownerID := setupWorkspaceWithDB(t)
	slug, _ := seedEventTypeHTTP(t, h, key)

	hosts := getHosts(t, h, slug, key)
	if len(hosts.Items) != 1 {
		t.Fatalf("got %d hosts; want 1 (owner seeded)", len(hosts.Items))
	}
	if hosts.Items[0].UserID != ownerID || hosts.Items[0].Role != "required" {
		t.Errorf("seeded host = %+v; want owner as required", hosts.Items[0])
	}
}

func TestCreateEventType_withDoctorAndQuestions(t *testing.T) {
	h, database, key, _ := setupWorkspaceWithDB(t)
	if _, err := database.Exec(`INSERT INTO users (id,email,name,iana_timezone) VALUES ('doctor','doctor@example.com','Doctor','UTC')`); err != nil {
		t.Fatal(err)
	}
	post := func(hostID string) *httptest.ResponseRecorder {
		body := fmt.Sprintf(`{
			"slug":"doctor_20_min","name":"doctor_20_min","duration_minutes":20,
			"routing_mode":"round_robin","host_user_id":%q,
			"questions":[
				{"label":" Reason for visit ","type":"text","required":true},
				{"label":"Visit type","type":"select","options":["New","Follow-up"]}
			]
		}`, hostID)
		rec := httptest.NewRecorder()
		h.RequireAuth(h.CreateEventType)(rec, authReq(http.MethodPost, "/v1/event-types", body, key))
		return rec
	}

	// A failed host assignment must leave the slug available for a retry.
	mustStatus(t, post("missing"), http.StatusBadRequest, "create with missing doctor")
	created := mustCreated(t, post("doctor"), "create with doctor")
	if created["routing_mode"] != "round_robin" {
		t.Fatalf("routing mode = %v; want round_robin", created["routing_mode"])
	}
	const slug = "doctor_20_min"
	hosts := getHosts(t, h, slug, key).Items
	if len(hosts) != 1 || hosts[0].UserID != "doctor" || hosts[0].Role != "rotation" {
		t.Fatalf("hosts = %+v; want only the doctor in rotation", hosts)
	}

	mustStatus(t, post("doctor"), http.StatusConflict, "retry an existing slug")
	req := httptest.NewRequest(http.MethodGet, "/v1/event-types/"+slug+"/questions", nil)
	req.SetPathValue("slug", slug)
	rec := httptest.NewRecorder()
	h.ListQuestions(rec, req)
	body := mustJSON(t, rec, http.StatusOK, "list public booking questions")
	questions, ok := body["items"].([]any)
	if !ok || len(questions) != 2 {
		t.Fatalf("questions = %v; want two", body["items"])
	}
	first := questions[0].(map[string]any)
	second := questions[1].(map[string]any)
	if first["label"] != "Reason for visit" || first["required"] != true ||
		second["label"] != "Visit type" || fmt.Sprint(second["options"]) != "[New Follow-up]" {
		t.Fatalf("unexpected question contents or order: %v", questions)
	}

	seedFullAvailabilityDB(t, database, "doctor")
	bookingBody := fmt.Sprintf(`{
		"event_type_slug":%q,"start_at":"2026-06-20T10:00:00Z","name":"Patient","email":"patient@example.com",
		"answers":[{"question_id":%q,"value":"Consultation"}]
	}`, slug, mustString(t, first, "id", "booking question"))
	bookingReq := httptest.NewRequest(http.MethodPost, "/v1/bookings", strings.NewReader(bookingBody))
	bookingReq.Header.Set("Content-Type", "application/json")
	bookingRec := httptest.NewRecorder()
	h.CreateBooking(bookingRec, bookingReq)
	booked := mustCreated(t, bookingRec, "book with selected doctor")
	var hostID string
	if err := database.QueryRow(`SELECT host_id FROM bookings WHERE id = ?`, mustString(t, booked, "id", "booking")).Scan(&hostID); err != nil {
		t.Fatal(err)
	}
	if hostID != "doctor" {
		t.Fatalf("booking assigned to %q; want doctor", hostID)
	}
}

func TestEventTypeHosts_replaceWithRotation(t *testing.T) {
	h, database, key, ownerID := setupWorkspaceWithDB(t)
	database.Exec(`INSERT INTO users (id,email,name,iana_timezone,is_admin) VALUES ('u2','u2@example.com','Two','UTC',0)`)
	slug, _ := seedEventTypeHTTP(t, h, key)

	body := fmt.Sprintf(`{"hosts":[{"user_id":%q,"role":"rotation","priority":0},{"user_id":"u2","role":"rotation","priority":1}]}`, ownerID)
	if rec := putHosts(t, h, slug, key, body); rec.Code != http.StatusOK {
		t.Fatalf("put hosts: %d — %s", rec.Code, rec.Body.String())
	}
	hosts := getHosts(t, h, slug, key)
	if len(hosts.Items) != 2 {
		t.Fatalf("got %d hosts; want 2", len(hosts.Items))
	}
	for _, hh := range hosts.Items {
		if hh.Role != "rotation" {
			t.Errorf("host %s role = %s; want rotation", hh.UserID, hh.Role)
		}
	}
}

func TestEventTypeHosts_rejectsAllOptional(t *testing.T) {
	h, _, key, ownerID := setupWorkspaceWithDB(t)
	slug, _ := seedEventTypeHTTP(t, h, key)
	body := fmt.Sprintf(`{"hosts":[{"user_id":%q,"role":"optional","priority":0}]}`, ownerID)
	if rec := putHosts(t, h, slug, key, body); rec.Code != http.StatusBadRequest {
		t.Errorf("all-optional: got %d; want 400 — %s", rec.Code, rec.Body.String())
	}
}

func TestEventTypeHosts_rejectsEmpty(t *testing.T) {
	h, _, key, _ := setupWorkspaceWithDB(t)
	slug, _ := seedEventTypeHTTP(t, h, key)
	if rec := putHosts(t, h, slug, key, `{"hosts":[]}`); rec.Code != http.StatusBadRequest {
		t.Errorf("empty: got %d; want 400", rec.Code)
	}
}

func TestEventTypeHosts_rejectsArchived(t *testing.T) {
	h, database, key, ownerID := setupWorkspaceWithDB(t)
	database.Exec(`INSERT INTO users (id,email,name,iana_timezone,is_admin,archived_at) VALUES ('u2','u2@example.com','Two','UTC',0,'2026-01-01T00:00:00Z')`)
	slug, _ := seedEventTypeHTTP(t, h, key)
	body := fmt.Sprintf(`{"hosts":[{"user_id":%q,"role":"required","priority":0},{"user_id":"u2","role":"rotation","priority":0}]}`, ownerID)
	if rec := putHosts(t, h, slug, key, body); rec.Code != http.StatusBadRequest {
		t.Errorf("archived host: got %d; want 400 — %s", rec.Code, rec.Body.String())
	}
}
