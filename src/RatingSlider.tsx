import { Minus, Plus } from "lucide-react";
import { useId } from "react";

type RatingKind = "Mood" | "Enjoyment" | "Importance";

function RatingPicture({ value, kind }: { value: number; kind: RatingKind }) {
  const clipId = useId();
  const score = Math.max(0, Math.min(10, Math.round(value)));
  if (kind === "Mood") {
    return (
      <img
        className="rating-expression"
        src={`/ratings/mood/${score}.png`}
        alt={`Mood ${score} out of 10`}
      />
    );
  }

  // The supplied sheets have six pictures on top and five below. The SVG
  // viewport crops one picture without changing or duplicating the source art.
  const top = score < 6;
  const sheetWidth = kind === "Enjoyment" ? 1491 : 1448;
  const sheetHeight = kind === "Enjoyment" ? 1055 : 1086;
  const crop = (() => {
    if (kind === "Importance") {
      const topX = [35, 270, 502, 735, 960, 1195];
      const topWidths = [216, 210, 207, 210, 220, 220];
      const bottomX = [35, 290, 543, 817, 1106];
      const bottomWidths = [238, 240, 255, 273, 309];
      return top
        ? { x: topX[score], y: 95, width: topWidths[score], height: 350 }
        : { x: bottomX[score - 6], y: 559, width: bottomWidths[score - 6], height: 380 };
    }
    const cellWidth = sheetWidth / (top ? 6 : 5);
    const inset = 12;
    return {
      x: (top ? score : score - 6) * cellWidth + inset,
      y: top ? 100 : 548,
      width: cellWidth - inset * 2,
      height: top ? 300 : 320,
    };
  })();

  return (
    <svg
      className="rating-expression rating-sheet-picture"
      viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
      role="img"
      aria-label={`${kind} ${score} out of 10`}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x={crop.x} y={crop.y} width={crop.width} height={crop.height} />
        </clipPath>
      </defs>
      <image
        href={`/ratings/${kind.toLowerCase()}.png`}
        width={sheetWidth}
        height={sheetHeight}
        clipPath={`url(#${clipId})`}
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
  label: RatingKind;
}) {
  const symbol = (n: number) => <RatingPicture value={n} kind={label} />;
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
