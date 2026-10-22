# Face authentication on Vercel + Supabase

This deployment uses the providers already used by the app. Vercel runs the website, Node sign-in gateway and a Python inference function. Supabase handles accounts and stores encrypted templates and authentication state in a private Postgres schema. Render is not required.

Captures travel from the browser to the Node gateway and then the Python function over authenticated HTTPS. They are processed in memory and are not stored in Postgres. Only encrypted face templates, public browser keys, consent records, challenge metadata and rate counters are persisted. These providers host the data and computation; this is not entirely on-premises storage.

## 1. Prepare the Supabase database

For `login-testing`, use a test Supabase project/account without patient data. A branch deployment does not automatically isolate the database. Keep Preview and Production settings separate.

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Run [`supabase/face-auth.sql`](../supabase/face-auth.sql). It is repeatable and creates the private `face_auth` schema and a restricted `face_auth_service` login role. Browser roles cannot read/write these tables. Deleting an Auth user cascades to its face records.
3. Generate a random password privately, for example with `python3 -c 'import secrets; print(secrets.token_urlsafe(48))'`. In a separate private SQL Editor query, run `alter role face_auth_service password 'YOUR_GENERATED_PASSWORD';`, substituting that password. Keep the completed command/password out of Git and chat.
4. Click **Connect** in Supabase and select the **Transaction pooler** connection string (port **6543**). Keep its host, database name and project reference. Replace its username with `face_auth_service.YOUR_PROJECT_REFERENCE` and its password with the password from step 3. URL-encode the password if it contains reserved URL characters. The generated URL-safe example above avoids those characters.
5. Save the resulting connection string as `FACE_DATABASE_URL` in Vercel's server environment in step 2. Do not use your Supabase Auth API key as the database password. Do not expose the private schema through the Data API or grant it to browser roles.

The expected form is `postgresql://face_auth_service.PROJECT_REFERENCE:PASSWORD@YOUR_POOLER_HOST:6543/postgres`. Use your actual project values; this example is not a runnable URL. The Python driver verifies TLS certificates and disables prepared statements for transaction pooling. Each short transaction closes its connection; no database session or local file is needed between invocations. The dedicated role can access only the face schema through the grants in this migration.

## 2. Set the Vercel environment variables

