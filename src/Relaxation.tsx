import { useEffect, useState, useRef } from "react";
import { Play, Pause, RotateCcw, ExternalLink, Waves, Trees, MoonStar, Sparkles, Flame, ArrowRight } from "lucide-react";
import { SpeechField } from "./SpeechField";
import { breathingMinutes } from "./speech";

type SessionCallback = (
  id: string,
  kind: "breathing" | "visualization" | "stretching",
  status: "started" | "completed",
) => void;
export const breathingDurations = [1, 3, 5] as const;

export function BreathingDurationField({ onChoose }: { onChoose: (minutes: number) => void }) {
  const [text, setText] = useState("");
  const minutes = breathingMinutes(text);
  return <form className="custom-breathing-duration" onSubmit={(event) => {
    event.preventDefault(); if (minutes !== undefined) onChoose(minutes);
  }}>
    <label htmlFor="breathing-minutes">Or choose your own time</label>
    <div className="duration-input-row">
      <SpeechField id="breathing-minutes" aria-label="Breathing duration in minutes" inputMode="decimal" placeholder="Minutes"
        value={text} onValueChange={setText} />
      <span>minutes</span>
    </div>
    {text && minutes === undefined && <p role="alert">Enter minutes greater than 0, such as 2 or 2.5.</p>}
    <button className="primary" disabled={minutes === undefined}>Continue <ArrowRight aria-hidden="true" /></button>
  </form>;
}

export function BreathingGuide({ onSession, minutes }: { onSession: SessionCallback; minutes: number }) {
  const sessionId = useRef(crypto.randomUUID());
  const callback = useRef(onSession);
  callback.current = onSession;
  const begin = () =>
    callback.current(sessionId.current, "breathing", "started");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const duration = minutes * 60000;
  const finished = elapsed >= duration;
  const inhale = elapsed % 10000 < 5000;
  const progress = (elapsed % 5000) / 5000;
  const scale = 0.65 + 0.35 * (inhale ? progress : 1 - progress);
  useEffect(() => {
    if (!running) return;
    const start = performance.now() - elapsed;
    const timer = window.setInterval(() => {
      const next = Math.min(performance.now() - start, duration);
      setElapsed(next);
      if (next >= duration) {
        setRunning(false);
        callback.current(sessionId.current, "breathing", "completed");
      }
    }, 100);
    const pauseWhenHidden = () => {
      if (document.hidden) setRunning(false);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [running, duration]);
  return (
    <div className="breathing-guide">
      <p className="breathing-instruction">Breathe gently. Do not force it.</p>
      <div
        className={`breathing-art ${running ? "running" : ""}`}
        aria-hidden="true"
      >
        <div
          className="breathing-flower"
          style={{ transform: `scale(${scale})` }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              style={{ transform: `rotate(${i * 60}deg) translateY(-32px)` }}
            />
          ))}
        </div>
      </div>
      <h2 className="breathing-cue" aria-live="polite">
        {finished
          ? "Finished"
          : running
            ? inhale
              ? "Breathe in"
              : "Breathe out"
            : elapsed
              ? "Paused"
              : "Ready"}
      </h2>
      <p className="center">{Math.ceil((duration - elapsed) / 1000)} seconds left</p>
      {finished ? (
        <button
          className="primary"
          onClick={() => {
            sessionId.current = crypto.randomUUID();
            begin();
            setElapsed(0);
            setRunning(true);
          }}
        >
          <RotateCcw /> Again
        </button>
      ) : (
        <button
          className="primary"
          onClick={() => {
            if (!running && elapsed === 0) begin();
            setRunning(!running);
          }}
        >
          {running ? <Pause /> : <Play />}
          {running ? "Pause" : elapsed ? "Continue" : "Start"}
        </button>
      )}
      {elapsed > 0 && !finished && (
        <button
          className="secondary"
          onClick={() => {
            setRunning(false);
            sessionId.current = crypto.randomUUID();
            setElapsed(0);
          }}
        >
          Start again
        </button>
      )}
      <p className="center">Stop if uncomfortable.</p>
    </div>
  );
}

function BalloonIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="18" cy="12" rx="8" ry="10" />
      <path d="m16 22 2 3 2-3M18 25c-4 4 4 5 0 9" />
    </svg>
  );
}

