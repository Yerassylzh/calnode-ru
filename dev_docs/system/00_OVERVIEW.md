# Calnode at a glance

Calnode is a booking system. Clients book an appointment with a staff member, and the staff
see those appointments on a calendar.

## The four parts

| Part | Who uses it | Where it lives |
| --- | --- | --- |
| **Admin app** | Staff and managers | `frontend/` (opens at `/admin/`) |
| **Public booking pages** | Clients booking or changing an appointment | `internal/handler/templates/` and `internal/handler/embed.js` |
| **The server** | Everything above talks to it | `internal/` and `cmd/` (written in Go) |
| **The video room** | Online meetings | `internal/handler/templates/livekit-room.html` and `internal/handler/assets/` |

The admin app is built separately from the server and then packed into it, so changing the
admin app means rebuilding the frontend **and** the server.

## Rules of thumb

- The admin app and the public booking pages are separate things. Changing one never changes
  the other. Public pages deliberately avoid the admin app's tools.
- The server holds all the rules (who is free, what can be booked). The admin app only shows
  and asks; it never decides.
- Anything a person reads on screen exists in two languages (English and Russian). New text
  always needs both.

## Documents in this folder

- `01_ADMIN_SCREENS.md` - every admin screen and what it is for.
- `02_CALENDAR_SCREEN.md` - how the calendar screen is put together.
- `03_LIVE_UPDATES.md` - how new bookings appear without refreshing.
- `04_WHERE_TO_PUT_THINGS.md` - where a new feature should go.

Plans and the reasoning behind bigger changes are in `dev_docs/plan/`.
