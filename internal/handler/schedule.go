package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/calnode/calnode/internal/booking"
	"github.com/calnode/calnode/internal/slots"
)

func (h *Handler) scheduleStaff(w http.ResponseWriter, user AuthUser, staffID string) (string, bool) {
	if staffID == "" {
		staffID = user.ID
	}
	if staffID != user.ID && !user.IsAdmin {
		h.writeError(w, http.StatusForbidden, "admin access required to schedule for another staff member")
		return "", false
	}
	return staffID, true
}

type scheduleWindow struct {
	Start time.Time `json:"start_at"`
	End   time.Time `json:"end_at"`
}

const maxAppointmentMinutes = 24 * 60

// GetScheduleAvailability returns continuous staff working time after subtracting
// bookings, breaks, and connected-calendar conflicts.
func (h *Handler) GetScheduleAvailability(w http.ResponseWriter, r *http.Request) {
	user, _ := userFromContext(r.Context())
	q := r.URL.Query()
	staffID, ok := h.scheduleStaff(w, user, q.Get("staff_id"))
	if !ok {
		return
	}
	from, fromErr := time.Parse(time.RFC3339, q.Get("from"))
	to, toErr := time.Parse(time.RFC3339, q.Get("to"))
	if fromErr != nil || toErr != nil || !from.Before(to) || to.Sub(from) > 32*24*time.Hour {
		h.writeError(w, http.StatusBadRequest, "from and to must be RFC3339 instants spanning at most 32 days")
		return
	}
	if q.Has("event_type_slug") {
		h.writeError(w, http.StatusBadRequest, "use duration_minutes instead of event_type_slug")
		return
	}
	var minutes int
	if q.Has("duration_minutes") {
		var err error
		minutes, err = strconv.Atoi(q.Get("duration_minutes"))
		if err != nil || minutes < 1 || minutes > maxAppointmentMinutes {
			h.writeError(w, http.StatusBadRequest, "duration_minutes must be between 1 and 1440")
			return
		}
		// A duration query is for new bookings. The calendar uses the unfiltered
		// view so managers can still inspect previous weeks.
		if now := bookingNow().UTC(); from.Before(now) {
			from = now
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	loc, err := h.staffTimezone(ctx, staffID)
	if err != nil {
		h.writeStaffLookupError(w, err)
		return
	}
	result := make([]scheduleWindow, 0)
	if from.Before(to) {
		free, err := h.staffWindows(ctx, staffID, from, to)
		if errors.Is(err, errCalendarUnavailable) {
			h.writeError(w, http.StatusServiceUnavailable, errCalendarUnavailable.Error())
			return
		}
		if err != nil {
			h.logger.ErrorContext(ctx, "schedule availability", "error", err)
			h.writeError(w, http.StatusInternalServerError, "could not load availability")
			return
		}
		for _, window := range free {
			if window.End.Sub(window.Start) >= time.Duration(minutes)*time.Minute {
				result = append(result, scheduleWindow{Start: window.Start.In(loc), End: window.End.In(loc)})
			}
		}
	}
	h.writeJSON(w, http.StatusOK, map[string]any{
		"staff_id": staffID, "timezone": loc.String(), "windows": result,
		"duration_minutes": minutes,
	})
}

func (h *Handler) staffTimezone(ctx context.Context, staffID string) (*time.Location, error) {
	var timezone string
	if err := h.db.QueryRowContext(ctx, `SELECT iana_timezone FROM users WHERE id = ? AND archived_at IS NULL`, staffID).Scan(&timezone); err != nil {
		return nil, err
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return time.UTC, nil
	}
	return loc, nil
}

func (h *Handler) writeStaffLookupError(w http.ResponseWriter, err error) {
	if errors.Is(err, sql.ErrNoRows) {
		h.writeError(w, http.StatusNotFound, "staff member not found")
		return
	}
	h.logger.Error("schedule staff lookup", "error", err)
	h.writeError(w, http.StatusInternalServerError, "could not load staff member")
}

func (h *Handler) staffWindows(ctx context.Context, staffID string, from, to time.Time) ([]slots.Interval, error) {
	startDay := from.UTC().Truncate(24*time.Hour).AddDate(0, 0, -1)
	endDay := to.UTC().Truncate(24*time.Hour).AddDate(0, 0, 1)
	avail, degraded, err := h.hostAvailability(ctx, staffID, "", startDay, endDay)
	if err != nil {
		return nil, err
	}
	if degraded {
		return nil, errCalendarUnavailable
	}
	var working []slots.Interval
	for day := startDay; !day.After(endDay); day = day.AddDate(0, 0, 1) {
		windows, err := slots.ResolveDayWindows(avail.Location, day, avail.Rules, avail.Overrides)
		if err != nil {
			return nil, err
		}
		for _, window := range windows {
			clipped := slots.Interval{Start: window.Start, End: window.End}
			if clipped.Start.Before(from) {
				clipped.Start = from
			}
			if clipped.End.After(to) {
				clipped.End = to
			}
			if !clipped.IsEmpty() {
				working = append(working, clipped)
			}
		}
	}
	return slots.SubtractIntervals(working, avail.Busy), nil
}

// createStaffAppointment shares contact parsing, idempotency and notifications
// with the booking entry point while taking all timing from the appointment.
func (h *Handler) createStaffAppointment(w http.ResponseWriter, r *http.Request, staffID string, start time.Time, minutes int, attendee booking.Attendee, idemKey string) bool {
	if minutes < 1 || minutes > maxAppointmentMinutes {
		h.writeError(w, http.StatusBadRequest, "duration_minutes must be between 1 and 1440")
		return false
	}
	if start.Before(bookingNow()) {
		h.writeError(w, http.StatusBadRequest, "start_at cannot be in the past")
		return false
	}
	ctx := r.Context()
	if _, err := h.staffTimezone(ctx, staffID); err != nil {
		h.writeStaffLookupError(w, err)
		return false
	}
	end := start.Add(time.Duration(minutes) * time.Minute)
	err := h.validateStaffTime(ctx, staffID, start, end)
	var b *booking.Booking
	if err == nil {
		b, err = h.bookingSvc.Create(ctx, booking.CreateParams{
			HostIDs: []string{staffID}, StartAt: start, EndAt: end,
			Organizer: attendee, LocationType: "in_person",
			MaxBookingsPerHour: maxBookingsPerEmailPerHour,
		})
	}
	switch {
	case errors.Is(err, booking.ErrDoubleBooked), errors.Is(err, errSlotUnavailable):
		h.writeJSON(w, http.StatusConflict, map[string]string{"error": "This time is unavailable.", "code": "time_unavailable"})
		return false
	case errors.Is(err, errCalendarUnavailable):
		h.writeError(w, http.StatusServiceUnavailable, errCalendarUnavailable.Error())
		return false
	case errors.Is(err, booking.ErrEmailThrottled):
		h.writeError(w, http.StatusTooManyRequests, "too many recent bookings for this attendee")
		return false
	case err != nil:
		h.logger.ErrorContext(ctx, "create staff appointment", "error", err)
		h.writeError(w, http.StatusInternalServerError, "could not create appointment")
		return false
	}
	body, _ := json.Marshal(h.createdBookingJSON(b))
	if idemKey != "" {
		if err := h.finishIdempotencyKey(context.WithoutCancel(ctx), idemKey, http.StatusCreated, body, b.ID); err != nil {
			h.logger.ErrorContext(ctx, "store appointment idempotency response", "error", err)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write(body)
	go h.dispatchBookingConfirmation(b, bookingConfirmationInput{
		EventTypeName: "Appointment", LocationType: "in_person",
		OrganizerName: attendee.Name, OrganizerEmail: attendee.Email, OrganizerPhone: attendee.Phone,
		OrganizerTimezone: attendee.IANATimezone, OrganizerLocale: attendee.Locale,
	})
	return true
}

func (h *Handler) validateStaffTime(ctx context.Context, staffID string, start, end time.Time) error {
	ok, err := h.hostAvailableAt(ctx, staffID, "", start, end)
	if err != nil {
		return err
	}
	if !ok {
		return errSlotUnavailable
	}
	_, _, err = h.calendarFreeHosts(ctx, &bookableEventType{}, []string{staffID}, nil, nil, start, end)
	return err
}
