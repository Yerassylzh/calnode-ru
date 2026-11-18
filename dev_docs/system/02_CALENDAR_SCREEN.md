# The calendar screen

The most used screen. Everything else in the admin app is a supporting cast.

## What is on it

1. **Top bar** - Today, previous/next, a date jump, Week/Day switch, staff picker, refresh,
   keyboard help, breaks, days off, and **New booking**.
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
| New booking | Click free time, or press `N`, or the New booking button |
| Change time | Click the booking, pick a free time chip; or drag the block to a new slot |
| Change length | Click the booking, pick a duration |
| Cancel | Click the booking, Cancel booking, confirm |
| Add a break or day off | Top bar buttons; click the block later to delete it |
| Move around | Arrow keys, `T` for today, `W` / `D` for week / day |

## Rules the screen follows

- Only times the server says are free are offered as choices.
- If you close a form with typed-in details, it asks before throwing them away.
- If someone else changes the booking you have open, a banner says so.
- A week with no working hours shows one clear notice instead of looking like seven days off.

## Where the parts live

All in `frontend/src/routes/` (the home page is the calendar):

- `+page.svelte` - the screen itself: loading, top bar, confirmations.
- `schedule/calendar-grid.svelte` - the grid and dragging.
- `schedule/schedule-form.svelte` - the pop-up form (new, change, cancel, breaks, days off).
- `schedule/event-surface.svelte` - decides pop-up beside the click versus dialog.
- `schedule/slot-picker.svelte`, `duration-chips.svelte`, `phone-field.svelte` - the form's pickers.
- Shared helpers: `frontend/src/lib/schedule/` (free-time and layout calculations).
