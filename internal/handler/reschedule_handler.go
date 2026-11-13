package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/calnode/calnode/internal/booking"
)

// RescheduleBooking handles PATCH /v1/bookings/{id}/reschedule (admin or primary host).
// Body: {"start_at":"<RFC3339>", "end_at":"<RFC3339>"(optional)}
// Without end_at the appointment's existing duration is preserved; with it the
// manager sets the exact start and end (so the duration may change too).
func (h *Handler) RescheduleBooking(w http.ResponseWriter, r *http.Request) {
	user, _ := userFromContext(r.Context())
	id := r.PathValue("id")
	r.Body = http.MaxBytesReader(w, r.Body, 4<<10)

	var req struct {
		StartAt string `json:"start_at"`
		EndAt   string `json:"end_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.StartAt == "" {
		h.writeError(w, http.StatusBadRequest, "start_at is required")
		return
	}
	newStart, err := time.Parse(time.RFC3339, req.StartAt)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, "start_at must be RFC3339 (e.g. 2026-06-15T09:00:00Z)")
		return
	}
	b, err := h.bookingSvc.Get(r.Context(), id)
	if errors.Is(err, booking.ErrNotFound) {
		h.writeError(w, http.StatusNotFound, "booking not found")
		return
	}
	if err != nil {
		h.logger.ErrorContext(r.Context(), "reschedule booking: load", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	// Return 404 for unauthorized access to avoid leaking booking IDs.
	if !user.IsAdmin && b.HostID != user.ID {
		h.writeError(w, http.StatusNotFound, "booking not found")
		return
	}
	if newStart.Before(bookingNow()) {
		h.writeError(w, http.StatusBadRequest, "start_at cannot be in the past")
		return
	}
	if b.Status == "cancelled" {
		h.writeError(w, http.StatusConflict, "this booking has been cancelled")
		return
	}

	newEnd := newStart.Add(b.EndAt.Sub(b.StartAt))
	if req.EndAt != "" {
		e, err := time.Parse(time.RFC3339, req.EndAt)
		if err != nil {
			h.writeError(w, http.StatusBadRequest, "end_at must be RFC3339 (e.g. 2026-06-15T09:30:00Z)")
			return
		}
		if !e.After(newStart) {
			h.writeError(w, http.StatusBadRequest, "end_at must be after start_at")
			return
		}
		newEnd = e
	}

	if err := h.validateRescheduleTime(r.Context(), id, b.EventTypeID, b.HostID, newStart, newEnd, true); err != nil {
		if errors.Is(err, errSlotUnavailable) {
			h.writeError(w, http.StatusConflict, "this slot is no longer available")
			return
		}
		if errors.Is(err, errCalendarUnavailable) {
			h.writeError(w, http.StatusServiceUnavailable, errCalendarUnavailable.Error())
			return
		}
		h.logger.ErrorContext(r.Context(), "reschedule booking: validate time", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	updated, err := h.bookingSvc.Reschedule(r.Context(), id, newStart, newEnd)
	if errors.Is(err, booking.ErrDoubleBooked) {
		h.writeError(w, http.StatusConflict, "that time slot is no longer available")
		return
	}
	if errors.Is(err, booking.ErrAlreadyCancelled) {
		h.writeError(w, http.StatusConflict, "this booking has been cancelled")
		return
	}
	if errors.Is(err, booking.ErrNotFound) {
		h.writeError(w, http.StatusNotFound, "booking not found")
		return
	}
	if err != nil {
		h.logger.ErrorContext(r.Context(), "reschedule booking: update", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	h.writeJSON(w, http.StatusOK, toBookingJSON(updated))

	go h.rescheduleSideEffects(*updated, b.EventTypeID, b.StartAt, b.EndAt) // #nosec G118 -- deliberately its own context.Background(); see rescheduleSideEffects' doc comment
}

// UpdateBookingNotes handles PATCH /v1/bookings/{id} (admin or primary host).
// Body: {"notes":"<text>"} — an empty string clears the notes. Times are changed
// through the reschedule endpoint, which validates availability and notifies.
func (h *Handler) UpdateBookingNotes(w http.ResponseWriter, r *http.Request) {
	user, _ := userFromContext(r.Context())
	id := r.PathValue("id")
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)

	var req struct {
		Notes *string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Notes == nil {
		h.writeError(w, http.StatusBadRequest, "notes is required")
		return
	}
	b, err := h.bookingSvc.Get(r.Context(), id)
	if errors.Is(err, booking.ErrNotFound) || (err == nil && !user.IsAdmin && b.HostID != user.ID) {
		h.writeError(w, http.StatusNotFound, "booking not found")
		return
	}
	if err != nil {
		h.logger.ErrorContext(r.Context(), "update booking notes: load", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	updated, err := h.bookingSvc.UpdateNotes(r.Context(), id, *req.Notes)
	switch {
	case errors.Is(err, booking.ErrNotesTooLong):
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	case errors.Is(err, booking.ErrAlreadyCancelled):
		h.writeError(w, http.StatusConflict, "this booking has been cancelled")
		return
	case errors.Is(err, booking.ErrNotFound):
		h.writeError(w, http.StatusNotFound, "booking not found")
		return
	case err != nil:
		h.logger.ErrorContext(r.Context(), "update booking notes", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	h.writeJSON(w, http.StatusOK, toBookingJSON(updated))
}
