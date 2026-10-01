import { useState } from "react";
import { Check } from "lucide-react";
import { RatingSlider } from "./RatingSlider";
export function DailyMood({
  value,
  onSave,
}: {
  value?: number;
  onSave: (value: number) => void;
}) {
  const [rating, setRating] = useState(value ?? 5);
  return (
    <>
      <RatingSlider label="Mood" value={rating} onChange={setRating} />
      <button className="primary" onClick={() => onSave(rating)}>
        <Check />
        Save mood
      </button>
    </>
  );
}
