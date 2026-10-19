# Optional face-verification and sign-in trial

This implementation enrolls and verifies **signed-in, explicitly allowlisted test accounts**. A separately enabled sign-in flow lets an enrolled browser sign in after a fresh face/liveness check and device signature. The Node gateway then obtains a normal Supabase user session for that same account UUID. Name/password remains available. Both the trial and face sign-in are disabled by default; adding this code does not activate a hosted deployment.

## Implemented behavior

- Settings exposes the trial only when the Node gateway is enabled, the Supabase user is allowlisted, and the private service responds.
- Enrollment and adding a browser require password authentication within five minutes and versioned consent. Adding a browser verifies the existing face template and preserves other registered browsers. Setting up again replaces the template and revokes all previous browser registrations.
- Camera access begins after a user action. Three JPEG frames are captured without speech, expressions, head-motion tasks or countdowns. Cancellation, completion, errors and leaving Settings stop the camera. Status messages support Listen and live announcements.
- A non-extractable ECDSA P-256 private key is stored in IndexedDB under the account UUID. No face data is stored in browser storage. Its public key is registered on the private service.
- A durable 120-second single-use challenge binds account, operation and device. The device signs the challenge plus hashes of the ordered captures. Challenges are consumed before signature checking/inference.
- Self-hosted inference uses YuNet detection, SFace embeddings and the MiniFASNet V2/V1SE passive presentation-attack-detection (PAD) ensemble. Every frame must pass PAD and quality checks. Enrollment checks consistency; verification compares only with the selected account.
- SQLite stores AES-256-GCM encrypted templates, model/configuration fingerprints, consent version/time, public device keys and challenge/rate records. Raw captures and scores are not stored/logged/returned.
- Six challenges per account per minute, input/concurrency limits, account isolation and removal/re-enrollment invalidation are enforced. Deletion works without inference models.
- Face sign-in uses its own single-use `login` challenge. A successful Settings verification cannot be reused to sign in. The private service never receives Supabase administrator credentials or session tokens.

The browser key is a software possession credential, **not a hardware-attested authenticator**. A compromised browser can sign injected captures. Passive PAD reduces model-dependent risks but is not proof against deepfakes/sensor injection. This trial has not established false-match rates, spoof resistance, NIST conformance or suitability for patient authentication.

## Local setup

Use synthetic accounts without patient information. Obtain consent before enrolling anyone.

1. Add the gateway variables from `.env.example` to the existing `.env.local`, preserving its other settings. Set `FACE_PROTOTYPE_ENABLED=true`, the exact browser origin including port, service URL, random shared secret, and synthetic Supabase **user UUIDs**. An empty allowlist permits nobody. Verification alone needs no Supabase server secret; sign-in additionally requires the settings below.
2. Copy `face-service/.env.example` to `face-service/.env`. Use the same shared secret and UUIDs. Generate a separate encryption key. These files are ignored by Git.

   Generate the shared secret and encryption key separately:

   ```sh
   python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
   python3 -c 'import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())'
   ```

3. Supply local YuNet/SFace ONNX models using [OpenCV's documented interfaces](https://docs.opencv.org/4.x/d0/dd4/tutorial_dnn_face.html). Compute checksums with `shasum -a 256 path/to/model.onnx`. The local `yunet.onnx` and `sface.onnx` have already been downloaded, load-checked, and configured for this checkout.
4. Prepare the pinned liveness models. This checkout's exports have already been prepared and their paths/checksums saved in `face-service/.env`. For a fresh checkout, run from the repository root:

   ```sh
   python3 -m venv face-service/.venv
   face-service/.venv/bin/python -m pip install -r face-service/requirements-export.txt
   face-service/.venv/bin/python face-service/prepare_liveness.py --write-env face-service/.env
   face-service/.venv/bin/python face-service/check_liveness.py
   ```

   The preparation command downloads two pinned upstream weight files, verifies their expected SHA-256 hashes, loads only weight tensors, exports them to ONNX, and compares each export against the original model on three synthetic inputs. It updates only liveness paths/checksums, preserves other configuration, and leaves trial activation/thresholds unchanged. Runtime needs `requirements.txt` only; PyTorch/ONNX exporter dependencies are used only during preparation. Models, the generated provenance manifest and copies of the upstream license/notice stay in the ignored `face-service/models` directory.
5. Set measured `FACE_MATCH_THRESHOLD` and `FACE_PAD_THRESHOLD`. There are deliberately no acceptance-threshold defaults. Local test thresholds must be treated as experimental until evaluated on representative captures and attacks. Missing/incompatible configuration rejects captures; there is no demo-success mode.
6. Start the private service from the repository root:

   ```sh
   python3 -m venv face-service/.venv
   face-service/.venv/bin/python -m pip install -r face-service/requirements.txt
   set -a
   source face-service/.env
   set +a
   face-service/.venv/bin/uvicorn app:create_app --factory --app-dir face-service --host 127.0.0.1 --port 8001 --workers 1 --no-access-log
   ```

7. Separately run `npm run dev` (restart after changing `.env.local`). Sign in as an allowlisted test user. In Settings, choose **Set up face verification**, consent, re-enter the password and capture. Exercise **Check my face** and **Remove face data**.

### Enable optional sign-in

After enrollment and verification work, add these settings to the root `.env.local`, beside `package.json`:

```dotenv
FACE_SIGNIN_ENABLED=true
SUPABASE_SECRET_KEY=your_server_secret_key
```

Get the server secret from your Supabase project's **Settings → API Keys → Publishable and secret API keys**. A new secret key starts with `sb_secret_`. The gateway also accepts an existing `SUPABASE_SERVICE_ROLE_KEY` as a legacy alternative. Keep these credentials on the Node server: never add them to a `VITE_` variable, the Python environment, client code, screenshots or chat. Restart Vite after saving. Restart the private Python service too when updating it to the version supporting `login` challenges.

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

Camera/crypto require HTTPS or localhost. Remote hosting needs a persistent private Python host/database, authenticated TLS between Node and Python, and HTTPS for the app. `api/face.ts` and `api/face-login.ts` run as Vercel gateways; models/SQLite do not belong in their ephemeral filesystem. Restrict service ingress to the gateway, disable request-body/APM logging at proxies, protect secrets and apply ingress size/time limits. Use one service worker and one authoritative persistent database.

Delete enrolled data before disabling trial access. Removal deletes active templates/devices/challenges; establish a separate policy for encrypted backups/snapshots. Losing the encryption key requires deletion/re-enrollment. Changing models, preprocessing or thresholds invalidates existing templates. Account deletion/deprovisioning must also remove its trial records. Apply model-license and privacy review before deployment.

## Model contract

Removal retains non-biometric rate counters to prevent resetting inference limits. Counters contain only UUIDs/timestamps, expire after one minute, and are purged on the next challenge request. Apply a scheduled cleanup too if the service is left idle.

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
