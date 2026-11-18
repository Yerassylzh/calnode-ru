package booking_test

import (
	"context"
	"sync"
	"testing"

	"github.com/calnode/calnode/internal/booking"
)

type changeLog struct {
	mu    sync.Mutex
	hosts []string
}

func (l *changeLog) record(c booking.Change) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.hosts = append(l.hosts, c.HostID)
}

func (l *changeLog) take() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := l.hosts
	l.hosts = nil
	return out
}

func TestOnChangeFiresForEveryMutation(t *testing.T) {
	database := newTestDB(t)
	svc := booking.New(database)
	hostID := seedHost(t, database)
	etID := seedEventType(t, database, hostID)
	var log changeLog
	svc.SetOnChange(log.record)
	ctx := context.Background()

	b, err := svc.Create(ctx, booking.CreateParams{
		EventTypeID: etID,
		HostIDs:     []string{hostID},
		StartAt:     slot(9, 0),
		EndAt:       slot(9, 30),
		Organizer:   booking.Attendee{Name: "Alice", Email: "alice@example.com"},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got := log.take(); len(got) != 1 || got[0] != hostID {
		t.Fatalf("Create notified %v, want [%s]", got, hostID)
	}

	if _, err := svc.UpdateNotes(ctx, b.ID, "bring documents"); err != nil {
		t.Fatalf("UpdateNotes: %v", err)
	}
	if got := log.take(); len(got) != 1 || got[0] != hostID {
		t.Fatalf("UpdateNotes notified %v, want [%s]", got, hostID)
	}

	if _, err := svc.Reschedule(ctx, b.ID, slot(10, 0), slot(10, 30)); err != nil {
		t.Fatalf("Reschedule: %v", err)
	}
	if got := log.take(); len(got) != 1 || got[0] != hostID {
		t.Fatalf("Reschedule notified %v, want [%s]", got, hostID)
	}

	if err := svc.Cancel(ctx, hostID, b.ID, "test"); err != nil {
		t.Fatalf("Cancel: %v", err)
	}
	if got := log.take(); len(got) != 1 || got[0] != hostID {
		t.Fatalf("Cancel notified %v, want [%s]", got, hostID)
	}

	// A failed mutation must not notify.
	if err := svc.Cancel(ctx, hostID, b.ID, "again"); err == nil {
		t.Fatal("second Cancel should fail")
	}
	if got := log.take(); len(got) != 0 {
		t.Fatalf("failed Cancel notified %v, want nothing", got)
	}
}

func TestOnChangeCanBeRemoved(t *testing.T) {
	database := newTestDB(t)
	svc := booking.New(database)
	hostID := seedHost(t, database)
	etID := seedEventType(t, database, hostID)
	var log changeLog
	svc.SetOnChange(log.record)
	svc.SetOnChange(nil)

	if _, err := svc.Create(context.Background(), booking.CreateParams{
		EventTypeID: etID,
		HostIDs:     []string{hostID},
		StartAt:     slot(11, 0),
		EndAt:       slot(11, 30),
		Organizer:   booking.Attendee{Name: "Bob", Email: "bob@example.com"},
	}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got := log.take(); len(got) != 0 {
		t.Fatalf("removed hook still notified %v", got)
	}
}
