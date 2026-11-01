import { timeLabel } from "../../domain/model";

export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return [hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "", rest ? `${rest} minutes` : ""].filter(Boolean).join(" ");
}
export function DurationPicker({ startMinute, value, onChange }: { startMinute: number; value: number; onChange: (minutes: number) => void }) {
  return <div className="duration-picker">
    <p className="duration-time-range" aria-live="polite">{timeLabel(startMinute)} – {timeLabel(startMinute + value)}</p>
    <div className="duration-adjust"><button type="button" className="block-arrow" aria-label="30 minutes shorter" disabled={value <= 30} onClick={() => onChange(value - 30)}>−</button>
      <strong aria-live="polite">{durationLabel(value)}</strong>
      <button type="button" className="block-arrow" aria-label="30 minutes longer" disabled={startMinute + value + 30 > 1440} onClick={() => onChange(value + 30)}>+</button></div>
  </div>;
}
