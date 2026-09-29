# My Day

Mobile-focused React + TypeScript prototype for recording activities, planning a day, and relaxation.

## Run and validate

- `npm install`
- `npm run dev`
- `npm run build`
- `npm test`

## Current design

- Five small logging steps: activity, day, time, mood, enjoyment. Planning stops after time; completing a plan opens mood then enjoyment.
- 156 searchable everyday activities, custom activity names, and eight persisted recent choices.
- Separate 1–10 mood and enjoyment sliders with changing faces and non-drag +/- controls. Each rating can be skipped.
- 48 half-hour calendar blocks per day; multiple activities per block. Each entry has an independent ID so editing or deleting one cannot overwrite a sibling.
- Green activity screens and blue relaxation screens. One-minute paced breathing with pause/resume, plus click-to-load YouTube visualization/stretching videos.
- All app text remains at least 23px. Browser and third-party video controls have their own styles.

## Data and migration

`my-day-v2` stores the local profile, activity IDs, local dates, minutes from midnight, independent mood/enjoyment ratings, recent choices, and hidden daily ratings. On first load, old `my-day-v1` data is migrated when v2 is absent: hourly entries become :00 entries and existing enjoyment and daily ratings remain intact. The old storage key is preserved as a migration backup. Start over clears v2 data and removes the v1 backup so it cannot be reimported.

Daily mood access is commented out in `src/main.tsx`. Its UI remains in `src/DailyMood.tsx`, and `Data.ratings` is retained. Per-activity mood is a separate field.

## Editable areas

- `src/activities.ts`: activity choices.
- `src/RatingSlider.tsx`: rating interaction and face.
- `src/Relaxation.tsx`: breathing guide and video IDs.
- `src/style.css`: spacing and shared section colors.
- `docs/content-and-licensing.md`: relaxation sources and future picture-library options.
- `docs/welcome-illustration.md`: generated asset and prompt.

Videos are review candidates, not aphasia-specific clinical validation. See the content review notes before patient use.
