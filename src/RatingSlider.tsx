import { Minus, Plus } from "lucide-react";

export function RatingFace({
  value,
  kind = "Mood",
}: {
  value: number;
  kind?: string;
}) {
  const curve = 40 + value * 4.7;
  return (
    <svg
      viewBox="0 0 100 100"
      className="rating-expression"
      role="img"
      aria-label={`${kind}: ${value <= 2 ? "Very sad" : value >= 8 ? "Very happy" : value < 5 ? "Sad" : "Neutral to happy"} face`}
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
      {kind === "Enjoyment" ? (
        <>
          <path
            d="M33 41 Q38 35 43 41 M57 41 Q62 35 67 41"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="28" cy="55" r="4" fill="currentColor" opacity=".25" />
          <circle cx="72" cy="55" r="4" fill="currentColor" opacity=".25" />
        </>
      ) : (
        <>
          <circle cx="38" cy="40" r="3" fill="currentColor" />
          <circle cx="62" cy="40" r="3" fill="currentColor" />
          <path
            d={
              value < 4
                ? "M31 30 L43 26 M57 26 L69 30"
                : "M31 28 Q38 24 44 28 M56 28 Q62 24 69 28"
            }
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
          />
          {value < 3 && (
            <path d="M29 47 Q20 60 29 62 Q38 60 29 47" fill="#3a7fa8" />
          )}
        </>
      )}
      <path
        d={`M 34 64 Q 50 ${curve} 66 64`}
        fill={value >= 8 ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function ImportanceStar({ value }: { value: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="rating-expression"
      role="img"
      aria-label={`Importance ${value} out of 10`}
    >
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx="22"
        fill="var(--section-soft)"
      />
      <path
        d="M50 15 L60 38 L86 40 L66 58 L72 84 L50 70 L28 84 L34 58 L14 40 L40 38 Z"
        fill="currentColor"
        fillOpacity={value / 10}
        stroke="currentColor"
        strokeWidth="3"
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
  const symbol = (n: number) =>
    label === "Importance" ? (
      <ImportanceStar value={n} />
    ) : (
      <RatingFace value={n} kind={label} />
    );
  return (
    <div className="rating-slider">
      <div className="slider-ticks" aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
      <input
        type="range"
        min="0"
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
