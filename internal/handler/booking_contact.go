package handler

import (
	"github.com/calnode/calnode/internal/booking"
	"net/http"
)

// createdBookingJSON must only be used for the response to a booking's creator.
// Never expose the capability through the public GET or list representations.
func (h *Handler) createdBookingJSON(b *booking.Booking) bookingJSON {
	j := toBookingJSON(b)
	j.ContactMethod = b.ContactMethod
	if b.ManageToken != "" {
		j.ManageURL = h.publicURL() + "/manage/" + b.ManageToken
	}
	return j
}

func (h *Handler) writeContactError(w http.ResponseWriter, err error) {
	h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error(), "code": "invalid_booking_contact"})
}
