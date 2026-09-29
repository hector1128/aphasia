import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, ExternalLink } from "lucide-react";

export function BreathingGuide() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const finished = elapsed >= 60000;
  const inhale = elapsed % 10000 < 5000;
  const progress = (elapsed % 5000) / 5000;
  const scale = 0.65 + 0.35 * (inhale ? progress : 1 - progress);
  useEffect(() => {
    if (!running) return;
    const start = performance.now() - elapsed;
    const timer = window.setInterval(() => {
      const next = Math.min(performance.now() - start, 60000);
      setElapsed(next);
      if (next >= 60000) setRunning(false);
    }, 100);
    const pauseWhenHidden = () => {
      if (document.hidden) setRunning(false);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [running]);
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
      <p className="center">{Math.ceil((60000 - elapsed) / 1000)} seconds</p>
      {finished ? (
        <button
          className="primary"
          onClick={() => {
            setElapsed(0);
            setRunning(true);
          }}
        >
          <RotateCcw /> Again
        </button>
      ) : (
        <button className="primary" onClick={() => setRunning(!running)}>
          {running ? <Pause /> : <Play />}
          {running ? "Pause" : elapsed ? "Continue" : "Start"}
        </button>
      )}
      {elapsed > 0 && !finished && (
        <button
          className="secondary"
          onClick={() => {
            setRunning(false);
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
export const relaxationVideos = {
  visualization: {
    id: "0TUq88f0jn4",
    title: "Visualization",
    provider: "Herefordshire & Worcestershire NHS",
    source: "https://www.youtube.com/watch?v=0TUq88f0jn4",
  },
  stretching: {
    id: "GcPujVayIbI",
    title: "Gentle stretching",
    provider: "Cambridge University Hospitals NHS",
    source:
      "https://www.cuh.nhs.uk/our-services/physiotherapy-outpatients/outpatient-physio-resources/resources/shoulder/seated-stretches/",
  },
};
export function RelaxationVideo({
  kind,
}: {
  kind: keyof typeof relaxationVideos;
}) {
  const video = relaxationVideos[kind];
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relaxation-video">
      {kind === "stretching" && (
        <p>
          Sit in a sturdy chair. Only do movements your therapist has approved.
        </p>
      )}
      {kind === "visualization" && (
        <p>Sit comfortably. Picture a calm place.</p>
      )}
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
      <p className="video-provider">{video.provider}</p>
      <p>Pause whenever you need. Stop if uncomfortable.</p>
    </div>
  );
}
