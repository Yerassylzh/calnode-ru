# Calnode

**A lean, self-hostable scheduling engine that lives in your AI stack.**

Calnode is a Calendly-style booking app — with **first-party video meetings,
recording, and AI notetaking** built in — shipped as a **single Go binary** with an
embedded **SQLite** database: no Redis, no Postgres, no separate API server, no
multi-gigabyte image. It's API-first, webhook-native, and built for a world where
agents do the booking. Self-host the whole thing on a $5 box; nothing is paywalled.

> Calnode runs for pennies on a small VPS — it's a single static binary serving
> a SQLite file, so there's almost nothing to pay for.

`Apache-2.0` · `Go 1.26` · `single static binary` · `SQLite + Litestream`

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Calnode/calnode/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Calnode/calnode) · [Audit it yourself](AUDIT.md)

---

## Quick start

Kick the tires — one command, no config:

```bash
docker run -p 3000:3000 -v ./data:/data ghcr.io/calnode/calnode:latest
# → open http://localhost:3000
```

The whole app — booking pages, admin UI, SQLite — in one container, with data in
`./data`. With no encryption key set it runs on an ephemeral one (fine for a look;
stored credentials won't survive a restart). **Deploying for real** — HTTPS, a
persistent encryption key, backups — see **[Deploy for real](#deploy-for-real)** below,
or the full **[DEPLOY.md](DEPLOY.md)**.

---

## Why Calnode

- **One binary, one file.** Pure-Go SQLite (no CGO) compiles to a fully static
  binary. `docker run` it, or drop it on a VPS. No external services to orchestrate
  (built-in video, if you turn it on, is the one add-on — it needs a LiveKit server).
- **Meetings built in.** Optional first-party video rooms (LiveKit) as a booking
  location — guests join in-browser, no app or account. Recording lands in your own
  Litestream backup bucket (no extra storage to provision); an AI notetaker turns each
  call into a transcript + notes, exposed as MCP tools and webhooks. The one add-on:
  video needs a LiveKit endpoint (Cloud or self-hosted).
- **API-first, agent-ready.** A full REST API (88 endpoints) with API keys and
  **HMAC-signed webhooks configured *via API*** — script every booking action from
  Claude, ChatGPT, n8n, or curl. Plus a native **MCP server** built into the binary
  (official Go SDK; stdio + Streamable HTTP) so agents get first-class booking tools.
- **Modern, no bloat.** Go backend + a SvelteKit 5 admin app; public booking pages
  are server-rendered Go templates for instant first paint and a tiny payload.
- **Correct by construction.** DST-safe time handling (UTC instant + IANA name),
  a transactional double-booking guard, and native-API calendar free/busy (never
  stale `.ics` feeds).
- **Yours.** Instance-per-tenant by design — one deployment is one isolated
  workspace, your data, your calendar credentials. No shared multi-tenant database.
- **Easy to extend.** A clean Go codebase with `sqlc`-generated queries — not a
  100-package monorepo. Add an endpoint without spelunking.

---

## Calnode vs cal.com

The default open-source scheduler is a SaaS monolith. Calnode is the opposite.

| | cal.com | Calnode |
|---|---|---|
| **Codebase** | 500k+ LOC TS across ~100 packages | Lean Go + one SvelteKit app |
| **Runtime deps** | 4 GB+ image; needs Redis **+** Postgres **+** API server | One static binary + a SQLite file |
| **Database** | Postgres (+ Redis) | SQLite (WAL) + Litestream point-in-time backup |
| **Webhooks** | UI-only | **API-first**, HMAC-signed, per-webhook payloads |
| **AI / agents** | None | REST API + webhooks **+ a native MCP server** (stdio + HTTP) |
| **Video & recording** | Third-party links (Zoom / Meet) | **Built-in in-browser rooms + recording + AI notes** (self-hosted LiveKit) |
| **Deploy** | Orchestrate several services | `docker run` one container |
| **Isolation** | Shared multi-tenant DB (`org_id` everywhere) | Instance-per-tenant — isolation is the default |
| **Licence** | AGPL-3.0 | **Apache-2.0**, nothing paywalled for self-host |

*(cal.com figures reflect its public footprint; see the the design docs for the full rationale.)*

If you're weighing self-hosted schedulers and you want **small, fast, scriptable,
and AI-ready** over feature-maximal, Calnode is built for you.

---

## Staff scheduling over REST

The weekly calendar and agent integrations use staff working hours and exact appointment times.
Members can schedule themselves. Admins can pass another staff member's ID, listed by GET /v1/users.

```bash
curl -sG "$BASE/v1/schedule/availability" -H "Authorization: Bearer $API_KEY" \
  --data-urlencode "staff_id=$STAFF_ID" --data-urlencode "duration_minutes=20" \
  --data-urlencode "from=2026-12-07T09:00:00+05:00" \
  --data-urlencode "to=2026-12-07T18:00:00+05:00"

curl -s "$BASE/v1/schedule/bookings" -H "Authorization: Bearer $API_KEY" \
  -H 'Idempotency-Key: agent-request-123' -H 'Content-Type: application/json' \
  -d "{\"staff_id\":\"$STAFF_ID\",\"start_at\":\"2026-12-07T15:30:00+05:00\",\"duration_minutes\":20,\"name\":\"Alex\",\"email\":\"alex@example.com\",\"timezone\":\"Asia/Qyzylorda\"}"
```

Availability returns continuous windows with inclusive start_at and exclusive end_at in
the staff member's timezone. Pass duration_minutes to exclude past time and windows too
short for the appointment. Choose any start that leaves room for the full appointment.
Both endpoints default to the authenticated user's staff ID. Date ranges are limited to
32 days.

For rescheduling, pass `exclude_booking_id` to the availability endpoint. It checks the
booking's hosts and rules while allowing the appointment's own current time.

A booking requires a start, a duration in minutes, an attendee name, and an email or
contact_phone. On a 409 time_unavailable response, refresh availability and offer another
time. Retry an identical booking request with the same idempotency key. A 503 means a
connected calendar could not be checked.

Existing appointments and their management links are preserved. New bookings require
the authenticated staff API. Old public template links and widget booking have been retired.

Booking lifecycle webhooks are available for n8n and other integrations. MCP supports
reading and managing existing bookings over calnode mcp or POST /mcp. Use REST to
find availability and create new appointments.

## Deploy for real

```bash
docker run -d -p 3000:3000 \
  -e BASE_URL=https://booking.example.com \
  -e CALNODE_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e CALNODE_RECOVERY_SECRET="$(openssl rand -hex 32)" \
  -e DATABASE_URL=sqlite:///data/calnode.db \
  -v calnode-data:/data \
  ghcr.io/calnode/calnode:latest
```

**Pinning a version.** `:latest` follows the newest tagged release; `:edge` tracks
`main`. For reproducible deploys, pin a release — `:0.1` (tracks patches within the
minor) or an exact `:0.1.0`. See [releases](https://github.com/Calnode/calnode/releases).

Open `/` → it redirects to `/admin/` and walks you through first-run setup (create
the owner account, connect a calendar, set staff working hours). Put a TLS-terminating
proxy in front that forwards the original `Host` header.

**Full guide → [DEPLOY.md](DEPLOY.md)** (env vars, Railway step-by-step, custom
domains, Resend email, Google & Microsoft OAuth, Litestream backups, troubleshooting).

---

## Features

**Shipped**
- Event types with per-type duration, location, custom questions, custom email copy
- DST-correct availability (working hours, day-of-week rules, date overrides)
- Team routing: **fixed · round-robin · collective · priority**
- **Google Calendar & Microsoft 365 / Outlook** — native free/busy conflict checks
  behind one provider abstraction; auto **Google Meet / Teams** links, minted only
  when the host's connected calendar matches the platform (else a manual link is used)
- **Sign in with Google or Microsoft** (OAuth), email + password, or **passwordless magic-link**
- **CalDAV calendars** — iCloud / Fastmail / Nextcloud via app-password (free/busy + event write-back)
- Public booking + self-serve **reschedule/cancel** via signed manage links
- HTML branded email (logo, banner, business name, size/opacity) with add-to-calendar links
- REST API (88 endpoints) + API keys; **HMAC webhooks** with per-webhook payloads + delivery log
- **Native MCP server** (10 tools incl. meeting notes + transcript; stdio via `calnode mcp` + Streamable HTTP at `/mcp`)
- **Paid bookings** — Stripe Checkout (pay-then-book: the slot is held, confirmed on the payment webhook, auto-refunded on cancel)
- **Zoom** — per-host OAuth; a Zoom-located booking mints a meeting under the assigned host's account
- **Built-in video meetings (LiveKit)** — in-browser rooms as a booking location (no app or account for guests); host controls (end-for-all, hand-off **and reclaim** host, attendee screen-share toggle), **meeting recording** straight to your own **Litestream backup bucket** (the same one
  you already use for DB backup — no extra storage to provision) with in-app downloads, **recording consent** (notice + consent-or-leave), and an **AI notetaker** (Deepgram transcript → LLM notes). Headless-consumable: MCP `get_meeting_notes`/`get_transcript` + `recording.completed`/`transcript.ready`/`notes.ready` webhooks. BYO LiveKit endpoint (Cloud or self-hosted); configured in Settings → Video — see [docs/VIDEO.md](docs/VIDEO.md)
- **9 languages** on booking management pages, emails, and calendar invites: **English · Spanish · French ·
  Canadian French · German · Italian · Portuguese · Dutch · Swedish**. Picked from
  `Accept-Language` with a footer switcher and an operator-set fallback language; the
  booker's choice is stored on the booking, so reminders arrive in the language they
  booked in. Adding a language is adding one JSON file - no code change. *(The admin UI and the built-in video room are
  English-only. Non-English translations are machine drafts without native review -
  corrections by PR are very welcome.)*
- Embeddable booking widget (Shadow-DOM web component; inline + popup)
- Members, roles (owner/admin/member), email-token invitations
- `Idempotency-Key` on booking creation; transactional double-booking guard
- Envelope encryption at rest (secrets sealed with a KEK; recovery escrow)
- Optional analytics: `<head>` code injection + `window.dataLayer` events (GTM/GA4)

**On the roadmap**
- OpenAPI spec · `/metrics` · multi-domain (one instance, many hostnames)

---

## Stack

- **Backend:** Go 1.26 · pure-Go SQLite (`modernc.org/sqlite`, CGO-free → static binary) · `goose` migrations
- **Admin UI:** SvelteKit 2 / Svelte 5 · Vite 8 · Tailwind 4 · shadcn-svelte (embedded at compile time via `go:embed`)
- **Public pages:** server-rendered Go `html/template` + vanilla JS (no framework runtime)
- **Durability:** SQLite WAL + optional Litestream replication (S3/R2) for backup & point-in-time restore
- **Background work:** in-process job queue on the same DB — reminders, webhook delivery, calendar reconciliation. No broker.

---

## Design principles

A few load-bearing decisions (full detail in the the design docs):

- **The DB is the source of truth; external calendars are a projection.** A booking
  exists once it's committed locally; syncing to Google is a retryable side effect.
- **Time = UTC instant + IANA timezone name**, never a fixed offset — availability
  resolves to UTC per-date so DST shifts never corrupt a slot.
- **Single process, no external services.** Durability comes from Litestream, not a
  second datastore. (The one exception is optional built-in video: it talks to a
  LiveKit server — Cloud or self-hosted — only when you enable video.)
- **Instance-per-tenant.** Each install is one workspace; isolation is a feature,
  and the self-host and cloud codepaths are identical.

---

## Audit it yourself in 10 minutes

Calnode's backend is small enough to fit entirely in one LLM's context window —
most scheduling software (cal.com included) can't say that. **[AUDIT.md](AUDIT.md)**
turns that into a self-serve check: a copy-paste scanner block (govulncheck, gosec,
gitleaks across full history, SBOM, semgrep — all neutral, standard tooling you run
yourself), an adversarial LLM prompt-pack for your own coding agent, and
**[a claims → verification manifest](audit/claims.yaml)** mapping every security
claim we make to exactly how to check it in the source. Not a certification — a
due-diligence accelerator.

---

## Commercial support

Self-hosting is free forever — `docker run` it and you own the whole thing. If you'd
rather not run it yourself, **[Orchestratr](https://calnode.com/services)** — the team
behind Calnode — will deploy and operate it for you:

- **Production deployment** on your infrastructure — VPC, private cloud, or bare metal
- **SSO** (SAML / OIDC) integrated with Okta, Entra ID, or Google Workspace
- **Calendar, Zoom & CRM integration** wired into your existing stack
- **Migration** off Calendly / cal.com, plus bulk user & team provisioning
- **Training & ongoing support** for your ops and IT teams

Built for regulated and mid-to-large orgs that need Calnode on their own infrastructure,
fully integrated. → **[calnode.com/services](https://calnode.com/services)**

---

## License

[Apache-2.0](LICENSE). The full scheduler is self-hostable, and nothing previously
free is ever paywalled.

The **code** is Apache-2.0; the **"Calnode" name and logo** are not — see
[TRADEMARK.md](TRADEMARK.md) (use the code freely; name your fork something else).
Contributions are accepted under a [CLA](CLA.md) so the project can stand behind every
line and keep its future licensing options open — see [CONTRIBUTING.md](CONTRIBUTING.md).
