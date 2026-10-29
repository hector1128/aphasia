# Activity reminders

Settings → Activity reminders offers Off or Email. Text is visibly unavailable until an SMS provider is configured. Reminders are off by default. The user supplies their own email and time zone, gives permission, and confirms a link delivered to that address. Opening the link does not change preferences; its confirmation button does. Links expire in 24 hours. Confirmation requests have a persistent one-minute per-account cooldown.

At 4 PM in the saved IANA time zone, the scheduler checks the account's synced log. A new account with no log is eligible. A completed entry dated today suppresses the reminder; scheduled but unfinished entries, daily mood ratings and yesterday's activities do not. The check runs every minute during the 4–5 PM window. Daylight saving changes follow the saved time zone. Offline entries cannot suppress the check until they sync.

Users can turn reminders off in Settings or through the unsubscribe link in each message. Switching to a different email requires confirmation again. These settings live in a server-owned table, so importing, syncing or clearing a log cannot silently change reminder consent. Turn reminders off explicitly to stop emails.

## Deployment

1. Verify `aphasia-myapp.com` in Resend. Create a Sending access key restricted to that domain.
2. In Vercel Production, set `RESEND_API_KEY`, `REPORT_FROM=My Day <reports@aphasia-myapp.com>`, `REPORT_REPLY_TO=aphasiacarelab@ucf.edu`, and `APP_ORIGIN=https://aphasia-myapp.com`.
3. Generate a private random 32+ character `CRON_SECRET`. Save it in Vercel Production and in Supabase Vault under `my_day_reminders_cron_secret`. Keep both values identical. Never prefix credentials with `VITE_`, commit them, or paste them into chat.
4. Keep the existing server-only `SUPABASE_SECRET_KEY` (or legacy service-role key), `SUPABASE_URL` and public Supabase configuration. The reminder API authenticates the user's existing session before accessing that user's preferences. The migration grants the trusted server role read-only access to synced logs for the reminder check. Browser permissions remain restricted to each user's own log, and browsers cannot read or write the reminder tables directly.
5. Run `supabase/reminders.sql` after `supabase/schema.sql`. Run `supabase/reminder-schedule.sql` to install one named Supabase cron job. Re-running the scripts updates the same functions and job. The dispatcher does nothing if its Vault secret is missing.
6. Redeploy Vercel. Verify the custom domain's HTTPS connection and the cron job's HTTP response. Vercel Hobby's daily cron precision is unsuitable for this check; Supabase cron invokes the protected endpoint instead.

The endpoint is `POST /api/reminders` with `{"action":"run"}` and the scheduler's bearer secret. It must never be invoked by a browser timer. A tick leases up to ten eligible deliveries. Workers recheck the latest log and preference immediately before sending. Unique account/day rows prevent repeated sends; a five-minute lease allows at most three attempts, and a stable Resend idempotency key prevents duplicates after ambiguous provider timeouts or worker crashes. Messages are paced 600ms apart within a worker. The Vercel function budget is 180 seconds. Increase worker throughput before rolling out to a substantially larger group.

Reminders contain a generic prompt, the app link and an unsubscribe link. They do not include activity names, ratings, patient names, or PDFs. Detailed reports are sent only by the existing report action. Provider acceptance means queued, not guaranteed inbox delivery. No email is sent before address confirmation.

## Verification

- `npm test` covers authentication, input/consent validation, email confirmation, unsubscribe, failed delivery, stable retry keys and origin checks.
- On a development database, run `supabase/reminders.test.sql`. It verifies 4 PM boundaries, daylight saving changes, activity filtering, restricted database permissions, confirmation, duplicate suppression, lease recovery and unsubscribe. Its synthetic account and all related rows are rolled back.
- Exercise Off, Email, pending confirmation, confirmed, unavailable and error states at mobile, tablet and desktop widths. Text must stay disabled. Use synthetic content for any sending test and obtain permission before sending to a real inbox.

The custom domain is also an explicitly trusted origin for facial sign-in. Existing `FACE_APP_ORIGIN` remains supported. Browser-stored face device keys and sign-in sessions are scoped to a website origin, so moving to the new domain can require password sign-in and setting up face sign-in on that domain again.
