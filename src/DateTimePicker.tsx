import { useEffect, useId, useRef, useState } from "react";
import { Microphone } from "./SpeechField";
import { parseSpokenTime } from "./speech";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { dateKey, timeLabel } from "./model";
import { weekDates, shiftWeek } from "./date-time";

const dayNames = ["M", "T", "W", "Th", "F", "Sa", "Su"];

export function WeekPicker({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const days = weekDates(value);
  const moveWeek = (direction: number) => {
    const next = shiftWeek(value, direction);
    onChange(min && next < min ? min : max && next > max ? max : next);
  };
  const first = days[0];
  const last = days[6];
  const monthLabel =
    first.getMonth() === last.getMonth()
      ? first.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `${first.toLocaleDateString("en-US", { month: "short", ...(first.getFullYear() !== last.getFullYear() ? { year: "numeric" } : {}) })} – ${last.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

  return (
    <div className="calendar-picker">
      <div className="week-heading">
        <button
          type="button"
          className="block-arrow"
          aria-label="Previous week"
          disabled={!!min && dateKey(first) <= min}
          onClick={() => moveWeek(-1)}
        >
          <ChevronLeft />
        </button>
        <strong aria-live="polite">{monthLabel}</strong>
        <button
          type="button"
          className="block-arrow"
          aria-label="Next week"
          disabled={!!max && dateKey(last) >= max}
          onClick={() => moveWeek(1)}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="week-selector" role="group" aria-label="Day">
        {days.map((day, index) => {
          const date = dateKey(day);
          return (
            <button
              type="button"
              key={date}
              aria-label={day.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              aria-pressed={value === date}
              disabled={!!((min && date < min) || (max && date > max))}
              className={value === date ? "active" : ""}
              onClick={() => onChange(date)}
            >
              <span>{dayNames[index]}</span>
              <strong>{day.getDate()}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimeSelect({ label, value, onChange, min = 0, max = 1410, disabled = false }: {
  label: string; value: number; onChange: (minute: number) => void; min?: number; max?: number; disabled?: boolean;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 150 });
  const options = Array.from({ length: Math.max(0, Math.floor((max - min) / 30) + 1) }, (_, i) => min + i * 30);
  const optionLabel = (minute: number) => `${timeLabel(minute)}${minute === 1440 ? " (midnight)" : ""}`;
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (!(event.target instanceof Node) || !panel.current?.contains(event.target)) panel.current?.hidePopover(); };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    const selected = panel.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    selected?.scrollIntoView({ block: "nearest" });
    selected?.focus({ preventScroll: true });
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [open]);
  const show = () => {
    if (!button.current) return;
    const rect = button.current.getBoundingClientRect();
    const height = Math.min(260, options.length * 48 + 16);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.max(150, rect.width) - 12)),
      top: rect.bottom + height + 12 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - height - 8), width: Math.max(150, rect.width) });
    panel.current?.togglePopover();
  };
  return <div className="time-select">
    <span id={`${id}-label`} className="time-select-label">{label}</span>
    <button type="button" ref={button} className="time-select-trigger" aria-labelledby={`${id}-label ${id}-value`}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={show}
      onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!open) show(); } }}>
      <span id={`${id}-value`}>{timeLabel(value)}</span><ChevronDown size={20} aria-hidden="true" />
    </button>
    <div id={id} popover="auto" ref={panel} role="listbox" aria-labelledby={`${id}-label`} className="time-select-options"
      style={position} onToggle={(event) => setOpen(event.newState === "open")}
      onKeyDown={(event) => {
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
        const index = buttons.findIndex((item) => item === document.activeElement);
        let next: number;
        if (event.key === "ArrowDown") next = Math.min(buttons.length - 1, index + 1);
        else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else if (event.key === "Tab") { panel.current?.hidePopover(); return; }
        else if (event.key === "Escape") { panel.current?.hidePopover(); button.current?.focus(); return; }
        else return;
        event.preventDefault(); buttons[next]?.focus();
      }}>
      {options.map((minute) => <button type="button" role="option" key={minute} aria-selected={minute === value}
        tabIndex={minute === value ? 0 : -1} onClick={() => { onChange(minute); panel.current?.hidePopover(); button.current?.focus(); }}>{optionLabel(minute)}</button>)}
    </div>
  </div>;
}

export function TimePicker({ value, onChange, showEnd = true }: {
  showEnd?: boolean;
  value: { startMinute: number; durationMinutes: number };
  onChange: (value: { startMinute: number; durationMinutes: number }) => void;
}) {
  const [message, setMessage] = useState("");
  const changeStart = (startMinute: number) => onChange({ startMinute, durationMinutes: Math.min(value.durationMinutes, 1440 - startMinute) });
  return <div className="activity-time-range">
    <div className={`time-range-fields ${showEnd ? "" : "start-only"}`}>
      <TimeSelect label="Start time" value={value.startMinute} onChange={changeStart} />
      {showEnd && <span className="time-range-separator" aria-hidden="true">–</span>}
      {showEnd && <TimeSelect label="End time" value={value.startMinute + value.durationMinutes} min={value.startMinute + 30} max={1440}
        onChange={(endMinute) => onChange({ ...value, durationMinutes: endMinute - value.startMinute })} />}
    </div>
    {showEnd ? <p>{value.durationMinutes / 30} half-hour {value.durationMinutes === 30 ? "block" : "blocks"} · {durationLabel(value.durationMinutes)}</p> : <p>You’ll choose the duration after the ratings.</p>}
    <div className="dictate-time"><Microphone label="start time" alternative="choose a time from the list" onResult={(text) => {
      const minute = parseSpokenTime(text);
      if (minute === undefined) setMessage('Try “four thirty PM”. Include AM or PM.');
      else { changeStart(Math.min(1410, Math.round(minute / 30) * 30)); setMessage("Time set to the nearest half hour."); }
    }} /><span>Or say the start time.</span></div>
    {message && <p role="status">{message}</p>}
  </div>;
}
export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return [hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "", rest ? `${rest} minutes` : ""].filter(Boolean).join(" ");
}
export function DurationPicker({ startMinute, value, onChange }: { startMinute: number; value: number; onChange: (minutes: number) => void }) {
  return <div className="duration-picker"><p>Choose how long the activity lasted, in 30-minute blocks.</p>
    <div className="duration-adjust"><button type="button" className="block-arrow" aria-label="30 minutes shorter" disabled={value <= 30} onClick={() => onChange(value - 30)}>−</button>
      <strong aria-live="polite">{durationLabel(value)}</strong>
      <button type="button" className="block-arrow" aria-label="30 minutes longer" disabled={startMinute + value + 30 > 1440} onClick={() => onChange(value + 30)}>+</button></div>
    <div className="duration-presets">{[30, 60, 90, 120].filter((duration) => startMinute + duration <= 1440).map((duration) =>
      <button type="button" key={duration} aria-pressed={value === duration} className={value === duration ? "active" : ""} onClick={() => onChange(duration)}>{durationLabel(duration)}</button>)}</div>
    <p>{timeLabel(startMinute)} – {timeLabel(startMinute + value)}</p>
  </div>;
}
