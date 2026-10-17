# Functionality and usability review, October 16, 2026

The requested layout changes are implemented. This review records remaining issues separately; it does not apply unrelated refactors or change existing saved data. All runtime checks used a fictional review account.

## Findings to revise

### 1. High: Start over clears the entire log without a safeguard

The Settings button calls `reset` immediately. This replaces activities, values, mood, sleep and mindfulness with an empty document, which the normal cloud-save flow then syncs. There is no confirmation, undo or automatic backup. A mistaken tap can therefore erase the account's log across devices.

Evidence: source path traced through `src/main.tsx` (`reset` and the Start over button) and `src/useCloudSync.ts` (normal save). The destructive action was deliberately not exercised against the cloud account.

Recommended revision: show a clear confirmation with a backup/download option before clearing, and offer recovery for accidental deletion. Individual activity/value deletion also currently has no undo.

### 2. Medium: Daily reports can miss completed activities explicitly assigned to a value

Scheduling can assign `entry.valueId` directly, including a newly created value with an empty activity list. The daily report only compares completed names against `value.activities`; it does not include entries assigned through `valueId`.

Reproduction executed: a completed Cook entry with `valueId: "v"` and a matching Cooking for myself value with no separately linked catalogue activities produced `Done today: Not completed` in the value section. The entry itself remains in the activity log. Both the report section generator and PDF renderer use this name-only test.

Evidence: runnable fixture executed against `reportSections`; source in `src/report-data.ts` and `src/report.ts`.

Recommended revision: include completed entries assigned by value ID, while retaining name matching for older manually linked activities. Missing information should read Not recorded rather than implying the person did not complete an activity.

### 3. Medium: Home can stay on an old slot with no quick return to now

Home's selected minute is independent of the live clock. Saving or completing an older entry also changes that selection. Returning Home after completing the 10:00 AM test plan showed 10:00 AM during the evening. Logging then defaults to that displayed historical slot. There is no Now shortcut, and the selection does not advance at a half-hour boundary.

Evidence: reproduced in the browser; `src/main.tsx` initializes the selected minute once, updates the separate clock every 15 seconds, and changes the selected minute when saving.

Recommended revision: add a Now action and distinguish deliberate history browsing from following the current slot. Keep intentionally selected slots stable while the user is entering an activity.

### 4. Medium: Offline or conflicting changes prevent sign-out

Sign out is disabled whenever sync status is not saved. Its action also requires a successful sync. A person using a shared device cannot sign out while the connection is unavailable or a conflict is waiting for review, even though the app has a local account cache.

Evidence: source in the account section of `src/main.tsx` and `src/useCloudSync.ts`. Network disconnection was not simulated in this browser session.

Recommended revision: provide a clear local sign-out route that preserves unsynced work, explains what remains on the device, and offers a backup or explicit choice before discarding anything.

### 5. Low: Review the relevance of specialized suggestions

The feature graph is deterministic and excludes previously completed equivalents and pending plans. However, generic Reading history currently places At Aphasia House, Speech therapy and Participate in research among the top five. Shared language/learning features can outweigh whether a suggested activity fits the person's routine or available services.

Evidence: observed in the live picker and traced through `src/activity-catalogue.ts`.

Recommended revision: review these relationships with the content owner. Give specific shared activities more weight, and consider making service-based choices depend on an explicit preference or relevant history. This is a recommendation-quality concern, not a broken save or ranking operation.

## Checks passed

- 42 automated tests, compiled server runtime smoke check, type checking, linting, production build and whitespace checks.
- Sign-in, navigation, selected-slot logging, standalone scheduling, life-area browsing and full-library search.
- Exact time controls on mobile, tablet and desktop. Invalid hour input disables saving. AM/PM changes preserve minute precision. The tested 4:39 AM schedule was saved with its selected value.
- A single growing activity grid with two columns on mobile, no category section headings on its first screen, no inner scroll area, and no horizontal overflow at the checked widths.
- Desktop value activities display artwork, name and three-bar menu in one row. Edit and cancellation preserve links.
- Due-plan completion opens ratings; Back leaves the plan unchanged. Zero mood, maximum enjoyment and zero importance save independently. Daily mood zero is also retained.
- Custom breathing duration, pause, resume and completion. Existing sleep-fill and weekly-statistics tests pass.
- Stretching iframe measured 764 by 429.75 pixels on desktop, and at least 280 pixels tall on a 320-pixel viewport.
- All six narration files load through their own visualization screens with no media error and a finite duration. They do not autoplay.
- Daily and weekly PDF downloads produced actual PDF 1.7 files. Browser error/warning inspection returned no application errors during these paths.
- Cloud reads independently confirm the saved exact time, value ID and ratings after browser interaction.

## Limits and existing setup items

Physical Safari/iPhone/iPad/Android dictation, audible read-aloud, microphone permission behavior, and listening to the full recordings remain acceptance checks. Audio loading/decoding does not certify sound output or narration content. Password recovery is not implemented, as previously agreed for name-only accounts. Actual report email delivery was not tested; it requires working server-side SMTP configuration. Tests use a mock mail transport and do not establish inbox delivery.

The existing main-bundle size warning remains. The stylesheet also contains many historical overrides; a separate scoped cleanup would reduce the chance of future layout regressions. No broad automatic refactor was applied during this review.
