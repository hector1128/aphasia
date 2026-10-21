# Optional face-verification and sign-in trial

Every signed-in account can opt into face verification once the service is configured. No account allowlist or administrator approval is required. A separately enabled sign-in flow lets an enrolled browser sign in after a fresh face/liveness check and device signature. The Node gateway then obtains a normal Supabase user session for that same account UUID. Name/password remains available. Both verification and face sign-in are disabled by default; adding this code does not activate a hosted deployment.

## Implemented behavior

- Settings exposes setup to any authenticated account when the Node gateway is enabled and the private service responds. Users must consent and complete setup; availability does not automatically enroll anyone or enable the camera.
- Enrollment and adding a browser require password authentication within five minutes and versioned consent. Adding a browser verifies the existing face template and preserves other registered browsers. Setting up again replaces the template and revokes all previous browser registrations.
- Camera access begins after a user action. Three JPEG frames are captured without speech, expressions, head-motion tasks or countdowns. Cancellation, completion, errors and leaving Settings stop the camera. Status messages support Listen and live announcements.
- A non-extractable ECDSA P-256 private key is stored in IndexedDB under the account UUID. No face data is stored in browser storage. Its public key is registered on the private service.
- A durable 120-second single-use challenge binds account, operation and device. The device signs the challenge plus hashes of the ordered captures. Challenges are consumed before signature checking/inference.
- Self-hosted inference uses YuNet detection, SFace embeddings and the MiniFASNet V2/V1SE passive presentation-attack-detection (PAD) ensemble. Every frame must pass PAD and quality checks. Enrollment checks consistency; verification compares only with the selected account.
- SQLite locally, or a private Supabase Postgres schema on Vercel, stores AES-256-GCM encrypted templates, model/configuration fingerprints, consent version/time, public device keys and challenge/rate records. Raw captures and scores are not stored/logged/returned.
- Six challenges per account per minute, input/concurrency limits, account isolation and removal/re-enrollment invalidation are enforced. Deletion works without inference models.
- Face sign-in uses its own single-use `login` challenge. A successful Settings verification cannot be reused to sign in. The inference handler does not use Supabase Auth administrator credentials or session tokens. The standalone service can run without those credentials; functions within one Vercel project share its server environment.

The browser key is a software possession credential, **not a hardware-attested authenticator**. A compromised browser can sign injected captures. Passive PAD reduces model-dependent risks but is not proof against deepfakes/sensor injection. This trial has not established false-match rates, spoof resistance, NIST conformance or suitability for patient authentication.

## Local setup

For development checks, use synthetic accounts without patient information. Obtain consent before enrolling anyone. This is development guidance, not an account eligibility restriction.

1. Add the gateway variables from `.env.example` to the existing `.env.local`, preserving its other settings. Set `FACE_PROTOTYPE_ENABLED=true`, the exact browser origin including port, service URL and random shared secret. This enables setup for all authenticated accounts. Verification alone needs no Supabase server secret; sign-in additionally requires the settings below.
2. Copy `face-service/.env.example` to `face-service/.env`. Use the same shared secret. Generate a separate encryption key. These files are ignored by Git. The retired `FACE_TEST_USER_IDS` setting is ignored on both servers and may be removed; existing enrollment does not change.

   Generate the shared secret and encryption key separately:

   ```sh
   python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
   python3 -c 'import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())'
   ```

3. Create the Python environment and install the model-preparation dependencies. These include the runtime libraries and the exporter used when liveness exports are missing:

   ```sh
   python3 -m venv face-service/.venv
   face-service/.venv/bin/python -m pip install -r face-service/requirements-export.txt
   ```

