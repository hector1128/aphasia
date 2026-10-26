import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { cloud } from "./cloud";
import { FaceCamera } from "./FaceCamera";
import { faceLoginRequest, type FaceChallenge } from "./face-api";
import { listFaceDevices, signFaceCapture, type FaceDevice } from "./face-device";

type Candidate = { userId: string; device: FaceDevice };
export function FaceSignIn({ onActiveChange, disabled = false }: { onActiveChange: (active: boolean) => void; disabled?: boolean }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [message, setMessage] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const wasActive = useRef(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void (async () => {
      const saved = await listFaceDevices();
      const available = await Promise.all(saved.map(async (candidate) => {
        const result = await faceLoginRequest<{ available: boolean }>({ action: "config", userId: candidate.userId }, controller.signal);
        return result.available ? candidate : null;
      }));
      if (active) setCandidates(available.filter((candidate): candidate is Candidate => candidate !== null));
    })().catch(() => { /* Password sign-in remains available on unsupported browsers. */ });
    return () => { active = false; controller.abort(); };
  }, []);
  useEffect(() => {
    if (!selected && wasActive.current) button.current?.focus();
    wasActive.current = Boolean(selected);
  }, [selected]);
  const close = (error = "") => { setSelected(null); setMessage(error); onActiveChange(false); };
  if (!candidates.length) return null;
  return <section className="face-sign-in" aria-label="Face sign-in">
    {selected ? <FaceCamera cancelLabel="Use my password" onCancel={() => close()} onError={close}
      prepare={async (signal) => {
        const challenge = await faceLoginRequest<FaceChallenge>({ action: "begin", userId: selected.userId, deviceId: selected.device.id }, signal);
        return { device: selected.device, challenge };
      }} submit={async (frames, { device, challenge }, signal) => {
        const signature = await signFaceCapture(device, challenge.message, frames);
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const session = await faceLoginRequest<{ userId: string; access_token: string; refresh_token: string }>({
          action: "login", userId: selected.userId, deviceId: device.id, challengeId: challenge.challengeId, frames, signature,
        }, signal);
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (session.userId !== selected.userId || !session.access_token || !session.refresh_token || !cloud)
          throw Error("Could not confirm sign-in. Please use your password.");
        const result = await cloud.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
        if (result.error) throw Error("Could not finish sign-in. Please use your password.");
      }} /> : <>
      {candidates.map((candidate, index) => <button key={candidate.userId} ref={index === 0 ? button : undefined}
        type="button" className="primary" disabled={disabled} onClick={() => { setMessage(""); setSelected(candidate); onActiveChange(true); }}>
        <Camera aria-hidden="true" /> {candidates.length === 1 ? "Sign in with my face" : `Face sign-in: ${candidate.device.username || `Profile ${index + 1}`}`}
      </button>)}
    </>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
