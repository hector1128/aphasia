# Daily and weekly PDF email

Settings offers Daily and Weekly reports, a saved recipient address, PDF download and manual sending. Weekly reports use the Monday-to-Sunday week containing the selected day. Missing mood or other information does not prevent a report.

## Configure Resend

1. Sign in to [Resend](https://resend.com/domains) and verify a domain you own using its DNS instructions.
2. Create a sending API key in Resend and save it privately as `RESEND_API_KEY` in Vercel's **Production** environment variables. For local development use `.env.local`.
3. Set `REPORT_FROM` to an address on that verified domain, such as `My Day <reports@your-domain.com>`. A personal `@gmail.com` address cannot be a verified Resend sender. It can receive reports.
   This project uses `My Day <reports@aphasia-myapp.com>` and `REPORT_REPLY_TO=aphasiacarelab@ucf.edu`. Replies go to the lab; sending does not impersonate the university's domain. Reply-To also applies to SMTP.
4. Redeploy after adding the variables. Resend takes priority over SMTP when `RESEND_API_KEY` is set. No Resend SDK is needed; the server calls its HTTPS API.
5. Send a synthetic report to a test inbox you control and inspect the attachment and the provider's delivery status. Never use real activity or health data for setup tests.

Without a verified domain, `REPORT_FROM=My Day <onboarding@resend.dev>` supports testing only to the email registered with the Resend account. It cannot send reports to other users. See [Resend's testing-domain restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Both credentials and report content stay out of client bundles and logs. Resend receives the recipient, subject, message, and selected report PDF when the user presses Send. Provider rejection or timeout does not fall back to another transport, which could send duplicate reports. Acceptance means Resend queued the message, not that it reached the inbox.

References: [Resend email API](https://resend.com/docs/api-reference/emails/send-email) and [domain verification](https://resend.com/docs/dashboard/domains/introduction).

## Existing SMTP option

1. Obtain SMTP credentials from an email provider. For Gmail, use a supported app password rather than the normal sign-in password.
2. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and `REPORT_FROM` in `.env.local` for local development, or in the hosting provider's server environment for deployment.
3. Use port 587 with `SMTP_SECURE=false` for STARTTLS, or port 465 with `SMTP_SECURE=true` for implicit TLS. The provider must permit the sender address.
4. Restart the local server or redeploy after changing environment settings.
5. Send a synthetic report to your own test inbox and check the attachment.

SMTP credentials stay server-side. Never prefix secrets with `VITE_`. The app reports setup is needed when neither transport is configured. Provider acceptance is not a guarantee of inbox delivery.

`api/report.ts` provides the Vercel endpoint. Hosted requests must be same-origin and signed in. Supabase validates the bearer token and enforces a one-minute per-account cooldown. Requests are limited to 1 MB and one recipient. Development and preview also serve the endpoint locally with a short cooldown. Static-only hosting needs a separate backend.

If a different Supabase project is configured for the frontend, configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the server too. These are public connection settings, not an admin key.

For the separate 4 PM activity reminder, see [activity-reminders.md](activity-reminders.md). Automatic report delivery remains a saved UI preference; setting up Resend enables manual report sending and confirmed activity reminders, without automatically emailing health reports.

## Contents and calculations

Daily PDFs include the day's activities and ratings, daily mood, sleep, mindfulness, patterns and values. Weekly PDFs add daily mood and average activity mood graphs, activity counts by day, sleep and mindfulness charts, and detailed activity tables. Missing measurements are shown explicitly and excluded from averages. Scheduled completion rates count plans due by the report time, including unanswered plans, and exclude future activities.

Only the chosen report period's entries, mood and mindfulness records, relevant sleep periods and saved values are submitted. Reports contain personal information. Automated email tests use a mock transport and inspect actual PDF attachment bytes; they do not send real email.