4. Prepare all four models and save their paths/checksums:

   ```sh
   face-service/.venv/bin/python face-service/prepare_models.py --write-env face-service/.env
   face-service/.venv/bin/python face-service/check_liveness.py
   ```

   The command downloads missing YuNet/SFace models from OpenCV Zoo revision `47534e27c9851bb1128ccc0102f1145e27f23f98` using fixed SHA-256 checksums. It also downloads pinned MiniFASNet weights when needed, exports missing liveness ONNX files and compares each new export against the original model on three synthetic inputs. Valid existing files are checked and reused, including exports described by the original `liveness-manifest.json`. An existing file with a checksum/provenance mismatch causes setup to fail instead of silently replacing it. Downloads use bounded temporary files and are installed only after verification; interrupted downloads can be retried. Each completed liveness export records its provenance so preparation can resume after an interrupted conversion.

   `--write-env` updates only model paths/checksums after all preparation succeeds, preserving secrets, encryption keys, database paths, thresholds and activation settings. Models, the generated provenance manifest and upstream licenses/notices stay in the ignored `face-service/models` directory. Runtime-only installations can use `requirements.txt` when verified exports are already provisioned; fresh conversion additionally needs `requirements-export.txt`. The lower-level `prepare_liveness.py` still supports explicit regeneration; use `--if-missing` to reuse its existing exports.

5. Set measured `FACE_MATCH_THRESHOLD` and `FACE_PAD_THRESHOLD`. There are deliberately no acceptance-threshold defaults. Local test thresholds must be treated as experimental until evaluated on representative captures and attacks. Missing/incompatible configuration rejects captures; there is no demo-success mode.
6. Start local development from the repository root:

   ```sh
   npm run dev
   ```

   The command uses `FACE_APP_ORIGIN` as the web address when face authentication is enabled, with a fixed port so Vite cannot silently switch to a different browser-storage origin. For a local HTTP `FACE_SERVICE_URL`, it reuses an authenticated running face service or starts `face-service/.venv`'s Python with the private `face-service/.env` settings and the model-preparing entrypoint. The shared secret must match the Node configuration. Startup failures are shown in the terminal; stopping the dev command stops the face process it owns. A configured remote HTTPS face service is used directly. Restart the command after changing either environment file.

7. Open the exact address printed by `npm run dev` (normally `http://127.0.0.1:5173/`). `localhost`, `127.0.0.1`, different ports and different browsers have separate device-key storage. Sign in or create an account. In Settings, choose **Set up face verification**, consent, re-enter the password and capture. Exercise **Check my face** and **Remove face data**. The gateway binds all setup/status/removal actions to the authenticated Supabase user; a caller-supplied account UUID cannot select another user's records.

### Automatic preparation on the deployment server

For the Vercel-hosted Python function and private Supabase Postgres storage, follow [deploy face authentication](face-deployment.md). It includes the SQL migration, build-time model preparation, server settings and registration on the live domain. The commands below are for an optional standalone Python host, not the Vercel function.

Set the Python service's install/build command to:

```sh
python -m pip install -r face-service/requirements-export.txt
```

Set its start command to:

```sh
python face-service/start_service.py --host 0.0.0.0 --models-dir /data/face-models
```

Use your actual writable persistent-volume location instead of `/data/face-models`. Alternatively, set `FACE_MODELS_DIR` on the platform and omit `--models-dir`. The entrypoint reads the platform's `PORT` variable (default `8001`); `--port` can override it. Binding to `0.0.0.0` is for the service/container network behind the gateway's authenticated HTTPS connection. Without `--host`, the command binds only to loopback.

Supply `FACE_SERVICE_SECRET`, `FACE_ENCRYPTION_KEY`, `FACE_DB_PATH`, `FACE_MATCH_THRESHOLD` and `FACE_PAD_THRESHOLD` through the platform's environment settings. The start command downloads/prepares missing models, validates them, adds only verified model paths/checksums to the process environment, and starts one Uvicorn worker with access logging off. It does not read, generate or source a replacement `.env`, change these platform settings, or contact Supabase. A preparation failure prevents startup; HTTP handlers never attempt downloads.

Persist the model directory **including `liveness-manifest.json`** along with the database's own persistent storage. A fresh deployment can download everything; subsequent starts reuse verified copies without downloads or conversion. A deployment with ephemeral storage must prepare them again, needs outbound HTTPS to GitHub, and may take longer to start. Keep exports stable across deployments: changed export bytes/toolchain versions change the template fingerprint and require re-enrollment. Preparation downloads public models/licenses only; face captures, templates and secrets are never sent upstream. Install dependencies and run startup once per authoritative service instance, rather than launching concurrent provisioners into the same model directory.

