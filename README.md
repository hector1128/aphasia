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

The configured Supabase project supports unique name and password accounts. Signing in on another device loads the same private log. Saves use revision checks so simultaneous changes cannot silently overwrite each other. Settings offers a choice when both devices have unsynced changes. A per-account browser cache supports temporary connection loss.

Existing browser logs remain on the device. An empty account can import that browser's log from Settings. Sign-in names are case insensitive and separate from the editable display name. There is no password recovery flow yet. See [account setup](docs/account-setup.md).

Without cloud configuration, the app uses the existing `my-day-v2` local log and migrates `my-day-v1` if needed. Older entries remain readable. Historical completed entries without source metadata are treated as logged activities because their original scheduling intent was not recorded.

## Activities and values

- Logging from Home or a calendar slot uses the selected date/time and asks only for the activity and ratings. Activity choices populate the textbox, which can be edited or cleared to reopen choices. Bottom Back/Next or Back/Save controls replace the top navigation arrows; the step indicator is below the controls. Ratings can be skipped. Editing a logged activity preserves its time.
- Scheduling from a selected slot uses that date/time; the separate Plan activity button includes date and exact-time choices. People with no saved values can continue without one. Future activities show a disabled clock. Due activities have an empty box that opens ratings, then becomes a green check. Unchecking marks the activity not completed. Back exits ratings without changing the schedule.
- Calendar rows cover half-hour slots and show each activity's exact time. Scheduled activities are purple, without extra status text. Settings has its own space above the content on pages outside Home.
- The 21 tracker activities are the main choices under five life areas. The larger original library remains searchable, and custom names still work. Recent choices, five suggestions and life areas appear together as one growing grid without section headings or a nested scroll area. Suggestions use a curated activity-to-feature graph, recency and frequency, exclude previously completed equivalents and pending plans, and start with general activities for new users.
- Scheduling shows personal values in a responsive grid. Its plus tile creates a value under a life area, selects it and returns to the current activity.
- Values use five life areas. Each saved value expands inline into a two-column activity grid. Its plus tile links activities from the week or catalogue. Shared three-bar menus hold edit/delete actions. Add activity tiles use a solid border and left-aligned content. On desktop, linked activities use compact artwork/name/menu rows.
- Logging Sleep and then Wake up fills empty half-hour rows between the exact times. Ordinary morning activities do not imply waking. Try yesterday at 10:17 PM and today at 7:19 AM. The original exact interval determines sleep duration.

## Mindfulness and accessibility

Breathing supports one, three or five minutes, plus custom minutes with a microphone. Typed decimals and common spoken durations are accepted. Pause and resume work for every duration. Visualization offers six themes. Drop narration files into `public/audio/visualization` using the filenames in its README. All six narration recordings are included; audio never starts automatically.

Text fields have optional microphone buttons. Time uses one microphone beside the selected time. Mobile uses the hour/minute/period wheels; tablet and desktop place the hour, minute and AM/PM controls in one row. Passwords use normal secure entry. Dictation depends on browser support, microphone permission and the browser's speech service. Users review the transcript before continuing. The read-aloud setting supports first-tap speech and second-tap activation on touch devices, or a 900 ms mouse hover. Keyboard activation remains unchanged.

## Reports

Settings provides daily and weekly PDF downloads and manual email delivery. Weekly PDFs include mood graphs, activity, sleep and mindfulness charts, statistics and activity tables. Averages exclude missing ratings. The current week's activity average uses elapsed calendar days. Sleep averages include days with recorded sleep; sleep belongs to its wake-up day. Completion rates include due scheduled activities and exclude future plans.

Email requires server-side SMTP configuration. The Vercel endpoint authenticates hosted requests and limits sending per account. See [email setup](docs/email-report-setup.md).

## Editable areas

- `src/activity-catalogue.ts`: main tracker choices, life-area mapping, equivalent names, graph features and recommendation ranking.
- `src/activities.ts`: wider searchable activity library.
- `src/RatingSlider.tsx`: rating interaction and images.
- `src/Relaxation.tsx`: exercise themes and breathing guide.
- `src/style.css`: layout and colors.
- `src/cloud-config.ts`: public connection settings only.
- `supabase/schema.sql`: private log storage and revision-checked saves.
- `docs/content-and-licensing.md`: illustration and exercise sources.

PDF text supports English and common Western accented characters. Other characters use `?` until a Unicode font is embedded.

The latest functionality and usability findings are in [the October 16 review](docs/functionality-review-2026-10-16.md).
