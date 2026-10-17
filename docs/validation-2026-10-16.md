# Validation, October 16, 2026

## Passed

- 32 automated tests, including minute-precise times, sleep intervals, scheduled outcomes, weekly calculations, missing and zero ratings, multipage PDFs, spoken-time parsing and username normalization.
- Daily and weekly email tests inspect real PDF attachment bytes with a mock SMTP transport. Weekly email also exercises Vercel's pre-parsed JSON body and rejects hosted requests without authentication.
- Type checking, ESLint, production build and whitespace checks. A compiled Node ESM server smoke test is included in `npm test`.
- Dependency audit reports zero vulnerabilities. Vite reports a non-blocking 500 kB chunk-size warning for the main app bundle.
- Live Supabase synthetic-account checks: signup, password login, independent-session reads and writes, stale-revision rejection, anonymous rejection, per-user isolation, direct-write rejection and report-send throttling.
- Browser checks: login in Chrome and the in-app browser; desktop numeric time entry; mobile wheels with rapid hour/minute changes; exact time displayed in the correct half-hour row; future schedule lock; due-plan rating completion; Back cancellation; not-completed outcome; logged entries without completion controls; weekly PDF download; value edit cancellation; focused weekly activity picker; missing-audio message.
- Responsive checks at 320, 390, 768 and 1280 pixels. Weekly PDF pages were rendered and inspected.
- Hosted app sign-in loaded the activities saved locally. The deployed report function rejected an unauthenticated request with 401 and returned the expected SMTP-setup message with 503 for an authenticated test account.

All cloud and browser checks used fictional Design Test accounts. No patient data or real email was used.

## Review findings addressed

Two strict review passes and a Ponytail maintainability review identified a partial sleep-slot omission, stale ratings shown for missed plans in daily reports, and unused video-kind flexibility. These were inspected and fixed. Manual browser checks also found delayed time-wheel callbacks resetting another wheel and typed minutes being reformatted before entry finished. Both were fixed and rechecked. The first hosted deployment exposed extensionless server imports that Vite had resolved locally. Explicit JavaScript extensions and the compiled-server test fix and guard that startup failure.

A review suggested the second read-aloud tap remained intercepted. Inspection found its early return already allows the second click through before preventDefault, so that proposed change was not applied.

## Remaining acceptance checks

- Real dictation and audible read-aloud on physical iPhone/iPad, Android and Safari, including touch first-tap/second-tap behavior. The microphone start/stop UI was exercised, but recognition accuracy and sound output were not certified.
- Real narration playback after the owner supplies the six MP3 files.
- Actual inbox delivery after server-side SMTP credentials are configured. Automated email transport tests do not establish inbox delivery.

## Evening interface changes

- 35 automated tests pass, plus the compiled server smoke test, type checking, linting and build.
- Sign-in now uses the app's colors and typography. Sign-up footer wrapping was checked at 280 pixels; the desktop card was checked at 1280 pixels.
- Home no longer repeats the activity time. Adding from Home/calendar uses the selected slot, verified against the saved synthetic entries. Standalone scheduling retains date/time choices.
- Activity/value menus expand edit/delete actions, close with Escape or outside click, and stay inside the calendar scroll area. Scheduled items use a disabled future clock or an empty/green due box. Rating completion, Back cancellation and unchecking were exercised.
- Value activities now expand inline into a two-column grid. Creation, linking from the week, editing a linked activity, unlinking, collapse and narrow-grid menu positioning were checked in the browser. Saved value IDs and activity links keep the same data format.
- Custom breathing accepts decimal minutes and common dictated phrases. A 2.05-minute selection displayed 123 seconds, and a short custom timer reached Finished. Real-device speech recognition remains an acceptance check.
- The replacement Eleni Fit YouTube embed and external link use the supplied video ID; the embedded player loaded successfully without autoplay.
- Motion respects the system's reduced-motion preference.

Strict review findings about narrow footers and clipped action menus were inspected and fixed. Removing Home's repeated times and replacing separate completion/missed controls are intentional user-requested behavior changes.
