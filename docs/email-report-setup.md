# Testing daily PDF reports

Settings contains **Email to send to**, **Send today's report**, and **Download today's PDF**. The entered address is saved on the device. Sending is manual; no automatic nightly schedule is enabled. Missing daily mood and other missing sections do not prevent sending.

## Enable real email

1. Copy `.env.example` to `.env.local` in this project.
2. Obtain SMTP credentials from your email provider. For Gmail, use a supported app password (where available), not your normal sign-in password. Alternatively use a transactional SMTP service.
3. Fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `REPORT_FROM`. The sender must be an address your provider permits. Port 587 uses STARTTLS (`SMTP_SECURE=false`); port 465 uses implicit TLS (`SMTP_SECURE=true`).
4. Restart `npm run dev` and open the localhost URL on this computer.
5. Enter a test recipient in Settings. Press Send today's report. Check the recipient inbox and spam folder for the PDF attachment.

Credentials stay server-side and `.env.local` is ignored by Git. Do not use `VITE_` prefixes for secrets. No sender has been configured by default; the app reports that setup is needed rather than pretending to send. A successful send means the SMTP provider accepted the message, not a guarantee that it reached the inbox.

The local endpoint only accepts same-origin requests from localhost with a 1 MB request limit and a short send cooldown. It sends one recipient a generated PDF; it does not accept attachment paths or fetch URLs. Do not expose it as a public email service. A hosted patient app would need authentication, access controls, and a deployed backend; static hosting alone cannot send these emails. `npm run preview` also serves the local email endpoint for build testing.

## Report contents

- Current local date, name, today's daily mood (0 is a real rating), and completion counts.
- All of today's logged/planned activities and mood, enjoyment, importance ratings.
- Sleep periods overlapping the report day and their auto-filled entries.
- Completed breathing sessions; video activities are counted when the patient presses **I did this activity**. Merely opening a video is not treated as completion. A new visit permits a new session.
- Factual daily summaries: most frequent activities, highest enjoyment, average enjoyment and sample count. Missing ratings are excluded from averages, not treated as zero. Auto-filled sleep does not skew activity patterns.
- All five life areas, the person's values, linked activities, and matching activities completed today. Blank sections say Not completed.

Only the selected day's entries, rating, and mindfulness records (plus relevant sleep and all saved values) are sent to the local endpoint. Reports contain personal information; use synthetic data for design testing.

PDF text uses the standard Helvetica character set. Unsupported characters are replaced with `?`; English and common Western accented names are supported. Broader language support will require an embedded Unicode font.

## Validation

Automated tests use a mock SMTP transport, verify actual PDF attachment bytes, cross-origin rejection, date filtering, zero/missing ratings, and multipage generation. No real email is sent by tests.
