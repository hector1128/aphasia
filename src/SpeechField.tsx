import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { Mic, Square } from "lucide-react";

interface RecognitionResultEvent { results: { [index: number]: { [index: number]: { transcript: string } } } }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  }
}
export function Microphone({ label, onResult, disabled = false, alternative = "type instead" }: { label: string; onResult: (text: string) => void; disabled?: boolean; alternative?: string }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const resultCallback = useRef(onResult);
  resultCallback.current = onResult;
  useEffect(() => () => recognition.current?.abort(), []);
  const start = () => {
    if (listening) { recognition.current?.stop(); return; }
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Constructor) {
      setMessage(`Voice input is unavailable here. You can ${alternative}.`);
      return;
    }
    document.dispatchEvent(new Event("my-day-stop-speaking"));
    window.speechSynthesis?.cancel();
    const instance = new Constructor();
    recognition.current?.abort();
    recognition.current = instance;
    instance.lang = "en-US";
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      resultCallback.current(event.results[0][0].transcript.trim());
      setMessage("Check what you said before continuing.");
    };
    instance.onerror = (event) => setMessage(event.error === "not-allowed"
      ? "Allow microphone access to use voice input."
      : `Could not hear that. Try again or ${alternative}.`);
    instance.onend = () => {
      setListening(false);
      setMessage((previous) => previous === "Listening…" ? `No speech captured. Try again or ${alternative}.` : previous);
    };
    try { instance.start(); setListening(true); setMessage("Listening…"); }
    catch { setListening(false); setMessage(`Could not start the microphone. Try again or ${alternative}.`); }
  };
  return <span className="microphone-control" data-read-aloud="off">
    <button type="button" className={`microphone ${listening ? "listening" : ""}`}
      disabled={disabled} aria-label={listening ? `Stop recording ${label}` : `Dictate ${label}`} aria-pressed={listening} onClick={start}>
      {listening ? <Square size={22} /> : <Mic size={24} />}
    </button>
    {message && <span className="speech-message" role="status">{message}</span>}
  </span>;
}
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  onValueChange: (value: string) => void;
};
export function SpeechField({ onValueChange, ...props }: Props) {
  const label = props["aria-label"] ?? props.placeholder ?? props.id ?? "text";
  return <div className="speech-field">
    <input {...props} onChange={(event) => onValueChange(event.target.value)} />
    <Microphone label={label} disabled={props.disabled} onResult={(value) => onValueChange(props.type === "email"
      ? value.toLowerCase().replace(/\s+at\s+/g, "@").replace(/\s+dot\s+/g, ".").replace(/\s/g, "")
      : value)} />
  </div>;
}
