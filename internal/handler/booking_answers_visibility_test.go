package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetBookingAnswersMatchesBookingVisibility(t *testing.T) {
	h, database, adminKey, _ := setupWorkspaceWithDB(t)
	slug, eventID := seedEventTypeHTTP(t, h, adminKey)
	questionID := createQuestion(t, h, slug, adminKey, `{"label":"Notes","type":"text"}`)
	for _, id := range []string{"primary", "cohost", "unrelated-owner"} {
		if _, err := database.Exec(`INSERT INTO users (id,email,name,iana_timezone,is_admin) VALUES (?,?,?,'UTC',0)`, id, id+"@example.com", id); err != nil {
			t.Fatal(err)
		}
		if _, err := database.Exec(`INSERT INTO api_keys (id,user_id,name,key_hash) VALUES (?,?,'test',?)`, "key-"+id, id, sha256HexForTest("secret-"+id)); err != nil {
			t.Fatal(err)
		}
	}
	// Ownership of the event alone must not grant a member access to other hosts' answers.
	if _, err := database.Exec(`UPDATE event_types SET user_id='unrelated-owner' WHERE id=?`, eventID); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`INSERT INTO bookings (id,event_type_id,host_id,start_at,end_at,status) VALUES ('answers-visible',?,'primary','2027-01-15T10:00:00Z','2027-01-15T10:30:00Z','confirmed')`, eventID); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`INSERT INTO booking_hosts (id,booking_id,user_id,is_primary) VALUES ('assigned-cohost','answers-visible','cohost',0)`); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(`INSERT INTO booking_answers (id,booking_id,question_id,value) VALUES ('answer','answers-visible',?,'Private notes')`, questionID); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, key string
		want      int
	}{
		{"workspace admin", adminKey, http.StatusOK},
		{"primary host", "secret-primary", http.StatusOK},
		{"assigned cohost", "secret-cohost", http.StatusOK},
		{"unrelated event owner", "secret-unrelated-owner", http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := authReq(http.MethodGet, "/v1/bookings/answers-visible/answers", "", tc.key)
			req.SetPathValue("id", "answers-visible")
			rec := httptest.NewRecorder()
			h.RequireAuth(h.GetBookingAnswers)(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("status %d; want %d: %s", rec.Code, tc.want, rec.Body)
			}
			if tc.want == http.StatusOK {
				var out struct {
					Items []struct {
						Value string `json:"value"`
					} `json:"items"`
				}
				if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
					t.Fatal(err)
				}
				if len(out.Items) != 1 || out.Items[0].Value != "Private notes" {
					t.Fatalf("answers missing: %s", rec.Body)
				}
			}
		})
	}
}
