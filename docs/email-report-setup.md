# Daily and weekly PDF email

Settings offers Daily and Weekly reports, a saved recipient address, PDF download and manual sending. Weekly reports use the Monday-to-Sunday week containing the selected day. Missing mood or other information does not prevent a report.

## Configure email

1. Obtain SMTP credentials from an email provider. For Gmail, use a supported app password rather than the normal sign-in password.
2. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and `REPORT_FROM` in `.env.local` for local development, or in the hosting provider's server environment for deployment.
3. Use port 587 with `SMTP_SECURE=false` for STARTTLS, or port 465 with `SMTP_SECURE=true` for implicit TLS. The provider must permit the sender address.
4. Restart the local server or redeploy after changing environment settings.
5. Send a synthetic report to your own test inbox and check the attachment.

SMTP credentials stay server-side. Never prefix secrets with `VITE_`. The app reports setup is needed when SMTP is missing. Provider acceptance is not a guarantee of inbox delivery.

`api/report.ts` provides the Vercel endpoint. Hosted requests must be same-origin and signed in. Supabase validates the bearer token and enforces a one-minute per-account cooldown. Requests are limited to 1 MB and one recipient. Development and preview also serve the endpoint locally with a short cooldown. Static-only hosting needs a separate backend.

If a different Supabase project is configured for the frontend, configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the server too. These are public connection settings, not an admin key.

## Contents and calculations

Daily PDFs include the day's activities and ratings, daily mood, sleep, mindfulness, patterns and values. Weekly PDFs add daily mood and average activity mood graphs, activity counts by day, sleep and mindfulness charts, and detailed activity tables. Missing measurements are shown explicitly and excluded from averages. Scheduled completion rates count plans due by the report time, including unanswered plans, and exclude future activities.

Only the chosen report period's entries, mood and mindfulness records, relevant sleep periods and saved values are submitted. Reports contain personal information. Automated email tests use a mock transport and inspect actual PDF attachment bytes; they do not send real email.
