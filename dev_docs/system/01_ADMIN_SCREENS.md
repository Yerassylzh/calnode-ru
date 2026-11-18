# Admin screens

The side menu is the map. It is short on purpose: only what staff use every day.

| Menu item | What it is for | Who sees it |
| --- | --- | --- |
| **Calendar** | The home screen. The week or day of one staff member: bookings, breaks, days off. Create, move, cancel here. | Everyone |
| **Bookings** | A searchable list of all appointments, upcoming and past. Move or cancel from here too. | Everyone |
| **Working hours** | Each person's weekly hours and one-off exceptions (days off, holidays, special hours). | Everyone |
| **Members** | Add staff, see roles, invite people. | Admins |
| **Recordings** | Saved video meetings. Appears only when video is set up. | Admins |
| **API keys** | Keys that let other systems create bookings automatically. | Everyone |
| **Settings** | Your profile, language, time format, notifications. | Everyone |

Under **Settings**, admins also get an **Advanced** group: Email, Video and Storage. These are
rarely needed and have no other place to be changed.

The menu can be collapsed to icons (the button at the bottom), and on a phone it opens as
an overlay.

## Removed on purpose

Teams, Connected apps, Webhooks, Integrations (external calendars, Zoom) and the Branding,
Google, Zoom, Payments, AI and Tracking settings pages. The server still supports them; only
the screens were taken away. Old links to them lead to the calendar or a "not found" page.

## Look and feel

- One small set of ready-made building blocks is used everywhere (buttons, dialogs, pickers).
  Screens do not invent their own.
- Dangerous actions (cancel, delete) always ask first.
- Times follow each person's own choice of 12/24 hours and first day of the week.
