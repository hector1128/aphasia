import { Info, Minus, Plus } from "lucide-react";
import { useId, useRef, useState, useLayoutEffect } from "react";

export type RatingKind = "Mood" | "Enjoyment" | "Importance";

const scales = {
  Mood: {
    description: "Mood means how you feel. Choose a number from 0 (very bad) to 10 (very good). A 5 is neutral: neither bad nor good.",
    anchors: ["Very bad", "Neutral", "Very good"],
  },
  Enjoyment: {
    description: "Enjoyment means how much you liked the activity. Choose 0 if you did not enjoy it at all, 5 if you enjoyed it somewhat, or 10 if you enjoyed it very much.",
    anchors: ["Not at all", "Somewhat", "Very much"],
  },
  Importance: {
    description: "Importance means how much the activity matters to you. Choose 0 if it is not important, 5 if it is somewhat important, or 10 if it is very important.",
    anchors: ["Not important", "Somewhat important", "Very important"],
  },
} satisfies Record<RatingKind, { description: string; anchors: [string, string, string] }>;

export function ScaleInfo({ kind }: { kind: RatingKind }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!button.current || !panel.current) return;
      const anchor = button.current.getBoundingClientRect();
      const popup = panel.current.getBoundingClientRect();
      const left = Math.max(16, Math.min(anchor.left, window.innerWidth - popup.width - 16));
      const below = anchor.bottom + 12;
      const top = below + popup.height <= window.innerHeight - 16
        ? below : Math.max(16, anchor.top - popup.height - 12);
      panel.current.style.left = `${left}px`;
      panel.current.style.top = `${top}px`;
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  return <>
    <button ref={button} type="button" className="scale-info-button" popoverTarget={id} aria-label={`About the ${kind.toLowerCase()} scale`}>
      <Info size={24} aria-hidden="true" />
    </button>
    <div ref={panel} id={id} popover="auto" className="scale-info-panel" role="dialog" aria-labelledby={`${id}-title`}
      onToggle={(event) => setOpen(event.newState === "open")}>
      <h2 id={`${id}-title`}>{kind}</h2>
      <p>{scales[kind].description}</p>
      <button type="button" className="secondary" popoverTarget={id} popoverTargetAction="hide">Close</button>
    </div>
  </>;
}

function RatingPicture({ value, kind }: { value: number; kind: RatingKind }) {
  const score = Math.max(0, Math.min(10, Math.round(value)));
  return <img className="rating-expression" src={`/ratings/${kind.toLowerCase()}/${score}.png`}
    alt={`${kind} ${score} out of 10`} />;
}

export function RatingSlider({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: RatingKind;
}) {
  const anchorsId = useId();
  const anchors = scales[label].anchors;
  const symbol = (n: number) => <RatingPicture value={n} kind={label} />;
  return (
    <div className="rating-slider">
      <div className="slider-anchors" id={anchorsId}>
        {anchors.map((anchor, index) => <span key={anchor}><span className="sr-only">{index * 5}: </span>{anchor}</span>)}
      </div>
      <div className="slider-ticks" aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} className={i % 5 === 0 ? "anchor-tick" : undefined}>{symbol(i)}{i}</span>
        ))}
      </div>
      <input
        type="range"
        min="0"
        max="10"
        step="1"
        value={value}
        aria-label={label}
        aria-describedby={anchorsId}
        aria-valuetext={`${value} out of 10`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="slider-adjust">
        <button
          className="block-arrow"
          aria-label={`Lower ${label.toLowerCase()}`}
          disabled={value === 0}
          onClick={() => onChange(value - 1)}
        >
          <Minus />
        </button>
        <output aria-live="polite">{value} / 10</output>
        <button
          className="block-arrow"
          aria-label={`Raise ${label.toLowerCase()}`}
          disabled={value === 10}
          onClick={() => onChange(value + 1)}
        >
          <Plus />
        </button>
      </div>
      {symbol(value)}
      <div className="rating-end-faces">
        <span>0 = {symbol(0)}</span>
        <span>10 = {symbol(10)}</span>
      </div>
    </div>
  );
}
