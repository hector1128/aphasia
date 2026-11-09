import { entryEnd, timeLabel } from "../../domain/model";
import { TimeSelect } from "../../shared/ui/TimeSelect";

export function DurationPicker({ startMinute, value, onChange }: { startMinute: number; value?: number; onChange: (minutes: number) => void }) {
  const endMinute = entryEnd({ startMinute, durationMinutes: value });
  return <div className="duration-picker">
    <p className="duration-time-range" aria-live="polite">{timeLabel(startMinute)} – {timeLabel(endMinute)}</p>
    {startMinute + 30 <= 1440 && <TimeSelect label="End time" value={endMinute} min={startMinute + 30} max={1440}
      onChange={(end) => onChange(end - startMinute)} />}
  </div>;
}
