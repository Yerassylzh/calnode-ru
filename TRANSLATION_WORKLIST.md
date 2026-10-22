# Russian localization worklist

Repository audit only. Localization has NOT been implemented. This worklist follows the request to hand off a large translation task to a cheaper model.

## Size and existing public translations

The admin routes contain 8,158 nonblank source lines across 31 Svelte files. These are source lines, not a count of translation strings; much of this is application logic and markup. Shared components add further text. An exact admin message count requires extraction first.

The public dictionary is much smaller: `internal/i18n/locales/en.json` contains exactly 169 keys. Translate its VALUES into a new `internal/i18n/locales/ru-RU.json`, preserving every existing key and placeholder. This filename follows the existing `fr-CA.json` regional-locale convention and satisfies the requested ru-RU locale. No public translation key needs inventing.

`internal/i18n/i18n.go` embeds and discovers all locale JSON files automatically. It already handles language negotiation, English fallback, native language names and the public language selector. Russian browser-header matching and explicit overrides still need tests.

This dictionary already covers booking pages, management, embeds, booking email messages, calendar invitation summary/description text, errors, directory pages and the booking assistant. These surfaces share translations; do not translate their source independently or modify protocol identifiers.

Public translation requirements:

- Keep `%s`, `%d`, `%q`, indexed placeholders such as `%[1]s`, and literal percent escapes intact. Keep JSON valid and preserve intended leading/trailing whitespace.
- `clock_format` is a configuration value: use `24h`, not a Russian translation of that token.
- `date_format` is a formatting pattern with arguments 1=weekday, 2=day, 3=month, 4=year. Retain argument types and choose a Russian display order.
- Match short month/weekday values to Russian Intl/CLDR abbreviations. See `internal/i18n/cldr_test.go` and `internal/i18n/datetime.go`.
- The existing public duration keys distinguish one hour from other hours, not Russian one/few/many forms. Use grammatical invariant abbreviations such as `ч` and `мин` where appropriate; audit every duration call site before claiming plural support.

## Admin source files for extraction

There is no existing admin locale dictionary to translate. First extract only visible UI text into an English catalog, implement reactive lookups, and then translate the catalog. Do not blindly translate literals in these files: URLs, API keys, enums, slugs, provider names, CSS and identifiers must remain intact.

The following existing route files contain the main interface text. Counts are nonblank source lines, NOT message counts.

| Existing file | Nonblank lines |
| --- | ---: |
| `frontend/src/routes/+layout.svelte` | 305 |
| `frontend/src/routes/+page.svelte` | 268 |
| `frontend/src/routes/api-keys/+page.svelte` | 152 |
| `frontend/src/routes/availability/+page.svelte` | 510 |
| `frontend/src/routes/bookings/+page.svelte` | 600 |
| `frontend/src/routes/calendar/+page.svelte` | 493 |
| `frontend/src/routes/claim/+page.svelte` | 79 |
| `frontend/src/routes/connections/+page.svelte` | 156 |
| `frontend/src/routes/event-types/[slug]/+page.svelte` | 1104 |
| `frontend/src/routes/event-types/+page.svelte` | 269 |
| `frontend/src/routes/forgot-password/+page.svelte` | 79 |
| `frontend/src/routes/invite/[token]/+page.svelte` | 92 |
| `frontend/src/routes/login/+page.svelte` | 205 |
| `frontend/src/routes/members/+page.svelte` | 541 |
| `frontend/src/routes/recordings/+page.svelte` | 381 |
| `frontend/src/routes/reset-password/+page.svelte` | 95 |
| `frontend/src/routes/settings/+layout.svelte` | 54 |
| `frontend/src/routes/settings/ai/+page.svelte` | 148 |
| `frontend/src/routes/settings/branding/+page.svelte` | 329 |
| `frontend/src/routes/settings/email/+page.svelte` | 352 |
| `frontend/src/routes/settings/google/+page.svelte` | 180 |
| `frontend/src/routes/settings/notifications/+page.svelte` | 94 |
| `frontend/src/routes/settings/payments/+page.svelte` | 145 |
| `frontend/src/routes/settings/profile/+page.svelte` | 292 |
| `frontend/src/routes/settings/storage/+page.svelte` | 138 |
| `frontend/src/routes/settings/tracking/+page.svelte` | 158 |
| `frontend/src/routes/settings/video/+page.svelte` | 212 |
| `frontend/src/routes/settings/zoom/+page.svelte` | 140 |
| `frontend/src/routes/teams/+page.svelte` | 276 |
| `frontend/src/routes/webhooks/+page.svelte` | 303 |

`frontend/src/routes/settings/+page.svelte` is an 8-line redirect; it does not need translation.

Also extract visible text/defaults from these existing shared files:

