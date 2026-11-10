# Activity reminders

Settings → Activity reminders offers Off, Email, or Text message, with separate Good morning, 4 PM if no activity, and Good night options. Morning defaults to 8 AM when selected; night defaults to 9 PM. Both are adjustable in half-hour steps. Existing accounts retain their 4 PM preference and are not opted into new emails. Text is unavailable until the Twilio sender and the database migration are configured. Reminders are off by default. The user supplies their own email or mobile number and time zone, gives permission, and confirms a link delivered to that destination. Opening the link does not change preferences; its confirmation button does. Links expire in 24 hours. Confirmation requests have a persistent one-minute per-account cooldown. Text confirmation also has a three-per-account daily limit and a one-minute cooldown for the same number.

In the saved IANA time zone, the scheduler checks each selected reminder every minute during the hour beginning at its chosen time. The 4 PM reminder checks the synced log: a new account with no log is eligible; a completed entry dated today suppresses it. Scheduled but unfinished entries, daily mood ratings and yesterday's activities do not suppress it. Morning and night are independent prompts to start and finish the day's log, including on days with entries. Daylight saving changes follow the saved time zone; account/date/reminder-kind keys prevent duplicate sends when the clock repeats. Offline entries cannot suppress the afternoon check until they sync.

Users can turn reminders off in Settings, through an email unsubscribe link, or by replying STOP to a text. Changing channels or destinations requires confirmation again. These settings live in a server-owned table, so importing, syncing or clearing a log cannot silently change reminder consent. Turn reminders off explicitly to stop delivery.

## Deployment

1. Verify `aphasia-myapp.com` in Resend. Create a Sending access key restricted to that domain.
2. In Vercel Production, set `RESEND_API_KEY`, `REPORT_FROM=My Day <reports@aphasia-myapp.com>`, `REPORT_REPLY_TO=aphasiacarelab@ucf.edu`, and `APP_ORIGIN=https://aphasia-myapp.com`.
3. Generate a private random 32+ character `CRON_SECRET`. Save it in Vercel Production and in Supabase Vault under `my_day_reminders_cron_secret`. Keep both values identical. Never prefix credentials with `VITE_`, commit them, or paste them into chat.
4. Keep the existing server-only `SUPABASE_SECRET_KEY` (or legacy service-role key), `SUPABASE_URL` and public Supabase configuration. The reminder API authenticates the user's existing session before accessing that user's preferences. The migration grants the trusted server role read-only access to synced logs for the reminder check. Browser permissions remain restricted to each user's own log, and browsers cannot read or write the reminder tables directly.
5. Run `supabase/reminders.sql` after `supabase/schema.sql`. Run `supabase/reminder-schedule.sql` to install one named Supabase cron job. Re-running the scripts updates the same functions and job. The dispatcher does nothing if its Vault secret is missing.
6. Redeploy Vercel. Verify the custom domain's HTTPS connection and the cron job's HTTP response. Vercel Hobby's daily cron precision is unsuitable for this check; Supabase cron invokes the protected endpoint instead.

The endpoint is `POST /api/reminders` with `{"action":"run"}` and the scheduler's bearer secret. It must never be invoked by a browser timer. A tick leases up to ten eligible deliveries. Workers recheck the latest log and preference immediately before sending. Unique account/day/reminder-kind rows prevent repeated sends; a five-minute lease allows at most three attempts, and a stable Resend idempotency key prevents duplicates after ambiguous provider timeouts or worker crashes. Messages are paced 600ms apart within a worker. The Vercel function budget is 180 seconds. Increase worker throughput before rolling out to a substantially larger group.

Reminders contain a generic prompt, the app link, and unsubscribe instructions. They do not include activity names, ratings, patient names, or PDFs. Detailed reports are sent only by the existing report action. Provider acceptance means queued, not guaranteed inbox delivery. Only the confirmation message is sent before the destination is verified.

## Activate text reminders

1. Create a [Twilio account](https://www.twilio.com/try-twilio). Set up a reply-capable sender approved for the recipients' country. For US recipients, use a verified toll-free number or a US local number with approved A2P 10DLC registration. [Twilio sender setup](https://www.twilio.com/docs/messaging/tutorials/send-messages-with-messaging-services).
2. Put the sender in a Twilio Messaging Service. Configure [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out) so recipients can reply STOP and START. Use a dedicated service for My Day and set allowed destination countries and usage alerts before enabling sends.
3. Apply the updated `supabase/reminders.sql` to the existing database before enabling SMS. It retains existing email subscriptions and deliveries. The current cron job is reused.
4. Add `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, and `TWILIO_MESSAGING_SERVICE_SID` to Vercel's server environment and redeploy. Keep the key secret out of the client and chat. Text needs the same Supabase, APP_ORIGIN, and CRON_SECRET settings as email.
5. With a consenting test recipient, choose Text message in Settings, confirm the link, and verify delivery and STOP before rollout. No existing email recipient is automatically switched to text.

Text deliveries are claimed once per account, day and reminder kind. Twilio's send endpoint has no application idempotency key, so an uncertain text delivery is not retried. If Twilio reports that a recipient replied STOP at send time, My Day disables the setting. Twilio also enforces its block independently if a rejection happens after initial acceptance. A recipient who opted out must reply START to the sender before re-enrolling.

## Verification

- `npm test` covers authentication, input/consent validation, email and SMS confirmation, unsubscribe, failed delivery, stable email retry keys, carrier opt-out, and origin checks.
- On a development database, run `supabase/reminders.test.sql`. It verifies time windows, daylight saving changes, activity filtering, the real worker role’s permissions, confirmation, separate morning/night retry identities, duplicate suppression, lease recovery, time edits and unsubscribe. Run the updated `reminders.sql` transaction on existing installations before deploying this version; it adds channel columns without losing records. Its synthetic account and all related rows are rolled back.
- Exercise Off, Email, Text, pending confirmation, confirmed, unavailable and error states. Text must stay disabled before provider setup. Use synthetic content for any sending test and obtain permission before sending to a real inbox.

The custom domain is also an explicitly trusted origin for facial sign-in. Existing `FACE_APP_ORIGIN` remains supported. Browser-stored face device keys and sign-in sessions are scoped to a website origin, so moving to the new domain can require password sign-in and setting up face sign-in on that domain again.
