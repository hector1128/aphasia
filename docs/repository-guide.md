# Repository guide

## Folder map

```text
src/
  main.tsx                 React mount and account gate
  app/                     App state, navigation and Settings composition
  domain/                  Saved data, calendar arithmetic and activity rules
    activities/            Main list, suggestion pool, legacy library, personal choices, importance
  features/
    activities/            Picker, timeline, scheduling, duration and step order
    auth/                  Name/password sign-in
    face/                  Camera, browser enrollment and face sign-in UI
    mindfulness/           Breathing, visualization and stretching
    mood/                  Daily mood screen
    onboarding/            Guided tour
    reminders/             Reminder settings and shared request/message contracts
    reports/               Report settings, calculations and PDF generation
    values/                Life areas, values and linked activities
  shared/
    ui/                    SpeechField, ratings, menus, week picker and time listbox
    accessibility/         Speech parsing and read-aloud
  services/supabase/       Public config, account cache, cloud persistence and synchronization
  styles/                  Shared app stylesheet
server/
  face/                    Authentication proxy and session bridge
  reminders/               Preference, confirmation, unsubscribe and delivery endpoints
  reports/                 Authenticated report delivery
  email.ts                 Shared Resend transport
api/                       Vercel entry points, including the Python face function
supabase/                  Schema migrations, policies, scheduler and SQL tests
face-service/              Private Python face recognition service and model tooling
public/                    Ratings, audio, illustrations and other static assets
scripts/                   Development launcher, test discovery and asset/report tools
docs/                      UI reference, setup, deployment and behavior notes
```

Tests are colocated with the code they cover. `src/app/features.test.ts` is the integration suite for cross-feature flows; focused tests stay in their domain or feature. Generated previews go in ignored `output/`; emitted server checks go in ignored `tmp/`. Keep credentials in environment variables, never in source or fixtures.

## Common edits

| Change | Start here |
| --- | --- |
| Nine visible activity categories | `src/domain/activities/catalogue.ts` → `activityCategories` |
| Recommendation candidates, also searchable | Same file → `suggestionActivities` |
| Searchable legacy names and spelling matching | `src/domain/activities/library.ts` |
| Activity icons | `src/features/activities/ActivityIcon.tsx` |
| Logging/scheduling steps | `src/features/activities/activity-flow.ts` |
| Scheduling time fields and voice controls | `src/features/activities/TimePicker.tsx` |
| Logged duration controls | `src/features/activities/DurationPicker.tsx` |
| Persistence, recurrence and occupied blocks | `src/domain/model.ts` |
| Settings composition | `src/app/SettingsPage.tsx` |
| Sizes, colors, spacing and states | `docs/ui-components.md`, then `src/styles/style.css` |
| Production reminder timing/delivery | `server/reminders/api.ts`, `supabase/reminders.sql` |

Main categories and suggestions are separate. Adding a suggestion makes it searchable without creating another category. Give each added choice appropriate features/life areas and a matching Lucide name mapping. Preserve existing saved names and icon IDs when editing content.

## Responsibilities and dependencies

`App` coordinates state and navigation. Feature components receive the data and callbacks they need; Settings receives sign-out, reset and tutorial actions rather than implementing authentication or navigation. `main.tsx` only mounts the app. Week selection, time selection, scheduling voice input and logged duration are separate components, so reminder time fields do not depend on scheduling UI.

Pure domain rules do not import React, cloud SDKs, UI features or the app controller. ESLint enforces that boundary. API handlers translate HTTP and provider data at the server boundary; the existing email transport is injected in tests. Keep server-used imports explicit with `.js` extensions so the emitted Node runtime resolves them.

Apply SOLID through these existing contracts:

- Single responsibility: keep content, saved-data rules, UI rendering and external I/O with their owners above.
- Open/closed: extend activity data and icon mappings to add choices; do not add activity-name branches to every screen.
- Liskov substitution: retain shared component behavior for every caller, including disabled state, bounds, keyboard access and error handling. There is no inheritance hierarchy to expand.
- Interface segregation: pass only needed values/callbacks, such as a time listbox's label, bounds and change action, or Settings' small identity and sync contracts.
- Dependency inversion: UI receives actions, domain rules stay pure, and provider communication remains in adapters. Do not introduce an interface or factory for a single implementation just to satisfy a label.

## Validate a change

Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. The test runner discovers nested `.test.ts` and `.test.tsx` files automatically and also verifies the emitted server runtime. `npm run test:sleep` filters the same discovery set.

Before finishing UI changes, follow `docs/ui-components.md`, exercise the actual flow with synthetic data at 320, 390, 768 and desktop widths, and check the relevant keyboard, disabled and expanded states. Review import paths after file moves, especially server `.js` imports, scripts and public asset paths. Keep public API routes and saved-data keys stable during organization-only changes.
