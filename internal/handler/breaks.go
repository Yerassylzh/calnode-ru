package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/calnode/calnode/internal/booking"
	"github.com/calnode/calnode/internal/slots"
	"github.com/calnode/calnode/internal/uid"
)

type doctorBreakJSON struct {
	ID        string  `json:"id"`
	UserID    string  `json:"user_id"`
	Kind      string  `json:"kind"` // "weekly" | "date"
	DayOfWeek *int    `json:"day_of_week,omitempty"`
	Date      *string `json:"date,omitempty"` // YYYY-MM-DD
	StartTime string  `json:"start_time"`     // HH:MM
	EndTime   string  `json:"end_time"`       // HH:MM
	Title     string  `json:"title"`
	CreatedAt string  `json:"created_at"`
}

// ListDoctorBreaks handles GET /v1/doctor-breaks.
// Query param: ?user_id=<id> (admins can query any doctor; members query themselves).
func (h *Handler) ListDoctorBreaks(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	targetUID := user.ID
	if qUID := r.URL.Query().Get("user_id"); qUID != "" {
		if user.IsAdmin || qUID == user.ID {
			targetUID = qUID
		} else {
			h.writeError(w, http.StatusForbidden, "admin access required to view other doctors' breaks")
			return
		}
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, user_id, kind, day_of_week, COALESCE(date, ''), start_time, end_time, title, created_at
		FROM doctor_breaks
		WHERE user_id = ?
		ORDER BY kind DESC, day_of_week ASC, date ASC, start_time ASC`, targetUID)
	if err != nil {
		h.logger.ErrorContext(r.Context(), "list doctor breaks", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()

	items := make([]doctorBreakJSON, 0)
	for rows.Next() {
		var b doctorBreakJSON
		var dow sql.NullInt64
		var dt string
		if err := rows.Scan(&b.ID, &b.UserID, &b.Kind, &dow, &dt, &b.StartTime, &b.EndTime, &b.Title, &b.CreatedAt); err != nil {
			h.logger.ErrorContext(r.Context(), "scan doctor break", "error", err)
			h.writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if dow.Valid {
			v := int(dow.Int64)
			b.DayOfWeek = &v
		}
		if dt != "" {
			b.Date = &dt
		}
		items = append(items, b)
	}
	if err := rows.Err(); err != nil {
		h.logger.ErrorContext(r.Context(), "list doctor breaks rows", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// CreateDoctorBreak handles POST /v1/doctor-breaks.
func (h *Handler) CreateDoctorBreak(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
	var req struct {
		UserID    *string `json:"user_id"`
		Kind      string  `json:"kind"`
		Date      *string `json:"date"`
		StartTime string  `json:"start_time"`
		EndTime   string  `json:"end_time"`
		Title     string  `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	targetUID := user.ID
	if req.UserID != nil && *req.UserID != "" {
		if user.IsAdmin || *req.UserID == user.ID {
			targetUID = *req.UserID
		} else {
			h.writeError(w, http.StatusForbidden, "admin access required to set breaks for other doctors")
			return
		}
	}

	if req.Kind != "date" {
		h.writeError(w, http.StatusBadRequest, "only one-time breaks can be created (kind must be 'date')")
		return
	}

	if req.Date == nil || *req.Date == "" {
		h.writeError(w, http.StatusBadRequest, "date is required for one-time breaks")
		return
	}
	if _, err := time.Parse("2006-01-02", *req.Date); err != nil {
		h.writeError(w, http.StatusBadRequest, "date must be in YYYY-MM-DD format")
		return
	}

	req.StartTime = strings.TrimSpace(req.StartTime)
	req.EndTime = strings.TrimSpace(req.EndTime)
	if !validHHMM(req.StartTime) || !validHHMM(req.EndTime) {
		h.writeError(w, http.StatusBadRequest, "start_time and end_time must be HH:MM (e.g. 13:00)")
		return
	}
	if req.StartTime >= req.EndTime {
		h.writeError(w, http.StatusBadRequest, "end_time must be after start_time")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "Перерыв"
	}

	id := uid.New()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	ctx := r.Context()
	var timezone string
	if err := h.db.QueryRowContext(ctx, `SELECT iana_timezone FROM users WHERE id = ? AND archived_at IS NULL`, targetUID).Scan(&timezone); err != nil {
		h.writeError(w, http.StatusNotFound, "staff member not found")
		return
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	start, _ := time.ParseInLocation("2006-01-02 15:04", *req.Date+" "+req.StartTime, loc)
	end, _ := time.ParseInLocation("2006-01-02 15:04", *req.Date+" "+req.EndTime, loc)
	if !start.Before(end) || start.Format("15:04") != req.StartTime || end.Format("15:04") != req.EndTime {
		h.writeError(w, http.StatusBadRequest, "invalid break time in the staff member's timezone")
		return
	}
	if _, _, err := h.calendarFreeHosts(ctx, &bookableEventType{}, []string{targetUID}, nil, nil, start, end); err != nil {
		if errors.Is(err, errSlotUnavailable) {
			h.writeError(w, http.StatusConflict, "this break overlaps a calendar event")
		} else {
			h.writeError(w, http.StatusServiceUnavailable, errCalendarUnavailable.Error())
		}
		return
	}
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "could not save break")
		return
	}
	defer tx.Rollback() //nolint:errcheck
	busy, err := booking.CheckBreakConflict(ctx, tx, targetUID, start, end)
	if err != nil {
		h.logger.ErrorContext(ctx, "check break conflict", "error", err)
		h.writeError(w, http.StatusInternalServerError, "could not check break conflicts")
		return
	}
	if busy {
		h.writeError(w, http.StatusConflict, "this break overlaps a booking or another break")
		return
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO doctor_breaks (id, user_id, kind, day_of_week, date, start_time, end_time, title, created_at)
		VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
		id, targetUID, req.Kind, *req.Date, req.StartTime, req.EndTime, title, now)
	if err != nil {
		h.logger.ErrorContext(r.Context(), "create doctor break", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		h.logger.ErrorContext(ctx, "commit break", "error", err)
		h.writeError(w, http.StatusInternalServerError, "could not save break")
		return
	}

	res := doctorBreakJSON{
		ID:        id,
		UserID:    targetUID,
		Kind:      req.Kind,
		Date:      req.Date,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Title:     title,
		CreatedAt: now,
	}
	h.writeJSON(w, http.StatusCreated, res)
}

// DeleteDoctorBreak handles DELETE /v1/doctor-breaks/{id}.
func (h *Handler) DeleteDoctorBreak(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := r.PathValue("id")
	var res sql.Result
	var err error
	if user.IsAdmin {
		res, err = h.db.ExecContext(r.Context(), `DELETE FROM doctor_breaks WHERE id = ?`, id)
	} else {
		res, err = h.db.ExecContext(r.Context(), `DELETE FROM doctor_breaks WHERE id = ? AND user_id = ?`, id, user.ID)
	}

	if err != nil {
		h.logger.ErrorContext(r.Context(), "delete doctor break", "error", err)
		h.writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		h.writeError(w, http.StatusNotFound, "break not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// applyBreaksToSchedule adjusts rules and overrides to carve out any doctor breaks.
func (h *Handler) applyBreaksToSchedule(ctx context.Context, userID string, rules []slots.AvailabilityRule, overrides []slots.AvailabilityOverride) ([]slots.AvailabilityRule, []slots.AvailabilityOverride, error) {
	rows, err := h.db.QueryContext(ctx, `
		SELECT kind, day_of_week, COALESCE(date, ''), start_time, end_time
		FROM doctor_breaks WHERE user_id = ?`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	type rawBreak struct {
		kind      string
		dow       int
		date      string
		startTime string
		endTime   string
	}
	var weeklyBreaks []rawBreak
	var dateBreaks []rawBreak

	for rows.Next() {
		var rb rawBreak
		var dow sql.NullInt64
		if err := rows.Scan(&rb.kind, &dow, &rb.date, &rb.startTime, &rb.endTime); err != nil {
			return nil, nil, err
		}
		if dow.Valid {
			rb.dow = int(dow.Int64)
		}
		if rb.kind == "weekly" {
			weeklyBreaks = append(weeklyBreaks, rb)
		} else {
			dateBreaks = append(dateBreaks, rb)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	if len(weeklyBreaks) == 0 && len(dateBreaks) == 0 {
		return rules, overrides, nil
	}

	// 1. Carve weekly breaks out of weekly rules
	adjustedRules := make([]slots.AvailabilityRule, 0, len(rules))
	for _, rule := range rules {
		currentWindows := [][2]string{{rule.StartTime, rule.EndTime}}
		for _, wb := range weeklyBreaks {
			if wb.dow != int(rule.DayOfWeek) {
				continue
			}
			var nextWindows [][2]string
			for _, win := range currentWindows {
				cut := subtractHHMM(win[0], win[1], wb.startTime, wb.endTime)
				nextWindows = append(nextWindows, cut...)
			}
			currentWindows = nextWindows
		}
		for _, w := range currentWindows {
			adjustedRules = append(adjustedRules, slots.AvailabilityRule{
				DayOfWeek: rule.DayOfWeek,
				StartTime: w[0],
				EndTime:   w[1],
			})
		}
	}

	// 2. Carve date breaks out of date overrides (or create custom hours for that date)
	adjustedOverrides := make([]slots.AvailabilityOverride, 0, len(overrides))
	overridesByDate := make(map[string][]slots.AvailabilityOverride)
	for _, ov := range overrides {
		ds := ov.Date.Format("2006-01-02")
		overridesByDate[ds] = append(overridesByDate[ds], ov)
	}

	dateBreaksByDate := make(map[string][]rawBreak)
	for _, db := range dateBreaks {
		dateBreaksByDate[db.date] = append(dateBreaksByDate[db.date], db)
	}

	for ds, ovList := range overridesByDate {
		dBreaks := dateBreaksByDate[ds]
		for _, wb := range weeklyBreaks {
			if wb.dow == int(ovList[0].Date.Weekday()) {
				dBreaks = append(dBreaks, wb)
			}
		}
		if len(dBreaks) == 0 {
			adjustedOverrides = append(adjustedOverrides, ovList...)
			continue
		}
		before := len(adjustedOverrides)
		for _, ov := range ovList {
			if !ov.IsAvailable || ov.StartTime == "" || ov.EndTime == "" {
				adjustedOverrides = append(adjustedOverrides, ov)
				continue
			}
			currentWindows := [][2]string{{ov.StartTime, ov.EndTime}}
			for _, db := range dBreaks {
				var nextWindows [][2]string
				for _, win := range currentWindows {
					cut := subtractHHMM(win[0], win[1], db.startTime, db.endTime)
					nextWindows = append(nextWindows, cut...)
				}
				currentWindows = nextWindows
			}
			for _, w := range currentWindows {
				adjustedOverrides = append(adjustedOverrides, slots.AvailabilityOverride{
					Date:        ov.Date,
					IsAvailable: true,
					StartTime:   w[0],
					EndTime:     w[1],
				})
			}
		}
		if len(adjustedOverrides) == before {
			adjustedOverrides = append(adjustedOverrides, slots.AvailabilityOverride{Date: ovList[0].Date})
		}
	}

	// For date breaks on dates with NO existing overrides: synthesize custom hours from weekly rules minus the date break
	for ds, dBreaks := range dateBreaksByDate {
		if _, exists := overridesByDate[ds]; exists {
			continue
		}
		d, err := time.Parse("2006-01-02", ds)
		if err != nil {
			continue
		}
		weekday := d.Weekday()
		var matchingRules []slots.AvailabilityRule
		for _, r := range adjustedRules {
			if r.DayOfWeek == weekday {
				matchingRules = append(matchingRules, r)
			}
		}
		before := len(adjustedOverrides)
		for _, r := range matchingRules {
			currentWindows := [][2]string{{r.StartTime, r.EndTime}}
			for _, db := range dBreaks {
				var nextWindows [][2]string
				for _, win := range currentWindows {
					cut := subtractHHMM(win[0], win[1], db.startTime, db.endTime)
					nextWindows = append(nextWindows, cut...)
				}
				currentWindows = nextWindows
			}
			for _, w := range currentWindows {
				adjustedOverrides = append(adjustedOverrides, slots.AvailabilityOverride{
					Date:        d,
					IsAvailable: true,
					StartTime:   w[0],
					EndTime:     w[1],
				})
			}
		}
		if len(adjustedOverrides) == before {
			adjustedOverrides = append(adjustedOverrides, slots.AvailabilityOverride{Date: d})
		}
	}

	return adjustedRules, adjustedOverrides, nil
}

// subtractHHMM cuts [cutStart, cutEnd] out of [origStart, origEnd], returning 0, 1, or 2 resulting intervals.
func subtractHHMM(origStart, origEnd, cutStart, cutEnd string) [][2]string {
	if cutEnd <= origStart || cutStart >= origEnd {
		return [][2]string{{origStart, origEnd}}
	}
	var out [][2]string
	if cutStart > origStart {
		out = append(out, [2]string{origStart, cutStart})
	}
	if cutEnd < origEnd {
		out = append(out, [2]string{cutEnd, origEnd})
	}
	return out
}
