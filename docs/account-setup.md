# Account setup

The connected free Supabase project is `aphasia-my-day`, reference `bothqvgqqfhlzhjsvzry`. Its public URL and publishable browser key are in `src/cloud-config.ts`. These identify the project; they do not grant access to patient records. Never put a secret or service-role key in browser code.

## Current configuration

- Email/password authentication enabled, email confirmation disabled for name-only sign-in.
- Anonymous sign-in disabled.
- The schema in `supabase/schema.sql` is installed.
- Row security permits authenticated users to read only their own log. Direct browser writes are revoked. The save function checks both the signed-in user and expected revision.
- The existing `firststep` project was paused with the owner's permission to free a free-plan slot. `kjewels-prod` was left unchanged.

Users choose a unique name and password. The app normalizes the name and derives an internal non-deliverable alias for Supabase Auth. No inbox is needed. If a name is taken, add a number. Display-name changes in Settings do not change the sign-in name. Password recovery and username changes are not implemented.

## Connecting a different project

1. Create a project and run `supabase/schema.sql` in its SQL editor.
2. Enable email/password authentication and disable email confirmation if keeping name-only sign-in.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser build. Alternatively replace the public settings in `src/cloud-config.ts`.
4. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on the email server if overriding the committed project.
5. Rebuild and verify two separate accounts cannot read each other's logs.

The app caches each account under its user ID and checks the server every ten seconds, on focus and after reconnecting. Concurrent unsaved edits ask which version to keep. Choosing the cloud version downloads the device version as a backup first. A browser-only historical log is imported explicitly into an empty account rather than automatically copied into whoever signs in.

## Live verification

On October 16, 2026, synthetic accounts verified signup without an inbox, password sign-in, reads and writes in two independent sessions, stale-save rejection, rejection of anonymous reads and unconditional writes, isolation between accounts, and email-send throttling. The synthetic accounts have names beginning `Design Test`; they contain no patient information.

For cross-device acceptance testing, create a test account in one browser, save an activity, then sign into the same name in a different browser or device. Wait up to ten seconds or refocus the page. Change data in each browser before either syncs to exercise conflict resolution. Use synthetic information for testing.
