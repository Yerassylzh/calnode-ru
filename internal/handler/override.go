package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/calnode/calnode/internal/booking"
	"github.com/calnode/calnode/internal/db"
	"github.com/calnode/calnode/internal/uid"
)

type availOverrideJSON struct {
	ID          string  `json:"id"`
	Date        string  `json:"date"` // YYYY-MM-DD
	IsAvailable bool    `json:"is_available"`
	Reason      string  `json:"reason"` // "day_off" | "out_of_office" | "custom_hours"
	Notes       string  `json:"notes,omitempty"`
	StartTime   *string `json:"start_time"`         // HH:MM; only when IsAvailable
	EndTime     *string `json:"end_time"`           // HH:MM; only when IsAvailable
	GroupID     *string `json:"group_id,omitempty"` // set on rows from a multi-day span
}

func validOverrideReason(r string) bool {
	return r == "day_off" || r == "out_of_office" || r == "custom_hours"
}

func (h *Handler) checkDayOffConflict(w http.ResponseWriter, r *http.Request, tx *sql.Tx, staffID, fromDate, toDate string, loc *time.Location) bool {
	from, _ := time.ParseInLocation(time.DateOnly, fromDate, loc)
	to, _ := time.ParseInLocation(time.DateOnly, toDate, loc)
	busy, err := booking.CheckDayOffConflict(r.Context(), tx, staffID, from, to.AddDate(0, 0, 1))
	if err != nil {
		h.logger.ErrorContext(r.Context(), "check day-off conflicts", "error", err)
		h.writeError(w, http.StatusInternalServerError, "could not check day-off conflicts")
		return false
	}
	if busy {
		h.writeJSON(w, http.StatusConflict, map[string]string{
			"error": "This day has bookings. Reschedule or cancel them before adding a day off.",
			"code":  "bookings_conflict",
		})
		return false
	}
	return true
}