Open [Vercel Dashboard](https://vercel.com/dashboard) → the aphasia project → **Settings → Environment Variables**. For the `login-testing` deployment, select **Preview** and scope overrides to that branch where available. For a later release, configure **Production** separately.

| Name | Value |
| --- | --- |
| `FACE_PROTOTYPE_ENABLED` | `true` |
| `FACE_SIGNIN_ENABLED` | `true` |
| `FACE_APP_ORIGIN` | The exact HTTPS origin you open in your browser, with no trailing slash. Production: `https://aphasia-gamma.vercel.app`. For testing, use the branch's stable Preview URL shown by Vercel. |
| `FACE_SERVICE_SECRET` | A random secret of at least 32 characters; generate with `python3 -c 'import secrets; print(secrets.token_urlsafe(48))'`. |
| `FACE_ENCRYPTION_KEY` | A separate base64-encoded 32-byte AES key; generate with `python3 -c 'import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())'`. Preserve it across redeploys and back it up securely. |
| `FACE_DATABASE_URL` | The dedicated role's transaction-pooler URL from step 1. |
| `FACE_MATCH_THRESHOLD` | Your evaluated matching threshold. Existing local values are experimental and suitable only for continuing the development trial. |
| `FACE_PAD_THRESHOLD` | Your evaluated passive-liveness threshold; the same trial limitation applies. |
| `SUPABASE_SECRET_KEY` | The existing Supabase server secret, starting with `sb_secret_`, for the same Supabase project used by the browser. A legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported. |

**Remove `FACE_SERVICE_URL` from the Vercel environment.** Leaving a localhost value there would send requests to the wrong place. When it is absent on Vercel, the Node gateway uses Vercel's trusted `VERCEL_URL` environment variable to call `/api/face-service` on the same deployment. An explicitly configured `FACE_SERVICE_URL` still selects a standalone service using `/v1/face`, for local development or another hosting arrangement.

If the deployment URL has Vercel Deployment Protection, open **Settings → Deployment Protection → Protection Bypass for Automation** and create a bypass secret. Vercel supplies it as `VERCEL_AUTOMATION_BYPASS_SECRET` on the next deployment. The gateway sends it only in its server-to-server request header; it is never returned to the browser or sent to a standalone service. The Python endpoint still requires `FACE_SERVICE_SECRET` independently.

Never give secrets a `VITE_` prefix. If testing against a different Supabase project, also set the browser's public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` and the gateway's matching public `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`. All three components must use the same project's account identities. Functions in one Vercel project share the project's server environment; the Python code uses the restricted database connection, not the Auth administrator API key.

## 3. Deploy the branch

Commit and push the implementation to `login-testing` when ready. The repository's `vercel.json` selects Vite and configures the following build steps:

1. `npm ci && python3.12 face-service/build_vercel.py` runs during installation, before API packaging. It explicitly selects the same Python minor version as the function. `uv venv` creates a temporary environment without bootstrapping pip, which avoids `ensurepip` failures in Vercel's managed Python. `uv pip install --python` targets that environment for the pinned CPU-only PyTorch/export dependencies. The script downloads verified upstream models/weights, exports the liveness ensemble with parity checks, and writes a read-only model bundle under `face-service/bundled-models`.
2. The temporary exporter environment is deleted. It is never part of the deployed function. The root `requirements.txt` contains runtime dependencies only and pins the image-processing/inference versions used by this deployment.
3. `npm run build` builds the website. Vercel packages `api/face-service.py` as a separate Python 3.12 function, alongside the existing Node endpoints. Static assets, local databases, `.env` files, tests, source weights and local virtual environments are excluded from the Python bundle.

Check the deployment's build logs. Do not replace the install command with plain `npm install`: that would omit model preparation. Runtime HTTP requests never download/convert models or write a SQLite database. Missing configuration/models fail closed. Status/removal do not load inference models, so users can still remove enrolled data when inference assets are unavailable.

Model preparation needs outbound HTTPS to the pinned public GitHub sources and package indexes. No face captures or templates are used during builds. Do not change the pinned exporter/model versions casually: changed model bytes change template fingerprints and require re-enrollment. A future dependency update should recheck the actual Vercel function size and model behavior.

Enable Vercel's system environment variables if the project has disabled them. If changing environment variables after an existing deployment, open **Deployments → latest deployment → ⋯ → Redeploy**. Use the exact origin configured for that environment. A different alias or temporary deployment URL is deliberately rejected by the gateway's origin check.

## 4. Enroll on the deployed website

1. Sign in with your existing name and password on the configured HTTPS origin.
2. Open Settings, consent, confirm your password and set up face authentication.
3. Use **Check my face**, sign out, and try **Sign in with my face**.
4. On another browser, password-sign-in first and choose **Add this browser**.

The hosted Postgres database starts empty; this change does not upload your local SQLite database or encryption key. Local development can keep its existing settings and enrollments. Browser registrations on localhost do not transfer to the live domain. Keep the hosted encryption key stable, and establish database backup/deletion retention before relying on stored enrollments.

## Validation and limits

Run `npm run build`, `npm run lint`, `npm test`, and `face-service/.venv/bin/python -m unittest discover -s face-service -v`. Install `face-service/requirements-test.txt` in the local virtual environment first; it includes the PostgreSQL driver for the new storage tests. Postgres integration tests require `FACE_TEST_DATABASE_URL` pointing to an isolated **local** database named `aphasia_face_test...`; they refuse other database names and remote hosts. Never point these tests at Supabase. Without that setting, the Postgres integration tests are skipped explicitly.

The tests cover encryption, identity isolation, transaction-backed replay/rate protection across instances, removal during inference, multiple browsers, cascade deletion, private-schema access restrictions, the Vercel endpoint's authentication, and failure without a database URL. They use synthetic captures and a controlled engine.

Linux Python 3.12 runtime wheels resolved successfully during the October 20 check. Their uncompressed contents plus the four reference models measured approximately **392 MB**, before application code and Vercel runtime/bytecode overhead. This is a dependency estimate, not a measurement of a deployed Vercel function. The real Vercel build, cold starts, live pooler connection/TLS, deployed camera flow and load behavior still need verification. Biometric accuracy, spoof resistance and accessibility evaluation remain outstanding; see [face-verification.md](face-verification.md).

References: [Python API functions](https://vercel.com/docs/functions/runtimes/python/api-directory), [function limits](https://vercel.com/docs/functions/limitations), [Vercel environment settings](https://vercel.com/docs/environment-variables/managing-environment-variables), [protected deployments](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation), and [Supabase connection pooling](https://supabase.com/docs/guides/database/connecting-to-postgres).
