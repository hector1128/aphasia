# My Day

React and TypeScript app for logging activities, scheduling, values, mood and mindfulness.

## Run and validate

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run test:sleep` checks automatic sleep filling. `node --import tsx scripts/preview-report.ts` generates a fictional weekly PDF in the ignored `output/pdf` folder.

`npm run dev` opens a fixed local address (normally `http://127.0.0.1:5173`). When local face authentication is enabled, it starts the Python face service too, loading `face-service/.env` and verifying/preparing its models before reporting readiness. Create `face-service/.venv` and install `face-service/requirements-export.txt` first. An existing authenticated face service is reused; stopping the dev command stops only the Python process it started. See [face setup](docs/face-verification.md) for the required settings. Use the printed address in the same browser each time so its registered key remains available.

## Accounts and saved logs

An optional, disabled-by-default **face-verification and sign-in feature** is available to every signed-in account once configured. Users opt in and register their own browsers; no account allowlist or administrator approval is required. It uses a private self-hosted service and an enrolled browser key. Face sign-in requires separate server configuration; name/password remains available. See [setup, model requirements and limitations](docs/face-verification.md).

For hosted face authentication, see [the Vercel + Supabase deployment steps](docs/face-deployment.md). Vercel runs the Python function with bundled models; a private Supabase Postgres schema stores encrypted templates and authentication state. Local development can continue using SQLite. No additional hosting provider is required.

The configured Supabase project supports unique name and password accounts. Signing in on another device loads the same private log. Saves use revision checks so simultaneous changes cannot silently overwrite each other. Settings offers a choice when both devices have unsynced changes. A per-account browser cache supports temporary connection loss.

Existing browser logs remain on the device. An empty account can import that browser's log from Settings. Sign-in names are case insensitive and separate from the editable display name. There is no password recovery flow yet. See [account setup](docs/account-setup.md).

Without cloud configuration, the app uses the existing `my-day-v2` local log and migrates `my-day-v1` if needed. Older entries remain readable. Historical completed entries without source metadata are treated as logged activities because their original scheduling intent was not recorded.

## Activities and values

- Logging keeps the date and starting time selected on Home or Activity Log, then asks for the activity, ratings and duration. Duration changes in 30-minute increments. Mood and enjoyment are required; importance can be skipped or reused for two weeks.
- Scheduling asks for Start and End through custom half-hour lists, each with its own microphone. Repeat offers daily, weekdays or weekly. Scheduling from Values also asks for the day and retains that value.
- Activities fill every occupied half-hour on Home and Activity Log, while counting once in reports. Drag the first/last handle or use its arrow keys to resize. Scheduled activities use purple.
- My activities appears first, followed by nine activity categories. Logging separates recent choices from categories; scheduling adds up to five personalized suggestions. Search includes the wider library and all suggestion candidates, supports simple phrases and spelling corrections, and always allows custom names. Unknown choices rotate through six stable geometric icons.
- Values use five life areas. Add activity offers choices from this week, filtered by day, or scheduling directly into the value.
- Sleep and Wake up fill empty half-hour rows between those exact times. Ordinary morning activities do not imply waking.

## Mindfulness and accessibility

Breathing supports one, three or five minutes, plus custom minutes with a microphone. Typed decimals and common spoken durations are accepted. Pause and resume work for every duration. Visualization offers six themes. Drop narration files into `public/audio/visualization` using the filenames in its README. All six narration recordings are included; audio never starts automatically.

Text fields have optional microphone buttons. Scheduling offers separate start/end dictation; times require AM or PM and round to half hours. Passwords use normal secure entry. Dictation depends on browser support, microphone permission and the browser's speech service. The read-aloud setting supports first-tap speech and second-tap activation on touch devices, or a 900 ms mouse hover. Keyboard activation remains unchanged.

## Reports

Settings provides daily and weekly PDF downloads and manual email delivery. Weekly PDFs include mood graphs, activity, sleep and mindfulness charts, statistics and activity tables. Averages exclude missing ratings. The current week's activity average uses elapsed calendar days. Sleep averages include days with recorded sleep; sleep belongs to its wake-up day. Completion rates include due scheduled activities and exclude future plans.

Email supports Resend or server-side SMTP configuration. The Vercel endpoint authenticates hosted requests and limits sending per account. See [email setup](docs/email-report-setup.md).

## Find and change code

See the [repository guide](docs/repository-guide.md) for the folder map, edit locations, module responsibilities and validation workflow. Read [the UI reference](docs/ui-components.md) before UI changes.

The main activity list and suggestion pool are in `src/domain/activities/catalogue.ts`; shared icon mappings are in `src/features/activities/ActivityIcon.tsx`. Tests live next to their feature/domain and `npm test` discovers them recursively.

PDF text supports English and common Western accented characters. Other characters use `?` until a Unicode font is embedded.

The latest functionality and usability findings are in [the October 16 review](docs/functionality-review-2026-10-16.md).
