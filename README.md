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

## Accounts and saved logs

The configured Supabase project supports unique name and password accounts. Signing in on another device loads the same private log. Saves use revision checks so simultaneous changes cannot silently overwrite each other. Settings offers a choice when both devices have unsynced changes. A per-account browser cache supports temporary connection loss.

Existing browser logs remain on the device. An empty account can import that browser's log from Settings. Sign-in names are case insensitive and separate from the editable display name. There is no password recovery flow yet. See [account setup](docs/account-setup.md).

Without cloud configuration, the app uses the existing `my-day-v2` local log and migrates `my-day-v1` if needed. Older entries remain readable. Historical completed entries without source metadata are treated as logged activities because their original scheduling intent was not recorded.

## Activities and values

- Logging from Home or a calendar slot uses the selected date/time and asks only for the activity and ratings. Ratings can be skipped. Editing a logged activity preserves its time.
- Scheduling from a selected slot uses that date/time; the separate Plan activity button includes date and exact-time choices. People with no saved values can continue without one. Future activities show a disabled clock. Due activities have an empty box that opens ratings, then becomes a green check. Unchecking marks the activity not completed. Back exits ratings without changing the schedule.
- Calendar rows cover half-hour slots and show each activity's exact time. Scheduled activities are purple.
- Values use five life areas. Each saved value expands inline into a two-column activity grid. Its plus tile links activities from the week or catalogue. Shared three-bar menus hold edit/delete actions.
- Logging Sleep and then Wake up fills empty half-hour rows between the exact times. Ordinary morning activities do not imply waking. Try yesterday at 10:17 PM and today at 7:19 AM. The original exact interval determines sleep duration.

## Mindfulness and accessibility

Breathing supports one, three or five minutes, plus custom minutes with a microphone. Typed decimals and common spoken durations are accepted. Pause and resume work for every duration. Visualization offers six themes. Drop narration files into `public/audio/visualization` using the filenames in its README. Missing audio shows a message; audio never starts automatically.

Text and time fields have optional microphone buttons. Passwords use normal secure entry. Dictation depends on browser support, microphone permission and the browser's speech service. Users review the transcript before continuing. The read-aloud setting supports first-tap speech and second-tap activation on touch devices, or a 900 ms mouse hover. Keyboard activation remains unchanged.

## Reports

Settings provides daily and weekly PDF downloads and manual email delivery. Weekly PDFs include mood graphs, activity, sleep and mindfulness charts, statistics and activity tables. Averages exclude missing ratings. The current week's activity average uses elapsed calendar days. Sleep averages include days with recorded sleep; sleep belongs to its wake-up day. Completion rates include due scheduled activities and exclude future plans.

Email requires server-side SMTP configuration. The Vercel endpoint authenticates hosted requests and limits sending per account. See [email setup](docs/email-report-setup.md).

## Editable areas

- `src/activities.ts`: activity choices.
- `src/RatingSlider.tsx`: rating interaction and images.
- `src/Relaxation.tsx`: exercise themes and breathing guide.
- `src/style.css`: layout and colors.
- `src/cloud-config.ts`: public connection settings only.
- `supabase/schema.sql`: private log storage and revision-checked saves.
- `docs/content-and-licensing.md`: illustration and exercise sources.

PDF text supports English and common Western accented characters. Other characters use `?` until a Unicode font is embedded.
