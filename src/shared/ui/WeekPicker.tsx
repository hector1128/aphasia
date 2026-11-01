import { ChevronLeft, ChevronRight } from "lucide-react";
import { dateKey } from "../../domain/model";
import { weekDates, shiftWeek } from "../../domain/date-time";

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
