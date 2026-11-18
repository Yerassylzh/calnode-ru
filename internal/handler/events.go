package handler

import (
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Live updates for the admin app: a Server-Sent Events stream that tells a signed-in browser
// "bookings changed, refetch". It carries no booking data - the browser refetches through the
// normal authorised API, so this endpoint cannot leak anything the list endpoints would not.
// The admin UI keeps polling as a slow fallback, so a dropped stream only costs latency.

const (
	eventsHeartbeat   = 25 * time.Second // keeps proxies and idle timeouts from closing the stream
	eventsMaxLifetime = 10 * time.Minute // EventSource reconnects by itself; bounds stale connections
)

// eventSub is one connected browser. ch is a coalescing doorbell: any number of changes
// between two reads collapse into a single "refetch".
type eventSub struct {
	userID string
	admin  bool
	ch     chan struct{}
}

type eventHub struct {
	mu   sync.Mutex
	subs map[*eventSub]struct{}
	done chan struct{}
	once sync.Once
}

func newEventHub() *eventHub {
	return &eventHub{subs: make(map[*eventSub]struct{}), done: make(chan struct{})}
}

func (hub *eventHub) subscribe(userID string, admin bool) (*eventSub, func()) {
	sub := &eventSub{userID: userID, admin: admin, ch: make(chan struct{}, 1)}
	hub.mu.Lock()
	hub.subs[sub] = struct{}{}
	hub.mu.Unlock()
	return sub, func() {
		hub.mu.Lock()
		delete(hub.subs, sub)
		hub.mu.Unlock()
	}
}

// publish rings the doorbell of every subscriber who could see the affected calendar: admins
// see every host, members only their own. An empty hostID (unknown, or several hosts) reaches
// everyone - harmless, since it only triggers a refetch of what each user may already read.
func (hub *eventHub) publish(hostID string) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	for sub := range hub.subs {
		if hostID == "" || sub.admin || sub.userID == hostID {
			select {
			case sub.ch <- struct{}{}:
			default: // already pending
			}
		}
	}
}

// Close ends every open stream (used at shutdown so graceful drain is not held up by them).
func (hub *eventHub) Close() { hub.once.Do(func() { close(hub.done) }) }

// CloseEvents ends all open live-update streams.
func (h *Handler) CloseEvents() { h.events.Close() }

// StreamEvents handles GET /v1/events (authenticated): an SSE stream of "bookings" events.
func (h *Handler) StreamEvents(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		h.writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	// The server's WriteTimeout is for ordinary responses; a stream must outlive it.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})

	hdr := w.Header()
	hdr.Set("Content-Type", "text/event-stream")
	hdr.Set("Cache-Control", "no-cache, no-transform")
	hdr.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	if _, err := fmt.Fprint(w, "retry: 5000\n\n"); err != nil {
		return
	}
	flusher.Flush()

	sub, unsubscribe := h.events.subscribe(user.ID, user.IsAdmin)
	defer unsubscribe()

	heartbeat := time.NewTicker(eventsHeartbeat)
	defer heartbeat.Stop()
	lifetime := time.NewTimer(eventsMaxLifetime)
	defer lifetime.Stop()

	for {
		var frame string
		select {
		case <-r.Context().Done():
			return
		case <-h.events.done:
			return
		case <-lifetime.C:
			return
		case <-sub.ch:
			frame = "event: bookings\ndata: {}\n\n"
		case <-heartbeat.C:
			frame = ": ping\n\n"
		}
		if _, err := fmt.Fprint(w, frame); err != nil {
			return
		}
		flusher.Flush()
	}
}
