import { useEffect, useRef, useState } from "react";
import { Camera, Volume2 } from "lucide-react";
import { cloud } from "./cloud";
import { usernameAlias } from "./account-identity";
import { FACE_CONSENT_VERSION, faceRequest, type FaceChallenge, type FaceStatus } from "./face-api";
import { createFaceDevice, readFaceDevice, removeFaceDevice, nameFaceDevice, signFaceCapture } from "./face-device";
import { FaceCamera } from "./FaceCamera";

type Operation = "enroll" | "register" | "verify";

export function FaceSettings({ userId, username }: { userId: string; username: string }) {
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [step, setStep] = useState<"idle" | "consent" | "camera" | "remove">("idle");
  const [operation, setOperation] = useState<Operation>("enroll");
  const [consent, setConsent] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const sectionHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void (async () => {
      const device = await readFaceDevice(userId).catch(() => null);
      const next = await faceRequest<FaceStatus>({ action: "status", deviceId: device?.id }, controller.signal);
      if (active) {
        setStatus(next);
        if (next.registered) await nameFaceDevice(userId, username).catch(() => {});
      }
    })().catch(() => { /* An unconfigured trial does not interrupt ordinary Settings. */ });
    return () => {
      active = false; controller.abort(); generation.current++;
    };
  }, [userId]);
  useEffect(() => {
    if (step !== "idle") heading.current?.focus();
    else if (previousStep.current !== "idle") sectionHeading.current?.focus();
    previousStep.current = step;
  }, [step]);

  const cancel = () => {
    generation.current++; setStep("idle"); setBusy(false); setPassword(""); setConsent(false); setMessage("");
  };
  const openCamera = (nextOperation: Operation) => {
    generation.current++; setOperation(nextOperation); setStep("camera"); setMessage("");
  };
  const cameraError = (error: string) => {
    setStep("idle"); setMessage(error);
    const current = generation.current;
    void (async () => {
      const device = await readFaceDevice(userId);
      const next = await faceRequest<FaceStatus>({ action: "status", deviceId: device?.id });
      if (current === generation.current) setStatus(next);
    })().catch(() => {});
  };

  if (!status?.available) return null;
  return <section className="face-settings" aria-labelledby="face-title">
    <h2 id="face-title" ref={sectionHeading} tabIndex={-1}>Face verification trial</h2>
    <p>{status.signInAvailable ? "Set up face sign-in on this browser. Your password is also available." : "This trial checks your face. Keep using your password to sign in."}</p>
    {step === "idle" && <div className="face-actions">
      <button className="secondary" onClick={() => {
        setMessage(""); setConsent(false); setOperation(status.enrolled && !status.registered ? "register" : "enroll"); setStep("consent");
      }}>
        <Camera aria-hidden="true" /> {status.enrolled ? status.registered ? "Set up again" : "Add this browser" : "Set up face verification"}
      </button>
      {status.enrolled && <>
        {status.registered ? <button className="primary" onClick={() => void openCamera("verify")}>Check my face</button>
          : <p>Add this browser to use your saved face setup here. Your other browsers will keep working.</p>}
        {!status.registered && <button className="secondary" onClick={() => {
          setMessage(""); setConsent(false); setOperation("enroll"); setStep("consent");
        }}>Replace face setup</button>}
        <button className="secondary" onClick={() => { setMessage(""); setStep("remove"); }}>Remove face data</button>
      </>}
    </div>}
    {step === "consent" && <form onSubmit={async (event) => {
      event.preventDefault(); if (!consent || busy) return;
      const current = generation.current; setBusy(true); setMessage("");
      try {
        const { error } = await cloud!.auth.signInWithPassword({ email: await usernameAlias(username), password });
        if (current !== generation.current) return;
        if (error) throw Error("Password did not match. Please try again.");
        if (!await readFaceDevice(userId)) await createFaceDevice(userId);
        if (current !== generation.current) return;
        setPassword(""); openCamera(operation);
      } catch (error) {
        if (current === generation.current) setMessage(error instanceof Error ? error.message : "Could not confirm your password.");
      } finally { setBusy(false); }
    }}>
      <h3 ref={heading} tabIndex={-1}>{operation === "register" ? "Add this browser" : "Set up face verification"}</h3>
      {operation === "register" ? <>
        <p>We will take three pictures to check your face against your saved setup.</p>
        <p>Your face template and other registered browsers will stay the same.</p>
      </> : <>
        <p>We will take three pictures. Our private server keeps an encrypted face template, not your pictures.</p>
        <p>{status.enrolled ? "This replaces your face setup and removes face access from every registered browser. You will need to add your other browsers again."
          : "You can add other browsers later, or remove your face data here at any time."}</p>
      </>}
      <label className="face-consent"><input type="checkbox" checked={consent} disabled={busy}
        onChange={(event) => setConsent(event.target.checked)} required /> {operation === "register"
          ? "I agree to use my saved face setup on this browser." : "I agree to save a face template for this trial."}</label>
      <label htmlFor="face-password">Enter your password to continue</label>
      <input id="face-password" type={showPassword ? "text" : "password"} autoComplete="current-password"
        value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
      <button type="button" className="secondary" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
        {showPassword ? "Hide password" : "Show password"}</button>
      <button className="primary" disabled={!consent || busy}>{busy ? "Please wait…" : "Open camera"}</button>
      <button type="button" className="secondary" onClick={cancel}>Cancel</button>
    </form>}
    {step === "camera" && <FaceCamera onCancel={cancel} onError={cameraError}
      prepare={async (signal) => {
        const existing = await readFaceDevice(userId);
        const device = existing ?? (operation !== "verify" ? await createFaceDevice(userId) : null);
        if (!device) throw Error("This browser is not set up. Please set up face verification again.");
        const challenge = await faceRequest<FaceChallenge>({ action: "begin", operation, deviceId: device.id }, signal);
        return { device, challenge };
      }} submit={async (frames, { device, challenge }, signal) => {
        const signature = await signFaceCapture(device, challenge.message, frames);
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const result = await faceRequest<{ ok?: boolean; verified?: boolean }>({ action: operation,
          deviceId: device.id, challengeId: challenge.challengeId, frames, signature,
          publicKey: operation !== "verify" ? device.publicKey : undefined,
          consentVersion: operation !== "verify" ? FACE_CONSENT_VERSION : undefined }, signal);
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (operation === "verify" ? !result.verified : !result.ok) throw Error("Your face was not confirmed. Please try again.");
        await nameFaceDevice(userId, username).catch(() => {});
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        setStatus((previous) => previous ? { ...previous, enrolled: true, registered: true } : previous);
        setStep("idle"); setConsent(false);
        setMessage(operation === "register" ? "This browser was added. Your other registered browsers will keep working." : operation === "enroll"
          ? status.signInAvailable ? "Face sign-in is set up on this browser." : "Face verification is set up on this browser. Keep using your password to sign in during the trial."
          : status.signInAvailable ? "Your face was confirmed." : "Your face was confirmed. This trial does not change how you sign in.");
      }} />}
    {step === "remove" && <div>
      <h3 ref={heading} tabIndex={-1}>Remove your face data?</h3>
      <p>This removes your face template and face access from every registered browser.</p>
      <p>Your password and your log will stay the same.</p>
      <button className="primary" disabled={busy} onClick={async () => {
        setBusy(true); setMessage("");
        try {
          const result = await faceRequest<{ ok: boolean }>({ action: "remove" });
          if (!result.ok) throw Error("Could not remove your face data. Please try again.");
          await removeFaceDevice(userId).catch(() => {});
          setStatus((previous) => previous ? { ...previous, enrolled: false, registered: false } : previous); setStep("idle");
          setMessage("Your face template and all registered browsers were removed.");
        } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove your face data."); }
        finally { setBusy(false); }
      }}>{busy ? "Please wait…" : "Remove face data"}</button>
      <button className="secondary" disabled={busy} onClick={cancel}>Keep face data</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {message && typeof speechSynthesis !== "undefined" && <button className="secondary" data-read-aloud="off" onClick={() => {
      document.dispatchEvent(new Event("my-day-stop-speaking")); speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message); utterance.lang = "en-US"; utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }}><Volume2 aria-hidden="true" /> Listen</button>}
  </section>;
}
