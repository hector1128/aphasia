import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const steps = [
  { target: "current", title: "Your day", text: "See what you are doing now. Use the arrows to look at another time." },
  { target: "add", title: "Add an activity", text: "Choose an activity and rate how you felt. You can also schedule an activity for later." },
  { target: "log", title: "Your activity log", text: "See your activities by day. Choose a day to see what you did or planned." },
  { target: "mindfulness", title: "Take a pause", text: "Try breathing, imagine a calm place, or do gentle stretches." },
  { target: "mood", title: "How was your day?", text: "Choose a face and number to record how you feel today." },
  { target: "values", title: "What matters to you?", text: "Add your personal values. Link activities to them or schedule something meaningful." },
  { target: "settings", title: "Make it yours", text: "Change your settings, set up face sign-in, or turn on read aloud. You can start this tutorial again here." },
];

export function GuidedTour({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, height: 0, cardTop: 16, cardLeft: 16 });
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const current = steps[step];

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "instant" });
    next.current?.focus({ preventScroll: true });
    const measure = () => {
      let bounds = target.getBoundingClientRect();
      const cardHeight = card.current?.offsetHeight ?? 300;
      const cardWidth = card.current?.offsetWidth ?? 360;
      if (bounds.bottom + cardHeight + 28 > window.innerHeight && bounds.top - cardHeight - 16 < 16) {
        target.scrollIntoView({ block: "start", behavior: "instant" });
        bounds = target.getBoundingClientRect();
      }
      const top = Math.max(8, bounds.top - 6);
      const bottom = Math.min(window.innerHeight - 8, bounds.bottom + 6);
      const below = bottom + 16;
      const above = top - cardHeight - 16;
      setPosition({
        left: Math.max(8, bounds.left - 6), top,
        width: Math.min(bounds.width + 12, window.innerWidth - 16), height: Math.max(0, bottom - top),
        cardLeft: Math.max(16, Math.min(bounds.left, window.innerWidth - cardWidth - 16)),
        cardTop: Math.max(16, Math.min(below + cardHeight <= window.innerHeight - 16 ? below : above, window.innerHeight - cardHeight - 16)),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    if (card.current) observer.observe(card.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current]);

  return <dialog ref={dialog} className="guided-tour" aria-labelledby="tour-title" aria-describedby="tour-description"
    onCancel={(event) => { event.preventDefault(); onFinish(); }}>
    <div className="tour-spotlight" style={{ left: position.left, top: position.top, width: position.width, height: position.height }} aria-hidden="true" />
    <div ref={card} className="tour-card" style={{ left: position.cardLeft, top: position.cardTop }}>
      <div className="tour-progress"><span>Step {step + 1} of {steps.length}</span><button type="button" onClick={onFinish}>Skip tutorial</button></div>
      <div className="tour-instructions" key={step} aria-live="polite" aria-atomic="true">
        <h2 id="tour-title">{current.title}</h2>
        <p id="tour-description">{current.text}</p>
      </div>
      <div className="tour-actions">
        <button type="button" className="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={20} /> Back</button>
        <button ref={next} type="button" className="primary" onClick={() => step === steps.length - 1 ? onFinish() : setStep(step + 1)}>
          {step === steps.length - 1 ? <>Finish <Check size={20} /></> : <>Next <ArrowRight size={20} /></>}
        </button>
      </div>
    </div>
  </dialog>;
}
