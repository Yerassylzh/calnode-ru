package handler

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func receives(sub *eventSub) bool {
	select {
	case <-sub.ch:
		return true
	case <-time.After(50 * time.Millisecond):
		return false
	}
}

func TestEventHubScopesByHost(t *testing.T) {
	hub := newEventHub()
	admin, offAdmin := hub.subscribe("a", true)
	defer offAdmin()
	own, offOwn := hub.subscribe("u1", false)
	defer offOwn()
	other, offOther := hub.subscribe("u2", false)
	defer offOther()

	hub.publish("u1")
	if !receives(admin) || !receives(own) {
		t.Fatal("admin and the booking's host must be notified")
	}
	if receives(other) {
		t.Fatal("a member must not be notified about another host's booking")
	}

	hub.publish("") // unknown host reaches everyone
	if !receives(admin) || !receives(own) || !receives(other) {
		t.Fatal("an unknown host must notify every subscriber")
	}
}

func TestEventHubCoalescesAndUnsubscribes(t *testing.T) {
	hub := newEventHub()
	sub, off := hub.subscribe("u1", true)
	for i := 0; i < 5; i++ {
		hub.publish("u1") // must never block, even with nobody reading
	}
	if !receives(sub) {
		t.Fatal("expected one pending notification")
	}
	if receives(sub) {
		t.Fatal("notifications between two reads must collapse into one")
	}
	off()
	hub.publish("u1")
	if receives(sub) {
		t.Fatal("an unsubscribed listener must not be notified")
	}
}

func newEventsHandler() *Handler { return &Handler{events: newEventHub()} }

func TestStreamEventsRequiresAuth(t *testing.T) {
	h := newEventsHandler()
	rec := httptest.NewRecorder()
	h.StreamEvents(rec, httptest.NewRequest(http.MethodGet, "/v1/events", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestStreamEventsDeliversAndCloses(t *testing.T) {
	h := newEventsHandler()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), ctxKeyUser, AuthUser{ID: "u1", IsAdmin: false})
		h.StreamEvents(w, r.WithContext(ctx))
	}))
	defer srv.Close()

	resp, err := http.Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content-type = %q", ct)
	}

	lines := make(chan string, 16)
	go func() {
		sc := bufio.NewScanner(resp.Body)
		for sc.Scan() {
			lines <- sc.Text()
		}
		close(lines)
	}()
	next := func() string {
		select {
		case l, ok := <-lines:
			if !ok {
				return "<closed>"
			}
			return l
		case <-time.After(2 * time.Second):
			t.Fatal("timed out waiting for a stream line")
			return ""
		}
	}

	if got := next(); got != "retry: 5000" {
		t.Fatalf("first line = %q", got)
	}
	next() // blank line ending the retry frame

	// Wait until the handler has subscribed, then publish for this user's calendar.
	deadline := time.Now().Add(2 * time.Second)
	for {
		h.events.mu.Lock()
		n := len(h.events.subs)
		h.events.mu.Unlock()
		if n == 1 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("handler never subscribed")
		}
		time.Sleep(10 * time.Millisecond)
	}
	h.events.publish("u1")
	if got := next(); got != "event: bookings" {
		t.Fatalf("event line = %q", got)
	}
	if got := next(); got != "data: {}" {
		t.Fatalf("data line = %q", got)
	}

	h.CloseEvents()
	for {
		if l := next(); l == "<closed>" {
			return
		}
	}
}
