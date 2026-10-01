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

export function TimePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const hour24 = Math.floor(value / 60);
  const hour = hour24 % 12 || 12;
  const minute = value % 60;
  const period = hour24 < 12 ? "AM" : "PM";
  return (
    <div className="time-picker-wrapper">
      <div className="time-picker" role="group" aria-label="Time">
        <div className="hour-blocks">
          <button
            type="button"
            className="block-arrow"
            aria-label="Previous hour"
            onClick={() =>
              onChange(
                to24Hour(hour === 1 ? 12 : hour - 1, period) * 60 + minute,
              )
            }
          >
            <ChevronLeft />
          </button>
          <output aria-label="Hour" aria-live="polite">
            {hour}
          </output>
          <button
            type="button"
            className="block-arrow"
            aria-label="Next hour"
            onClick={() =>
              onChange(
                to24Hour(hour === 12 ? 1 : hour + 1, period) * 60 + minute,
              )
            }
          >
            <ChevronRight />
          </button>
        </div>
        <div className="period-blocks" role="group" aria-label="AM or PM">
          {(["AM", "PM"] as const).map((option) => (
            <button
              type="button"
              key={option}
              aria-pressed={period === option}
              className={period === option ? "active" : ""}
              onClick={() => onChange(to24Hour(hour, option) * 60 + minute)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="minute-blocks" role="group" aria-label="Minutes">
        {[0, 30].map((option) => (
          <button
            type="button"
            key={option}
            aria-label={`${option === 0 ? "00" : "30"} minutes`}
            aria-pressed={minute === option}
            className={minute === option ? "active" : ""}
            onClick={() => onChange(hour24 * 60 + option)}
          >
            :{String(option).padStart(2, "0")}
          </button>
        ))}
      </div>
    </div>
  );
}
