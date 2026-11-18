# Live updates

New, moved or cancelled bookings appear on screen by themselves, whoever made them: another
staff member, a client on the public page, or another system.

## How it works, in plain words

1. **The server taps the screens on the shoulder.** Whenever a booking is created, changed or
   cancelled, the server notes it and tells every signed-in admin screen that is allowed to
   see that calendar. The tap contains no booking details, only "something changed".
2. **The screen reloads quietly.** It fetches the fresh data without blanking the page.
3. **A safety net.** The screen also checks on its own every 15 seconds (every minute while
   the tap-on-the-shoulder link is working), whenever you return to the tab, and when the
   internet comes back. If the link breaks, nothing is lost; updates just arrive a little later.

## What the person sees

- The new or changed booking flashes briefly and a short message names it.
- "Updated 14:05" and a refresh button show the state; "No connection - retrying" appears
  when the server cannot be reached.
- Your own changes do not announce themselves back to you.
- If the booking you are editing was changed by someone else, you are told and can load the
  latest version.

## Where it lives

- Server: the "bookings changed" notice is sent from the booking service
  (`internal/booking/change.go`) and delivered by `internal/handler/events.go` at
  `/v1/events`.
- Screens: `frontend/src/lib/live/` (the checker, the change detector, the connection).
- Used by the Calendar and Bookings screens.

## Limits

- Only the week on screen is refreshed; changes in other weeks show when you go there.
- The tap on the shoulder works inside one server. Running several servers side by side would
  need something extra.