export const visualizationThemes = [
  {
    id: "beach",
    label: "Ocean shore",
    title: "Ocean Shore | Beach Scene",
    description: "Imagine a quiet beach. Watch the waves roll in and out. Feel the warm sand beneath your feet.",
    icon: Waves,
  },
  {
    id: "forest",
    label: "Lush forest",
    title: "Lush Forest | Woodland Stroll",
    description: "Picture a gentle path through tall trees. Notice the leaves, the shade, and the fresh air.",
    icon: Trees,
  },
  {
    id: "lake",
    label: "Moonlit lake",
    title: "Boundless Lake | Moonlit Water",
    description: "Picture a still lake at night. Notice the moonlight resting on the water.",
    icon: MoonStar,
  },
  {
    id: "light",
    label: "White light",
    title: "Healing | White Light Bath",
    description: "Imagine a soft white light around you. Let it move gently from your head to your feet.",
    icon: Sparkles,
  },
  {
    id: "balloon",
    label: "Balloon release",
    title: "Floating Balloon Release",
    description: "Picture a balloon in your hands. When you are ready, imagine it floating slowly into the sky.",
    icon: BalloonIcon,
  },
  {
    id: "candle",
    label: "Candle flame",
    title: "Candle Flame Focus",
    description: "Picture a small candle flame. Watch its gentle movement while you breathe at your own pace.",
    icon: Flame,
  },
] as const;
export type VisualizationTheme = (typeof visualizationThemes)[number];

export function VisualizationChoices({ onChoose }: { onChoose: (theme: VisualizationTheme) => void }) {
  return (
    <div className="visualization-grid">
      {visualizationThemes.map((theme) => {
        const Icon = theme.icon;
        return (
          <button className="visualization-card" key={theme.id} onClick={() => onChoose(theme)} aria-label={theme.title}>
            <span className="visualization-icon"><Icon size={38} /></span>
            <strong>{theme.label}</strong>
          </button>
        );
      })}
    </div>
  );
}

export function VisualizationGuide({ theme, onSession }: { theme: VisualizationTheme; onSession: SessionCallback }) {
  const [completed, setCompleted] = useState(false);
  const [audioMissing, setAudioMissing] = useState(false);
  const sessionId = useRef(crypto.randomUUID());
  const Icon = theme.icon;
  return (
    <div className="visualization-guide">
      <span className="visualization-scene"><Icon size={92} /></span>
      <p>{theme.description}</p>
      {/* Drop the matching MP3 in public/audio/visualization/; filenames are documented there. */}
      {!audioMissing ? <audio controls preload="metadata" aria-label={`${theme.label} guided audio`}
        src={`/audio/visualization/${theme.id}.mp3`} onError={() => setAudioMissing(true)}
        onPlay={() => { if (!completed) onSession(sessionId.current, "visualization", "started"); }}
        onEnded={() => { onSession(sessionId.current, "visualization", "completed"); setCompleted(true); }} />
        : <p className="audio-placeholder">Audio coming soon.</p>}
      <p>Take your time. Stop if uncomfortable.</p>
      <button className="primary" disabled={completed} onClick={() => {
        onSession(sessionId.current, "visualization", "completed");
        setCompleted(true);
      }}>
        {completed ? "Activity recorded" : "I did this activity"}
      </button>
    </div>
  );
}
const stretchingVideo = {
  id: "48jIXvwXmeQ",
  title: "Gentle stretching",
  provider: "Eleni Fit",
};
export function RelaxationVideo({
  onSession,
}: {
  onSession: SessionCallback;
}) {
  const video = stretchingVideo;
  const [loaded, setLoaded] = useState(false);
  const [completed, setCompleted] = useState(false);
  const sessionId = useRef(crypto.randomUUID());
  return (
    <div className="relaxation-video">
      <p>
        Move gently. Only do movements your therapist has approved.
      </p>
      {loaded ? (
        <iframe
          className="youtube-player"
          title={`${video.title} — ${video.provider}`}
          src={`https://www.youtube-nocookie.com/embed/${video.id}?cc_load_policy=1&cc_lang_pref=en&playsinline=1&rel=0`}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button className="video-launch" onClick={() => setLoaded(true)}>
          <Play size={44} />
          <span>Load video</span>
        </button>
      )}
      <a
        className="secondary video-link"
        href={`https://www.youtube.com/watch?v=${video.id}`}
        target="_blank"
        rel="noreferrer"
      >
        Open on YouTube <ExternalLink size={24} />
      </a>
      <button
        className="primary"
        disabled={completed}
        onClick={() => {
          onSession(sessionId.current, "stretching", "completed");
          setCompleted(true);
        }}
      >
        {completed ? "Activity recorded" : "I did this activity"}
      </button>
      <p className="video-provider">{video.provider}</p>
      <p>Pause whenever you need. Stop if uncomfortable.</p>
    </div>
  );
}
