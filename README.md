# My Day

Mobile-focused React + TypeScript prototype for recording activities, planning a day, and relaxation.

## Run and validate

- `npm install`
- `npm run dev`
- `npm run build`
- `npm test`
- `npm run test:sleep` for the sleep/wake half-hour check

## Current design

- Four small logging steps: activity, mood, enjoyment, importance. Planning uses activity, day, time; completing a plan opens the three ratings.
- 156 searchable everyday activities, custom activity names, and eight persisted recent choices.
- Separate 0–10 mood, enjoyment, and importance sliders with changing faces or a filling star and non-drag +/- controls. Each activity rating can be skipped.
- 48 half-hour calendar blocks per day; multiple activities per block. Each entry has an independent ID so editing or deleting one cannot overwrite a sibling.
- Green activity screens and blue relaxation screens. One-minute paced breathing with pause/resume, plus click-to-load YouTube visualization/stretching videos.
- Most app text remains large; compact mobile activity rows and bottom navigation use smaller labels so their controls fit horizontally.

## Data and migration

`my-day-v2` stores the local profile, activity IDs, local dates, minutes from midnight, independent activity ratings, recent choices, daily mood, values, sleep periods, mindfulness sessions, and the report email address. On first load, old `my-day-v1` data is migrated when v2 is absent: hourly entries become :00 entries and existing enjoyment and daily ratings remain intact. The old storage key is preserved as a migration backup. Start over clears v2 data and removes the v1 backup so it cannot be reimported.

Daily mood is available from Home and stored in `Data.ratings`. Per-activity mood is a separate field.

## Editable areas

- `src/activities.ts`: activity choices.
- `src/RatingSlider.tsx`: rating interaction and face.
- `src/Relaxation.tsx`: breathing guide and video IDs.
- `src/style.css`: spacing and shared section colors.
- `docs/content-and-licensing.md`: relaxation sources and future picture-library options.
- `docs/welcome-illustration.md`: generated asset and prompt.

Videos are review candidates, not aphasia-specific clinical validation. See the content review notes before patient use.

## October design review

- Activity Log uses 30-minute slots with direct delete, edit, and completion controls. Logging from a selected time goes from activity to mood, enjoyment, and importance (all 0–10). Editing a completed activity revisits those questions without asking for its time again.
- Daily mood is restored. Activities open by category, with global search, recent choices, and suggestions based on recorded enjoyment/importance and linked values.
- My values contains five life areas. People create their own values, then link an activity from the current week or the catalogue without adding questions to logging.
- Completing an activity named “sleep,” “went to bed,” “nap,” or a similar phrase starts a sleep period. Completing “wake up,” “woke up,” or a similar phrase fills empty half-hour slots between those times as sleep.
- Breathing completion is recorded automatically at the end of the timer. Video exercise completion is self-reported.
- Settings creates a daily PDF and can email it after local SMTP configuration. See [email setup](docs/email-report-setup.md). No automatic emails, facial recognition, accounts, or public admin service were added.

The v2 storage format is extended compatibly; prior saved activities and ratings are preserved. New fields default to empty on older data.

To try automatic sleep filling in the app, open Activity Log and choose two past slots. Log “Sleep” at the first slot (for example, yesterday at 10:00 PM), then “Wake up” at the second (for example, today at 7:00 AM). The empty half-hour slots between them show “Sleeping.” `npm run test:sleep` verifies the same behavior across midnight without changing browser data.
