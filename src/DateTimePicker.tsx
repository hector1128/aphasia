import { useEffect, useRef, useState } from "react";
import { SpeechField, Microphone } from "./SpeechField";
import { parseSpokenTime, spokenNumber } from "./speech";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dateKey } from "./model";
import { weekDates, shiftWeek, to24Hour } from "./date-time";

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

function TimeWheel({ label, options, value, onChange }: {
  label: string; options: string[]; value: number; onChange: (index: number) => void;
}) {
  const wheel = useRef<HTMLDivElement>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const element = wheel.current;
    if (!element) return;
    const align = () => {
      if (element.clientHeight && Math.abs(element.scrollTop - value * 48) > 1)
        element.scrollTo({ top: value * 48 });
    };
    align();
    // The wheels may first mount hidden beside desktop fields, then become visible.
    const resize = new ResizeObserver(align);
    resize.observe(element);
    return () => resize.disconnect();
  }, [value]);
  useEffect(() => () => clearTimeout(pending.current), []);
  return <div className="time-wheel" ref={wheel} role="listbox" aria-label={label}
    tabIndex={0} aria-activedescendant={`wheel-${label}-${value}`}
    onKeyDown={(event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      onChange(Math.max(0, Math.min(options.length - 1, value + (event.key === "ArrowDown" ? 1 : -1))));
    }}
    onScroll={() => {
      clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        if (wheel.current) change.current(Math.max(0, Math.min(options.length - 1, Math.round(wheel.current.scrollTop / 48))));
      }, 140);
    }}>
    {options.map((option, index) => <button type="button" role="option" tabIndex={-1}
      id={`wheel-${label}-${index}`} aria-selected={value === index} className={value === index ? "selected" : ""}
      key={option} onClick={() => onChange(index)}>{option}</button>)}
  </div>;
}
export function TimePicker({ value, onChange, onValidityChange }: {
  value: number; onChange: (value: number) => void; onValidityChange?: (valid: boolean) => void;
}) {
  const hour24 = Math.floor(value / 60);
  const hour = hour24 % 12 || 12;
  const minute = value % 60;
  const period = hour24 < 12 ? "AM" : "PM";
  const [hourText, setHourText] = useState(String(hour));
  const [minuteText, setMinuteText] = useState(String(minute).padStart(2, "0"));
  const [typing, setTyping] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  useEffect(() => { onValidityChange?.(true); }, [onValidityChange]);
  const enter = (h: string, m: string) => {
    setHourText(h); setMinuteText(m);
    const valid = /^\d{1,2}$/.test(h) && /^\d{1,2}$/.test(m) && +h >= 1 && +h <= 12 && +m <= 59;
    onValidityChange?.(valid);
    if (valid) onChange(to24Hour(+h, period) * 60 + +m);
  };
  const fromSpeech = (value: string) => String(spokenNumber(value) ?? value);
  const select = (h: number, m: number, p: "AM" | "PM" = period) => {
    setHourText(String(h)); setMinuteText(String(m).padStart(2, "0"));
    onValidityChange?.(true);
    onChange(to24Hour(h, p) * 60 + m);
  };
  return <div className={`precise-time-picker ${typing ? "is-typing" : ""}`}>
    <div className={`typed-time ${typing ? "show" : ""}`} role="group" aria-label="Time">
      <label>Hour<SpeechField aria-label="Hour" inputMode="numeric" value={hourText} maxLength={2}
        onValueChange={(text) => enter(fromSpeech(text), minuteText)} /></label>
      <label>Minute<SpeechField aria-label="Minute" inputMode="numeric" value={minuteText} maxLength={2}
        onValueChange={(text) => enter(hourText, fromSpeech(text))} /></label>
      <div className="period-blocks" role="group" aria-label="AM or PM">
        {(["AM", "PM"] as const).map((option) => <button type="button" key={option}
          className={period === option ? "active" : ""} aria-pressed={period === option}
          onClick={() => select(hour, minute, option)}>{option}</button>)}
      </div>
    </div>
    <div className="mobile-time-wheels" role="group" aria-label="Scroll to choose time">
      <TimeWheel label="Hour" options={Array.from({ length: 12 }, (_, i) => String(i + 1))}
        value={hour - 1} onChange={(index) => select(index + 1, minute)} />
      <TimeWheel label="Minute" options={Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))}
        value={minute} onChange={(index) => select(hour, index)} />
      <TimeWheel label="Period" options={["AM", "PM"]} value={period === "AM" ? 0 : 1}
        onChange={(index) => select(hour, minute, index === 0 ? "AM" : "PM")} />
    </div>
    <button type="button" className="secondary time-input-switch" onClick={() => { setTyping(!typing); onValidityChange?.(true); setHourText(String(hour)); setMinuteText(String(minute).padStart(2, "0")); }}>{typing ? "Scroll to choose time" : "Type a time instead"}</button>
    <div className="time-dictation"><span>Say a time</span><Microphone label="time" onResult={(text) => {
      const result = parseSpokenTime(text);
      if (result === undefined) setVoiceMessage('Try “four thirty-nine PM”. Include AM or PM.');
      else { select(Math.floor(result / 60) % 12 || 12, result % 60, result < 720 ? "AM" : "PM"); setVoiceMessage("Check the time before continuing."); }
    }} /></div>
    {voiceMessage && <p role="status">{voiceMessage}</p>}
  </div>;
}
