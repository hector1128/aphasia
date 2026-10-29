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
  const [choosing, setChoosing] = useState(false);
  const [profileId, setProfileId] = useState("");
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
  const close = (error = "") => { setChoosing(false); setSelected(null); setMessage(error); onActiveChange(false); };
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
      <button ref={button} type="button" className="primary" disabled={disabled}
        aria-expanded={candidates.length > 1 ? choosing : undefined}
        aria-controls={candidates.length > 1 ? "face-profile-picker" : undefined}
        onClick={() => {
          setMessage("");
          if (candidates.length === 1) { setSelected(candidates[0]); onActiveChange(true); }
          else setChoosing((previous) => !previous);
        }}>
        <Camera aria-hidden="true" /> Face sign-in
      </button>
      {choosing && <div id="face-profile-picker" className="face-profile-picker">
        <label htmlFor="face-profile">Choose your name</label>
        <select id="face-profile" value={profileId} disabled={disabled} onChange={(event) => setProfileId(event.target.value)}>
          <option value="">Choose a person</option>
          {candidates.map((candidate, index) => <option key={candidate.userId} value={candidate.userId}>
            {candidate.device.username || `Profile ${index + 1}`}
          </option>)}
        </select>
        <button type="button" className="secondary" disabled={disabled || !profileId} onClick={() => {
          const candidate = candidates.find((item) => item.userId === profileId);
          if (candidate) { setChoosing(false); setSelected(candidate); onActiveChange(true); }
        }}>Continue</button>
      </div>}
    </>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
