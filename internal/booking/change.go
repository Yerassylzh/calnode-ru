package booking

// Change tells a listener that bookings changed. It deliberately carries no booking data:
// the receiver (the admin live-update stream) only needs to know whose calendar to refresh,
// and refetches through the normal authorised API.
type Change struct {
	// HostID is the host whose calendar changed, or "" when it is unknown or several hosts
	// are affected (the listener then treats it as relevant to everyone).
	HostID string
}

type changeHook struct{ fn func(Change) }

// SetOnChange registers fn to be called, synchronously and after the change is committed,
// whenever a booking is created, cancelled, rescheduled, reassigned or has its notes edited.
// fn must not block. Passing nil removes the hook. Safe to call while the service is in use.
func (s *Service) SetOnChange(fn func(Change)) {
	if fn == nil {
		s.onChange.Store(nil)
		return
	}
	s.onChange.Store(&changeHook{fn: fn})
}

func (s *Service) notify(hostID string) {
	if hook := s.onChange.Load(); hook != nil {
		hook.fn(Change{HostID: hostID})
	}
}
