import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import type { FaceDevice } from "./face-device";
import type { FaceChallenge } from "./face-api";

export type FaceProof = { device: FaceDevice; challenge: FaceChallenge };
export function FaceCamera({ prepare, submit, onError, onCancel, cancelLabel = "Cancel" }: {
  prepare: (signal: AbortSignal) => Promise<FaceProof>;
  submit: (frames: string[], proof: FaceProof, signal: AbortSignal) => Promise<void>;
  onError: (message: string) => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const pending = useRef<AbortController | null>(null);
  const alive = useRef(false);
  const errorCallback = useRef(onError); errorCallback.current = onError;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Allow the camera. Then look at the screen.");
  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
  };
  useEffect(() => {
    let active = true; alive.current = true;
    heading.current?.focus();
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw Error("Camera access is unavailable. You can use your password.");
      const next = await navigator.mediaDevices.getUserMedia({ audio: false,
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } });
      if (!active) { next.getTracks().forEach((track) => track.stop()); return; }
      stream.current = next;
      next.getVideoTracks()[0].onended = () => {
        if (active) { stop(); errorCallback.current("The camera stopped. Please try again or use your password."); }
      };
      if (!video.current) throw Error("Could not open the camera. Please try again.");
      video.current.srcObject = next;
      await video.current.play();
      if (active) { setReady(true); setMessage("Keep just your face in view. Choose Take pictures when ready."); }
    })().catch((error) => {
      if (!active) return;
      stop();
      errorCallback.current(error instanceof DOMException && error.name === "NotAllowedError"
        ? "The camera is blocked. Allow it in your browser, or use your password."
        : "Could not open the camera. You can use your password.");
    });
    return () => { active = false; alive.current = false; pending.current?.abort(); stop(); };
  }, []);

  const capture = async () => {
    if (busy || !ready) return;
    setBusy(true); setMessage("Getting ready…");
    const controller = new AbortController(); pending.current = controller;
    const timeout = window.setTimeout(() => { controller.abort(); stop(); }, 30000);
    try {
      const proof = await prepare(controller.signal);
      if (!alive.current || controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const frames: string[] = [];
      setMessage("Taking three pictures. Keep looking at the screen.");
      for (let i = 0; i < 3; i++) {
        if (!alive.current || controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const source = video.current;
        if (!source?.videoWidth || !source.videoHeight || !stream.current?.active) throw Error("The camera stopped. Please try again.");
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 640 / source.videoWidth, 640 / source.videoHeight);
        canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) throw Error("Could not take pictures. Try another browser.");
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.8).split(",")[1]);
        canvas.width = 0; canvas.height = 0;
        if (i < 2) await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
      stop(); setReady(false); setMessage("Checking your pictures…");
      if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
      await submit(frames, proof, controller.signal);
    } catch (error) {
      if (alive.current) errorCallback.current(error instanceof Error && !["AbortError", "TimeoutError"].includes(error.name)
        ? error.message : "The check took too long. Please try again.");
    } finally {
      window.clearTimeout(timeout); stop();
      if (alive.current) { setReady(false); setBusy(false); }
    }
  };
  return <div>
    <h3 ref={heading} tabIndex={-1}>Look at the camera</h3>
    <video ref={video} className="face-camera" muted playsInline aria-label="Your camera preview" />
    <div className="face-actions">
      <button type="button" className="primary" disabled={!ready || busy} onClick={() => void capture()}>{busy ? "Please wait…" : "Take pictures"}</button>
      <button type="button" className="secondary" onClick={() => { pending.current?.abort(); stop(); onCancel(); }}>{cancelLabel}</button>
    </div>
    <p role="status">{message}</p>
    {typeof speechSynthesis !== "undefined" && <button type="button" className="secondary" data-read-aloud="off" onClick={() => {
      document.dispatchEvent(new Event("my-day-stop-speaking")); speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message); utterance.lang = "en-US"; utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }}><Volume2 aria-hidden="true" /> Listen</button>}
  </div>;
}
