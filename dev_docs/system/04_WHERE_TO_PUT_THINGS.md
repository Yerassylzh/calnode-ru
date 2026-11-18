# Where to put things

A short guide for deciding where a new feature belongs.

## First question: who is it for?

| If it is for... | Put it in |
| --- | --- |
| Staff and managers | The admin app, `frontend/src/routes/` |
| Clients booking or managing an appointment | The public pages, `internal/handler/templates/` (and `embed.js` for websites that embed the booking box) |
| Rules about what can be booked | The server, `internal/booking/` and `internal/handler/` |

A client-facing change usually has to be made in three places: the booking page, the manage
page and the embed box. See `CLAUDE.md` before touching those.

## Adding something to the admin app

| You want to add... | Where |
| --- | --- |
| A new screen | A new folder in `frontend/src/routes/`, plus a menu entry in `routes/+layout.svelte`. Think twice: the menu is deliberately short. |
| A setting for one person | Settings, Profile or Notifications |
| A workspace-wide setting nobody else sets | Settings, Advanced |
| Something to do with a booking | The calendar pop-up form (`schedule/schedule-form.svelte`); the Bookings list reuses it |
| A new kind of block on the calendar | `schedule/calendar-grid.svelte` |
| Text on screen | `frontend/src/lib/i18n/catalogs/` - add English and Russian together |
| A reusable piece (button, dialog, picker) | Use the existing ones in `frontend/src/lib/components/ui/` first |
| Something that should update live | Use the existing live-update helpers in `frontend/src/lib/live/` |

## Before you build

1. Can an existing screen do it with a small change?
2. If it needs a new screen, can it replace an old one instead of adding to the menu?
3. Does it need new rules from the server? Then the server changes first.
4. After changing the admin app, rebuild the frontend and the server, then try it for real.