- `frontend/src/lib/components/event-types/QuestionsPanel.svelte`: booking form fields, validation, dialogs, notifications.
- `frontend/src/lib/components/event-types/EmbedPanel.svelte`: embed instructions and clipboard errors. Preserve generated embed code and attributes.
- `frontend/src/lib/components/demo-banner.svelte`: demo text and notifications.
- `frontend/src/lib/components/ui/confirm-dialog/confirm-dialog.svelte`: default title, confirm and cancel labels.
- `frontend/src/lib/components/ui/date-picker/date-picker.svelte`: default placeholder and locale-aware date label.
- `frontend/src/lib/components/ui/combobox/combobox.svelte`: default selection/search/empty labels.
- `frontend/src/lib/components/ui/dialog/dialog-content.svelte`: screen-reader Close label.
- `frontend/src/lib/prefs.ts`: English weekday names and date/time formatting helpers.
- `frontend/src/lib/api.ts`: audit displayed fallback errors only; preserve all API types, fields, paths and request behavior.
- `frontend/src/lib/async-action.svelte.ts`: central notification error handling; audit server messages that currently bypass translated fallback messages.
- `frontend/src/app.html`: initial document language.

Do not translate `packaging/ns8/ui/public/i18n/*/translation.json` for this task: those files belong to the separate NS8 packaging interface, not the SvelteKit admin or public booking dictionary.

## Engineering work separate from translating prose

Use a small typed Svelte locale store and English/Russian catalogs, following existing Svelte store patterns. These would be NEW admin infrastructure; there is no existing admin catalog path to reuse. Decide and document the path during implementation instead of assuming one already exists.

- Add an accessible English / Русский selector in the root layout, including the login/setup routes. Persist a validated locale in localStorage with English fallback and safe handling of unavailable storage. Update the document language on selection.
- Make text, metadata, defaults, derived lists and date labels react to locale changes immediately. Translating strings once during initialization will leave stale text after switching.
- Pass the selected locale to Intl date/time/number formatters and the Bits UI calendar. Preserve existing explicit user timezone, time-format and week-start preferences, and keep API date values unchanged.
- Replace English singular/plural suffix assembly with full messages selected using `Intl.PluralRules`; test 0, 1, 2, 5, 11, 21, 22 and 25, plus fractional values where supported.
- Audit server-supplied error text rendered through `e.message`; translating only local fallback strings does not translate these errors. Preserve REST response contracts.
- In `frontend/src/routes/+layout.svelte`, demo navigation currently checks `item.label === 'Calendar'`. Keep an untranslated stable route/identifier for this condition when labels become translated, so localization does not change navigation behavior.
- Check mobile navigation, settings tabs, dialogs, buttons, table columns, notification text and long event/member names with Russian text. Adjust wrapping/min-width only where needed.
- Preserve all backend behavior, round-robin routing, authentication, schema, encryption settings and storage paths. Never translate enum values submitted to the API or machine-readable ICS fields.

## Validation after implementation

Existing scripts and CI define these checks:

```powershell
# In frontend/
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm test:visual

# In repository root, after frontend build (Go embeds the build output)
gofmt -l .
go vet ./...
go build ./...
go test ./...
node --test internal/handler/assets/booking-logic.test.js internal/handler/assets/room-logic.test.js
```

There is no frontend lint script in the current `frontend/package.json`. CI uses gofmt and go vet for Go formatting/static analysis. Do not claim that an absent lint command passed.

Extend existing locale tests for Russian key/placeholder parity, Accept-Language matching, manual overrides, Russian date/time output, email content and invitation summary/description. Existing relevant files include:

- `internal/i18n/i18n_test.go`
- `internal/i18n/cldr_test.go`
- `internal/mailer/i18n_test.go`
- `internal/handler/booking_locale_test.go`
- `internal/handler/booker_error_locale_test.go`
- `internal/handler/fallback_locale_test.go`

Add focused admin checks for persisted locale, immediate switching, interpolation, plural selection and locale-aware calendar/date output. Run visual smoke tests and inspect narrow-screen Russian layouts.

No checks were run for this audit-only worklist; no application code was changed. Russian selection is not available until the implementation above is completed.

## Handoff instruction for a translation model

For public surfaces: translate only the values of `internal/i18n/locales/en.json` into Russian, preserve all 169 keys and printf placeholders, use 24-hour time and Russian date abbreviations, and return a complete JSON dictionary. Use `internal/i18n/locales/ru-RU.json` as the output.

For admin: extract all human-visible English text from the listed source files into a reviewable English catalog, including accessibility labels, placeholders, defaults, errors, dialogs and notifications. Preserve program logic and machine identifiers. Translate the extracted catalog into Russian using consistent terminology and complete plural messages. Do not rewrite the frontend or backend.
