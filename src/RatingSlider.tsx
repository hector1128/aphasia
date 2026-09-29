import { Minus, Plus } from "lucide-react";

export function RatingFace({ value }: { value: number }) {
  // One continuous curve changes from a frown through neutral to a smile.
  const curve = 49 + ((value - 1) / 9) * 34;
  return (
    <svg
      viewBox="0 0 100 100"
      className="rating-expression"
      role="img"
      aria-label={
        value <= 3
          ? "Sad face"
          : value >= 8
            ? "Happy face"
            : value >= 6
              ? "Slightly happy face"
              : "Neutral face"
      }
    >
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx="22"
        fill="var(--section-soft)"
      />
      <circle
        cx="50"
        cy="50"
        r="33"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <circle cx="38" cy="40" r="3" fill="currentColor" />
      <circle cx="62" cy="40" r="3" fill="currentColor" />
      <path
        d={`M 34 64 Q 50 ${curve} 66 64`}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function RatingSlider({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="rating-slider">
      <div className="slider-ticks" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        value={value}
        aria-label={label}
        aria-valuetext={`${value} out of 10`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="slider-adjust">
        <button
          className="block-arrow"
          aria-label={`Lower ${label.toLowerCase()}`}
          disabled={value === 1}
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
      <RatingFace value={value} />
      <div className="rating-end-faces">
        <span>
          1 = <RatingFace value={1} />
        </span>
        <span>
          10 = <RatingFace value={10} />
        </span>
      </div>
    </div>
  );
}
