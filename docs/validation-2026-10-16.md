# Validation, October 16, 2026

## Passed

- 32 automated tests, including minute-precise times, sleep intervals, scheduled outcomes, weekly calculations, missing and zero ratings, multipage PDFs, spoken-time parsing and username normalization.
- Daily and weekly email tests inspect real PDF attachment bytes with a mock SMTP transport. Weekly email also exercises Vercel's pre-parsed JSON body and rejects hosted requests without authentication.
- Type checking, ESLint, production build and whitespace checks.
- Dependency audit reports zero vulnerabilities. Vite reports a non-blocking 500 kB chunk-size warning for the main app bundle.
- Live Supabase synthetic-account checks: signup, password login, independent-session reads and writes, stale-revision rejection, anonymous rejection, per-user isolation, direct-write rejection and report-send throttling.
- Browser checks: login in Chrome and the in-app browser; desktop numeric time entry; mobile wheels with rapid hour/minute changes; exact time displayed in the correct half-hour row; future schedule lock; due-plan rating completion; Back cancellation; not-completed outcome; logged entries without completion controls; weekly PDF download; value edit cancellation; focused weekly activity picker; missing-audio message.
- Responsive checks at 320, 390, 768 and 1280 pixels. Weekly PDF pages were rendered and inspected.

All cloud and browser checks used fictional Design Test accounts. No patient data or real email was used.

## Review findings addressed

Two strict review passes and a Ponytail maintainability review identified a partial sleep-slot omission, stale ratings shown for missed plans in daily reports, and unused video-kind flexibility. These were inspected and fixed. Manual browser checks also found delayed time-wheel callbacks resetting another wheel and typed minutes being reformatted before entry finished. Both were fixed and rechecked.

A review suggested the second read-aloud tap remained intercepted. Inspection found its early return already allows the second click through before preventDefault, so that proposed change was not applied.

## Remaining acceptance checks

- Real dictation and audible read-aloud on physical iPhone/iPad, Android and Safari, including touch first-tap/second-tap behavior. The microphone start/stop UI was exercised, but recognition accuracy and sound output were not certified.
- Real narration playback after the owner supplies the six MP3 files.
- Actual inbox delivery after server-side SMTP credentials are configured. Automated email transport tests do not establish inbox delivery.
- Hosted function execution after deployment. Local tests cover both raw and Vercel-style parsed request bodies.
