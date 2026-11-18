# The calendar screen

The most used screen. Everything else in the admin app is a supporting cast.

## What is on it

1. **Top bar** - previous/next arrows, the date (click it to jump to any date), a Week/Day
   switch, the staff picker, and one **+** button. The + opens a small menu: New booking, Add
   break, Add day off. Nothing else is up there.
2. **The grid** - days across, hours down. Scrolls up and down and opens near the first
   appointment of the week.
   - Blue blocks are bookings, yellow are breaks.
   - Hatched areas are outside working hours.
   - White space is free time. Pointing at it previews a new booking; clicking creates one.
   - A red line marks the current time.
   - Overlapping bookings sit side by side.
3. **Pop-up form** - appears beside whatever was clicked (a full dialog on phones). Used to
   create, view, move and cancel a booking.

## What staff can do, and how

| Goal | How |
| --- | --- |
| New booking | Click free time, or + then New booking |
| Change time | Click the booking and type the new time; or drag the block to a new slot |
| Change length | Click the booking and type the new length in minutes |
| Cancel | Click the booking, Cancel booking, confirm |
| Add a break or day off | + then Add break / Add day off; click the block later to delete it |
| Move around | The arrows, or click the date to jump anywhere (today is highlighted) |

## Rules the screen follows

- The form is short and does not scroll: name, phone, date, time, length, optional note.
- Date is picked from a calendar; time (`1430` becomes 14:30) and length in minutes are typed.
  A time that does not fit is flagged straight away. There are no arrows or suggestion buttons.
- There are no keyboard shortcuts on purpose.
- If you close a form with typed-in details, it asks before throwing them away.
- If someone else changes the booking you have open, a banner says so.
- A week with no working hours shows one clear notice instead of looking like seven days off.

## Where the parts live

All in `frontend/src/routes/` (the home page is the calendar):

- `+page.svelte` - the screen itself: loading, top bar, confirmations.
- `schedule/calendar-grid.svelte` - the grid and dragging.
- `schedule/schedule-form.svelte` - the pop-up form (new, change, cancel, breaks, days off).
- `schedule/event-surface.svelte` - decides pop-up beside the click versus dialog.
- `schedule/time-input.svelte`, `phone-field.svelte` - the form's fields.
- Shared helpers: `frontend/src/lib/schedule/` (free-time and layout calculations).