### Enable optional sign-in

After enrollment and verification work, add these settings to the root `.env.local`, beside `package.json`:

```dotenv
FACE_SIGNIN_ENABLED=true
SUPABASE_SECRET_KEY=your_server_secret_key
```

Get the server secret from your Supabase project's **Settings → API Keys → Publishable and secret API keys**. A new secret key starts with `sb_secret_`. The gateway also accepts an existing `SUPABASE_SERVICE_ROLE_KEY` as a legacy alternative. Keep these credentials server-side: never add them to a `VITE_` variable, client code, screenshots or chat. For a standalone Python host, keep them only on the Node host. On Vercel, functions share the project environment; only the Node gateway uses the Auth administrator key. Restart Vite after saving. Restart the private Python service too when updating it to the version supporting `login` challenges.

Existing enrollment is preserved. Use the same browser and origin as enrollment. Refresh the app, sign out, choose **Sign in with my face**, allow the camera and choose **Take pictures**. **Use my password** returns to ordinary sign-in. Clearing browser storage removes the local device credential; that browser must be added again.

### Register multiple browsers

1. On a new browser, sign in with the existing name and password.
2. In Settings, choose **Add this browser**, give consent and confirm the password.
3. Take three pictures. The private service checks liveness and matches them against the existing face template before registering that browser's public key.
4. Sign out. Each registered browser can now use its own **Sign in with my face** button. Earlier registrations keep working, and the stored face template is unchanged.

Each browser keeps its own non-extractable private key. No keys are copied between browsers. Registration uses a separate `register` challenge and is never accepted by the anonymous sign-in endpoint. A matching face alone cannot register a new browser. The existing account-wide attempt limits also apply to registration.

**Set up again** (or **Replace face setup** on an unregistered browser) explicitly replaces the template and revokes all previous browser registrations. **Remove face data** deletes the template and every registered browser; it does not sign out existing Supabase sessions. Per-browser listing and individual remote revocation are not implemented; removal currently applies to all browsers.

Restart the Python service after this update. On startup, an atomic SQLite migration changes the device key from `user_id` to `(user_id, device_id)`, preserving the original device record and encrypted template. Migration is repeatable; no re-enrollment is required. Code from before this migration must not be used with the upgraded database because it assumes one browser per account.

