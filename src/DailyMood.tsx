import { useState } from "react";
import { Frown, Smile, Check } from "lucide-react";
function Rating({
  value,
  onChange,
  faceLabels = false,
}: {
  value?: number;
  onChange: (n: number) => void;
  faceLabels?: boolean;
}) {
  return (
    <div className="rating">
      <div
        className="rating-numbers"
        role="group"
        aria-label="Enjoyment rating"
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            className={value === n ? "selected" : ""}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className={faceLabels ? "rating-ends face-labels" : "rating-ends"}>
        {faceLabels ? (
          <>
            <span className="rating-face" role="img" aria-label="1 equals sad">
              <span aria-hidden="true">1 =</span>
              <span className="day-icon" aria-hidden="true">
                <Frown size={30} />
              </span>
            </span>
            <span
              className="rating-face"
              role="img"
              aria-label="10 equals happy"
            >
              <span aria-hidden="true">10 =</span>
              <span className="day-icon" aria-hidden="true">
                <Smile size={30} />
              </span>
            </span>
          </>
        ) : (
          <>
            <span>1 · Not enjoyable</span>
            <span>10 · Very enjoyable</span>
          </>
        )}
      </div>
    </div>
  );
}

// Daily mood is retained for later use. Its frontend entry points are commented out.
export function DailyMood({
  value,
  onSave,
}: {
  value?: number;
  onSave: (value: number) => void;
}) {
  const [rating, setRating] = useState(value);
  return (
    <>
      <h1>How was your day?</h1>
      <Rating value={rating} onChange={setRating} />
      <button
        className="primary"
        disabled={!rating}
        onClick={() => rating && onSave(rating)}
      >
        <Check /> Save day rating
      </button>
    </>
  );
}
