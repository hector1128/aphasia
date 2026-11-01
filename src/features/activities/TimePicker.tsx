import { useState } from "react";
import { Microphone } from "../../shared/ui/SpeechField";
import { TimeSelect } from "../../shared/ui/TimeSelect";
import { parseSpokenHalfHour } from "../../shared/accessibility/speech";
import { timeLabel } from "../../domain/model";

type TimeRange = { startMinute: number; durationMinutes: number };

function SpokenTimeField({ label, value, onChange, min = 0, max = 1410 }: {
  label: string; value: number; onChange: (minute: number) => void; min?: number; max?: number;
}) {
  const [message, setMessage] = useState("");
  return <div className="spoken-time-field">
    <div className="time-field-controls">
      <TimeSelect label={label} value={value} min={min} max={max} onChange={(minute) => { onChange(minute); setMessage(""); }} />
      <Microphone label={label.toLowerCase()} alternative="choose a time from the list" onResult={(text) => {
        const minute = parseSpokenHalfHour(text, min, max);
        if (minute === undefined) setMessage(`Say a time between ${timeLabel(min)} and ${timeLabel(max)}, including AM or PM.`);
        else { onChange(minute); setMessage(`${label} set to ${timeLabel(minute)}.`); }
      }} />
    </div>
    {message && <p className="time-voice-status" role="status">{message}</p>}
  </div>;
}

export function TimePicker({ value, onChange }: { value: TimeRange; onChange: (value: TimeRange) => void }) {
  return <div className="time-range-fields">
    <SpokenTimeField label="Start time" value={value.startMinute}
      onChange={(startMinute) => onChange({ startMinute, durationMinutes: Math.min(value.durationMinutes, 1440 - startMinute) })} />
    <span className="time-range-separator" aria-hidden="true">–</span>
    <SpokenTimeField label="End time" value={value.startMinute + value.durationMinutes} min={value.startMinute + 30} max={1440}
      onChange={(endMinute) => onChange({ ...value, durationMinutes: endMinute - value.startMinute })} />
  </div>;
}