After the private service confirms a fresh account-bound login proof, the gateway reads the existing Supabase account, generates a one-time magic-link token using [`admin.generateLink`](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), and immediately consumes its hash server-side using [`verifyOtp`](https://supabase.com/docs/reference/javascript/auth-verifyotp). Generating this link does not send email, so the app's internal email aliases do not need mail delivery. Only the resulting normal user access/refresh tokens reach the browser through `auth.setSession`. The gateway checks the UUID at each step; the account, log ownership and `auth.uid()` policies stay the same. It does not store passwords or use a cached session as the face credential.

The gateway rejects accounts with verified MFA factors instead of bypassing their additional authentication. Removing face data prevents future face proofs; it does not revoke existing Supabase sessions. Disable `FACE_SIGNIN_ENABLED` to turn off new face sign-ins while retaining password access and signed-in template removal.

Camera/crypto require HTTPS or localhost. Hosted inference can use the Vercel Python function with private Supabase Postgres storage, or a standalone Python host with persistent storage. Both require authenticated HTTPS between Node and Python and HTTPS for the app. `api/face.ts` and `api/face-login.ts` run as Vercel gateways; models/SQLite do not belong in their ephemeral filesystem. Restrict service ingress to the gateway, disable request-body/APM logging at proxies, protect secrets and apply ingress size/time limits. A standalone SQLite host needs one authoritative instance/database. The Postgres backend instead serializes mutations with account-row locks across Vercel instances; inference runs outside transactions and finalization rechecks the epoch.

Delete enrolled data before disabling trial access. Removal deletes active templates/devices/challenges; establish a separate policy for encrypted backups/snapshots. Losing the encryption key requires deletion/re-enrollment. Changing models, preprocessing or thresholds invalidates existing templates. Account deletion/deprovisioning must also remove its trial records. Apply model-license and privacy review before deployment.

## Model contract

Removal retains non-biometric rate counters to prevent resetting inference limits. Counters contain only UUIDs/timestamps, expire after one minute, and are purged on that account's next successful challenge request. Apply a scheduled cleanup too if the service is left idle.

The adapter uses [Minivision's Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing) at revision `b6d5f04ad78778917853b25c778acef6d5626d15`. Original architecture and crop code are preserved with their [Apache 2.0 license and attribution](../face-service/vendor/minifasnet/NOTICE). The two upstream weights are `2.7_80x80_MiniFASNetV2.pth` and `4_0_0_80x80_MiniFASNetV1SE.pth`. Both are required; unavailable models never fall back to face matching alone.

| Property | Required value |
| --- | --- |
| Input | Float32 `[1, 3, 80, 80]` for each model |
| Crop | Integer YuNet box expanded 2.7x for V2 and 4x for V1SE; upstream boundary shifting and inclusive crop |
| Preprocessing | OpenCV linear resize; **BGR** order; float32 pixels **0–255**, without division/normalization; NCHW |
| Output | `[1, 3]` logits from each model; class **1** is live, classes 0 and 2 are spoof |
| Combination | Softmax each model independently, then average their three-class scores |
| Acceptance | Live class strictly wins and its average score meets `FACE_PAD_THRESHOLD` on every frame |

The old generic two-class RGB interface and `FACE_PAD_SIZE` setting have been replaced. Checksums, model shapes and export metadata are verified at load. Adapter profile, both model hashes, recognition models and thresholds participate in the template fingerprint; changes require re-enrollment. The upstream [crop implementation](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/b6d5f04ad78778917853b25c778acef6d5626d15/src/generate_patches.py), [BGR/raw-pixel tensor conversion](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/b6d5f04ad78778917853b25c778acef6d5626d15/src/data_io/functional.py), and [ensemble/class decision](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/b6d5f04ad78778917853b25c778acef6d5626d15/test.py) define the adapter semantics. The upstream model uses a different detector; our YuNet boxes and varied browser cameras still require evaluation. No upstream benchmark claim establishes performance in this app.

SFace produces a normalized 128-float template. `FACE_MATCH_THRESHOLD` is the minimum cosine similarity for each verification capture and between enrollment captures. Model example thresholds are not calibrated acceptance values for this population/deployment. Neural-network softmax scores are not a measured probability of an attack being rejected. Runtime inference downloads no models and disables ONNX Runtime telemetry collection.

## Validation

```sh
npm run build
npm run lint
npm test
face-service/.venv/bin/python -m pip install -r face-service/requirements-test.txt
face-service/.venv/bin/python -m unittest discover -s face-service -v
face-service/.venv/bin/python face-service/check_liveness.py
```

Tests use synthetic bytes/images and controlled model outputs. They cover gateway isolation, device/capture signatures, replay/expiration, consent, durable limits, encryption, removal races, model changes, PAD rejection and image boundaries. They do **not** measure model accuracy/liveness. Independently evaluate false matches/rejections, demographic/device variation, print/video/injection attacks, and usability with people with aphasia and facial/motor differences before patient use.

Initial validation on October 17, 2026: build/TypeScript and lint passed; 47 JavaScript tests, compiled API smoke checks, and 21 Python tests passed. An isolated headless Edge browser with synthetic camera input exercised consent, capture/cancellation, browser-generated signatures, enrollment, verification, removal, permission denial and a 320px layout. Those browser API/model outcomes were mocked.

Subsequent liveness integration used the actual pinned pretrained weights and exported both ONNX models. Maximum absolute PyTorch/ONNX logit differences over three synthetic inputs were approximately `0.00000548` (V2) and `0.00000817` (V1SE). Both exports passed runtime checksums/metadata and ran through the actual crop/ensemble adapter on blank and random synthetic images. Unit tests now also cover BGR channel/range correctness, both crop scales near image edges, three-class semantics, model disagreement, ties, malformed/nonfinite logits, invalid thresholds, missing ensemble members and incompatible model metadata. These are engineering checks; live-camera accuracy, spoof resistance and patient usability remain unmeasured. Python dependencies stay in `face-service/.venv`.

Sign-in integration checks cover disabled configuration, account isolation, login-specific proof requirements, Supabase identity checks and MFA rejection. Headless Edge with a synthetic camera exercises the actual login component, cancellation and camera cleanup, password fallback, rejected matches, mocked Supabase session handoff and a 320px layout. Browser API/model outcomes and Supabase HTTP responses in these tests are mocked. The enrolled user subsequently reported a successful live face sign-in; that confirms the basic session handoff, not authentication accuracy or attack resistance.

Face sign-in validation on October 18, 2026: production build/TypeScript, lint, 54 JavaScript tests, compiled gateway smoke checks and 31 Python tests passed. Existing enrollment was confirmed present after restarting the updated private service.

Multiple-browser validation on October 19, 2026: production build/TypeScript, lint, 55 JavaScript tests, compiled gateway smoke checks and 39 Python tests passed. Protocol tests cover legacy migration, unchanged templates, independent browser logins, registration proof/consent/mismatch/replay rejection, key replacement prevention, and global removal/re-enrollment invalidation. A headless Edge check used two isolated browser profiles, synthetic camera input and mocked API/model results to exercise enrollment, adding a browser, rejected registration, both sign-ins, global removal, camera cleanup and a 320px layout; actual browser-generated signatures were verified. The local service was restarted and the existing test enrollment and browser registration were confirmed preserved by migration. Live registration of a second browser remains for the enrolled user to exercise.

Self-service availability validation on October 19, 2026: build/TypeScript, lint, 57 JavaScript tests, compiled gateway smoke checks and 41 Python tests passed. Coverage includes enrollment and account-bound login for previously unlisted accounts, rejection of unauthenticated setup and mismatched account proofs, private service authentication, UUID validation and isolation of removal between accounts. No per-account approval settings are required. Global feature flags, consent, recent password confirmation, registered-browser proofs and the existing MFA policy remain in effect.

Deployment model preparation validation on October 20, 2026: all 52 Python tests passed. A fresh temporary directory successfully downloaded the pinned official models/weights, exported both liveness models with parity checks, and loaded all four models in the actual engine. A repeat run with network requests and exporter imports disabled preserved model hashes/mtimes and the manifest. The legacy local manifest was also accepted unchanged. The actual deployment entrypoint served an authenticated status request on a temporary local port using the platform-style `PORT` variable and a synthetic database, then stopped. No hosted deployment or patient capture was performed in these checks.

Local development startup validation on October 20, 2026: build/TypeScript, lint, 57 application JavaScript tests, compiled API smoke checks and four development-launcher tests passed. The real launcher also started Vite and the Python service together on temporary local ports, enabled the face sign-in configuration endpoint, and stopped both owned servers before exiting. A separate integration check verified that an existing face service is reused and remains running when the launcher stops. These checks used status requests only, with no face capture or new Supabase session.

Vercel/Postgres adaptation validation on October 20, 2026: website build/TypeScript, lint, 61 application JavaScript tests, compiled API smoke checks and four development-launcher tests passed. All 65 Python tests passed with the Postgres tests enabled against an isolated local PostgreSQL 17.6 database. The migration ran twice successfully; restricted-role tests exercised encryption, concurrent single-use challenges, shared rate limits, removal during inference, multiple browsers, Auth-user cascade deletion and denied browser-role access. The Vercel HTTP wrapper also performed status/removal against that database without loading models. An actual four-model bundle loaded locally with network access and Torch/ONNX exporter imports disabled. The Vercel configuration passed validation against its official schema; Linux Python 3.12 runtime dependencies plus reference models measured about 392 MB uncompressed before Vercel overhead. No hosted Vercel build, live Supabase pooler/TLS connection, deployment, new patient capture or biometric accuracy evaluation was performed.