// CreateAvailabilityOverride handles POST /v1/availability-overrides.
//
// Body:
//
//	{ "date": "YYYY-MM-DD", "is_available": bool,
//	  "start_time": "HH:MM", "end_time": "HH:MM" }
//
// start_time/end_time are required when is_available=true.
// Only one override per (user, date) is allowed; returns 409 if one already exists.
func (h *Handler) CreateAvailabilityOverride(w http.ResponseWriter, r *http.Request) {
	user, _ := userFromContext(r.Context())
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)

	var req struct {
		UserID    *string `json:"user_id"`
		Date      string  `json:"date"`
		EndDate   *string `json:"end_date"` // set for a multi-day out-of-office span
		Reason    string  `json:"reason"`
		Notes     string  `json:"notes"`
		StartTime *string `json:"start_time"`
		EndTime   *string `json:"end_time"`
		// Legacy field — ignored if reason is provided.
		IsAvailable *bool `json:"is_available"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	target := ""
	if req.UserID != nil {
		target = *req.UserID
	}
	targetUID, ok := h.scheduleStaff(w, user, target)
	if !ok {
		return
	}
	if utf8.RuneCountInString(req.Notes) > 5000 {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "notes must be at most 5000 characters", "code": "invalid_notes", "field": "notes"})
		return
	}
	req.Notes = strings.TrimSpace(req.Notes)
	loc, err := h.staffTimezone(r.Context(), targetUID)
	if err != nil {
		h.writeStaffLookupError(w, err)
		return
	}
	if req.Date == "" {
		h.writeError(w, http.StatusBadRequest, "date is required (YYYY-MM-DD)")
		return
	}
	if _, err := time.Parse("2006-01-02", req.Date); err != nil {
		h.writeError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
		return
	}
	// Derive reason: prefer explicit reason field, fall back to is_available for old callers.
	if req.Reason == "" {
		if req.IsAvailable != nil && *req.IsAvailable {
			req.Reason = "custom_hours"
		} else {
			req.Reason = "day_off"
		}
	}
	if !validOverrideReason(req.Reason) {
		h.writeError(w, http.StatusBadRequest, "reason must be 'day_off', 'out_of_office', or 'custom_hours'")
		return
	}
	isCustom := req.Reason == "custom_hours"
	if isCustom {
		if req.StartTime == nil || req.EndTime == nil || *req.StartTime == "" || *req.EndTime == "" {
			h.writeError(w, http.StatusBadRequest, "start_time and end_time are required for custom_hours")
			return
		}
		if !validHHMM(*req.StartTime) || !validHHMM(*req.EndTime) {
			h.writeError(w, http.StatusBadRequest, "start_time and end_time must be HH:MM (e.g. 09:00)")
			return
		}
		if *req.StartTime >= *req.EndTime {
			h.writeError(w, http.StatusBadRequest, "start_time must be before end_time")
			return
		}
		// A blocked date stays blocked until the block is removed: custom hours on a
		// blocked date would silently do nothing (blocking wins at resolve time), so
		// refuse with a message that says what to do instead.
		var blockReason string
		err := h.db.QueryRowContext(r.Context(),
			`SELECT reason FROM availability_overrides WHERE user_id = ? AND date = ? AND is_available = 0`,
			targetUID, req.Date).Scan(&blockReason)
		if err != nil && err != sql.ErrNoRows {
			h.logger.ErrorContext(r.Context(), "override custom: check block", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if err == nil {
			h.writeError(w, http.StatusConflict, "date is blocked ("+blockReason+"); remove the block first")
			return
		}
	} else {
		req.StartTime = nil
		req.EndTime = nil
	}

	// Date-range block: expand [date … end_date] into one blocked row per date, tied
	// by a shared group_id so the UI shows/deletes them as a single "out of office"
	// span. A range block replaces everything on those dates (custom blocks included);
	// slot generation reads the per-date rows. Custom hours cannot span dates — add
	// one block per date instead (#95).
	if req.EndDate != nil && *req.EndDate != "" {
		if isCustom {
			h.writeError(w, http.StatusBadRequest, "a date range is only for 'day_off' or 'out_of_office', not custom hours")
			return
		}
		startDate, _ := time.Parse("2006-01-02", req.Date) // req.Date already validated above
		endDate, err := time.Parse("2006-01-02", *req.EndDate)
		if err != nil {
			h.writeError(w, http.StatusBadRequest, "end_date must be YYYY-MM-DD")
			return
		}
		if endDate.Before(startDate) {
			h.writeError(w, http.StatusBadRequest, "end_date must be on or after date")
			return
		}
		if endDate.Sub(startDate) > 366*24*time.Hour {
			h.writeError(w, http.StatusBadRequest, "date range is too long (max 366 days)")
			return
		}
		groupID := uid.New()
		tx, err := h.db.BeginTx(r.Context(), nil)
		if err != nil {
			h.logger.ErrorContext(r.Context(), "override range: begin tx", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		defer tx.Rollback() //nolint:errcheck
		if !h.checkDayOffConflict(w, r, tx, targetUID, req.Date, *req.EndDate, loc) {
			return
		}
		days := 0
		for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
			ds := d.Format("2006-01-02")
			if _, err := tx.ExecContext(r.Context(),
				`DELETE FROM availability_overrides WHERE user_id = ? AND date = ?`,
				targetUID, ds); err != nil {
				h.logger.ErrorContext(r.Context(), "override range: clear date", "error", err)
				h.writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
			if _, err := tx.ExecContext(r.Context(), `
				INSERT INTO availability_overrides (id, user_id, date, is_available, reason, start_time, end_time, group_id, notes)
				VALUES (?, ?, ?, 0, ?, NULL, NULL, ?, ?)`,
				uid.New(), targetUID, ds, req.Reason, groupID, req.Notes); err != nil {
				h.logger.ErrorContext(r.Context(), "override range: insert", "error", err)
				h.writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
			days++
		}
		if err := tx.Commit(); err != nil {
			h.logger.ErrorContext(r.Context(), "override range: commit", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		h.writeJSON(w, http.StatusCreated, map[string]any{
			"group_id": groupID, "reason": req.Reason, "notes": req.Notes, "start": req.Date, "end": *req.EndDate, "days": days,
		})
		return
	}

	// Single-date blocking override: replaces everything on the date (custom blocks
	// included), same as a one-day range above.
	if !isCustom {
		tx, err := h.db.BeginTx(r.Context(), nil)
		if err != nil {
			h.logger.ErrorContext(r.Context(), "override block: begin tx", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		defer tx.Rollback() //nolint:errcheck
		if !h.checkDayOffConflict(w, r, tx, targetUID, req.Date, req.Date, loc) {
			return
		}
		if _, err := tx.ExecContext(r.Context(),
			`DELETE FROM availability_overrides WHERE user_id = ? AND date = ?`,
			targetUID, req.Date); err != nil {
			h.logger.ErrorContext(r.Context(), "override block: clear date", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		id := uid.New()
		if _, err := tx.ExecContext(r.Context(), `
			INSERT INTO availability_overrides (id, user_id, date, is_available, reason, start_time, end_time, notes)
			VALUES (?, ?, ?, 0, ?, NULL, NULL, ?)`,
			id, targetUID, req.Date, req.Reason, req.Notes); err != nil {
			h.logger.ErrorContext(r.Context(), "override block: insert", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if err := tx.Commit(); err != nil {
			h.logger.ErrorContext(r.Context(), "override block: commit", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		h.writeJSON(w, http.StatusCreated, availOverrideJSON{
			ID: id, Date: req.Date, IsAvailable: false, Reason: req.Reason, Notes: req.Notes,
		})
		return
	}

	// Single custom-hours block. Several blocks may share the date (#95); only an
	// exact duplicate is rejected.
	id := uid.New()
	if _, err := h.db.ExecContext(r.Context(), `
		INSERT INTO availability_overrides (id, user_id, date, is_available, reason, start_time, end_time, notes)
		VALUES (?, ?, ?, 1, 'custom_hours', ?, ?, ?)`,
		id, targetUID, req.Date, req.StartTime, req.EndTime, req.Notes); err != nil {
		if db.IsUniqueViolation(err) {
			h.writeError(w, http.StatusConflict, "those exact hours already exist for this date")
			return
		}
		h.logger.ErrorContext(r.Context(), "create availability override", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	h.writeJSON(w, http.StatusCreated, availOverrideJSON{
		ID: id, Date: req.Date, IsAvailable: true, Reason: "custom_hours", Notes: req.Notes,
		StartTime: req.StartTime, EndTime: req.EndTime,
	})
}

// ListAvailabilityOverrides handles GET /v1/availability-overrides.
func (h *Handler) ListAvailabilityOverrides(w http.ResponseWriter, r *http.Request) {
	user, _ := userFromContext(r.Context())

	targetUID := user.ID
	if qUID := r.URL.Query().Get("user_id"); qUID != "" && (user.IsAdmin || qUID == user.ID) {
		targetUID = qUID
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, date, is_available, COALESCE(reason,'day_off'),
		       COALESCE(start_time,''), COALESCE(end_time,''), group_id, notes
		FROM availability_overrides
		WHERE user_id = ?
		ORDER BY date`, targetUID)
	if err != nil {
		h.logger.ErrorContext(r.Context(), "list availability overrides", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()

	items := make([]availOverrideJSON, 0)
	for rows.Next() {
		var item availOverrideJSON
		var isAvail int
		var startT, endT string
		var groupID sql.NullString
		if err := rows.Scan(&item.ID, &item.Date, &isAvail, &item.Reason, &startT, &endT, &groupID, &item.Notes); err != nil {
			h.logger.ErrorContext(r.Context(), "scan availability override", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		item.IsAvailable = isAvail != 0
		if item.IsAvailable && startT != "" {
			item.StartTime = &startT
			item.EndTime = &endT
		}
		if groupID.Valid && groupID.String != "" {
			item.GroupID = &groupID.String
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		h.logger.ErrorContext(r.Context(), "list overrides rows", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	h.writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// UpdateAvailabilityOverride handles PATCH /v1/availability-overrides/{id}.
func (h *Handler) UpdateAvailabilityOverride(w http.ResponseWriter, r *http.Request) {
	user, _ := userFromContext(r.Context())
	id := r.PathValue("id")
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)

	var req struct {
		Reason    *string `json:"reason"`
		Notes     *string `json:"notes"`
		StartTime *string `json:"start_time"`
		EndTime   *string `json:"end_time"`
		// Legacy field — accepted but reason takes precedence.
		IsAvailable *bool `json:"is_available"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "could not update availability")
		return
	}
	defer tx.Rollback() //nolint:errcheck
	var current availOverrideJSON
	var isAvail int
	var startT, endT, ownerID, timezone string
	err = tx.QueryRowContext(r.Context(),
		`SELECT o.id, o.date, o.is_available, COALESCE(o.reason,'day_off'),
		        COALESCE(o.start_time,''), COALESCE(o.end_time,''), o.notes, o.user_id, u.iana_timezone
		 FROM availability_overrides o JOIN users u ON u.id = o.user_id
		 WHERE o.id = ? AND (o.user_id = ? OR ?)`, id, user.ID, user.IsAdmin).
		Scan(&current.ID, &current.Date, &isAvail, &current.Reason, &startT, &endT, &current.Notes, &ownerID, &timezone)
	if err == sql.ErrNoRows {
		h.writeError(w, http.StatusNotFound, "override not found")
		return
	}
	if err != nil {
		h.logger.ErrorContext(r.Context(), "update availability override: fetch", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	current.IsAvailable = isAvail != 0
	if req.Notes != nil {
		if utf8.RuneCountInString(*req.Notes) > 5000 {
			h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "notes must be at most 5000 characters", "code": "invalid_notes", "field": "notes"})
			return
		}
		current.Notes = strings.TrimSpace(*req.Notes)
	}
	if current.IsAvailable && startT != "" {
		current.StartTime = &startT
		current.EndTime = &endT
	}

	if req.Reason != nil {
		if !validOverrideReason(*req.Reason) {
			h.writeError(w, http.StatusBadRequest, "reason must be 'day_off', 'out_of_office', or 'custom_hours'")
			return
		}
		current.Reason = *req.Reason
	} else if req.IsAvailable != nil {
		// Legacy fallback.
		if *req.IsAvailable {
			current.Reason = "custom_hours"
		} else if current.Reason == "custom_hours" {
			current.Reason = "day_off"
		}
	}
	current.IsAvailable = current.Reason == "custom_hours"

	if req.StartTime != nil {
		if !validHHMM(*req.StartTime) {
			h.writeError(w, http.StatusBadRequest, "start_time must be HH:MM (e.g. 09:00)")
			return
		}
		current.StartTime = req.StartTime
	}
	if req.EndTime != nil {
		if !validHHMM(*req.EndTime) {
			h.writeError(w, http.StatusBadRequest, "end_time must be HH:MM (e.g. 09:00)")
			return
		}
		current.EndTime = req.EndTime
	}

	if current.IsAvailable {
		if current.StartTime == nil || current.EndTime == nil || *current.StartTime == "" || *current.EndTime == "" {
			h.writeError(w, http.StatusBadRequest, "start_time and end_time are required for custom_hours")
			return
		}
		if *current.StartTime >= *current.EndTime {
			h.writeError(w, http.StatusBadRequest, "start_time must be before end_time")
			return
		}
	} else {
		current.StartTime = nil
		current.EndTime = nil
	}

	isAvailInt := 0
	if current.IsAvailable {
		isAvailInt = 1
	}
	// Flipping to blocked clears sibling custom blocks on the date: a date is either
	// blocked or custom, never both (same rule as create).
	if !current.IsAvailable {
		loc, err := time.LoadLocation(timezone)
		if err != nil {
			loc = time.UTC
		}
		if !h.checkDayOffConflict(w, r, tx, ownerID, current.Date, current.Date, loc) {
			return
		}
		if _, err := tx.ExecContext(r.Context(),
			`DELETE FROM availability_overrides WHERE user_id = ? AND date = ? AND id != ? AND is_available = 1`,
			ownerID, current.Date, id); err != nil {
			h.logger.ErrorContext(r.Context(), "update availability override: clear customs", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
	}
	if _, err := tx.ExecContext(r.Context(),
		`UPDATE availability_overrides SET is_available=?, reason=?, start_time=?, end_time=?, notes=? WHERE id=? AND user_id=?`,
		isAvailInt, current.Reason, current.StartTime, current.EndTime, current.Notes, id, ownerID); err != nil {
		if db.IsUniqueViolation(err) {
			h.writeError(w, http.StatusConflict, "those exact hours already exist for this date")
			return
		}
		h.logger.ErrorContext(r.Context(), "update availability override", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		h.writeError(w, http.StatusInternalServerError, "could not update availability")
		return
	}
	h.writeJSON(w, http.StatusOK, current)
}

// DeleteAvailabilityOverride handles DELETE /v1/availability-overrides/{id}.
func (h *Handler) DeleteAvailabilityOverride(w http.ResponseWriter, r *http.Request) {
	user, _ := userFromContext(r.Context())
	id := r.PathValue("id")

	var res sql.Result
	var err error
	if user.IsAdmin {
		res, err = h.db.ExecContext(r.Context(), `DELETE FROM availability_overrides WHERE id = ?`, id)
	} else {
		res, err = h.db.ExecContext(r.Context(), `DELETE FROM availability_overrides WHERE id = ? AND user_id = ?`, id, user.ID)
	}
	if err != nil {
		h.logger.ErrorContext(r.Context(), "delete availability override", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		h.writeError(w, http.StatusNotFound, "override not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteAvailabilityOverrideGroup handles DELETE /v1/availability-overrides/group/{groupId}
// — removes every per-date row of a multi-day span in one call.
func (h *Handler) DeleteAvailabilityOverrideGroup(w http.ResponseWriter, r *http.Request) {
	user, _ := userFromContext(r.Context())
	groupID := r.PathValue("groupId")

	var res sql.Result
	var err error
	if user.IsAdmin {
		res, err = h.db.ExecContext(r.Context(), `DELETE FROM availability_overrides WHERE group_id = ?`, groupID)
	} else {
		res, err = h.db.ExecContext(r.Context(), `DELETE FROM availability_overrides WHERE group_id = ? AND user_id = ?`, groupID, user.ID)
	}
	if err != nil {
		h.logger.ErrorContext(r.Context(), "delete availability override group", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		h.writeError(w, http.StatusNotFound, "no overrides found for that group")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// validHHMM returns true if s is a valid "HH:MM" time string.
func validHHMM(s string) bool {
	if len(s) != 5 || s[2] != ':' {
		return false
	}
	for _, c := range []byte{s[0], s[1], s[3], s[4]} {
		if c < '0' || c > '9' {
			return false
		}
	}
	h := int(s[0]-'0')*10 + int(s[1]-'0')
	m := int(s[3]-'0')*10 + int(s[4]-'0')
	return h <= 23 && m <= 59
}
