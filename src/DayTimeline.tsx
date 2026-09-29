import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  Entry,
  Data,
  currentSlot,
  dateKey,
  entriesInSlot,
  timeLabel,
} from "./model";
import { ActivityIcon } from "./ActivityIcon";
export function DayTimeline({
  date,
  data,
  onAdd,
  onEdit,
}: {
  date: string;
  data: Data;
  onAdd: (minute: number) => void;
  onEdit: (entry: Entry) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const area = useRef<HTMLDivElement>(null);
  const activeSlot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (area.current)
      area.current.scrollTop = activeSlot.current
        ? activeSlot.current.offsetTop - 40
        : 0;
  }, [date]);
  return (
    <div
      className="day-timeline"
      ref={area}
      tabIndex={0}
      role="region"
      aria-label="Day timeline"
    >
      {Array.from({ length: 48 }, (_, i) => i * 30).map((minute) => {
        const entries = entriesInSlot(data, date, minute);
        const current = date === dateKey(now) && minute === currentSlot(now);
        return (
          <div
            className="timeline-slot"
            key={minute}
            ref={current ? activeSlot : undefined}
          >
            <div
              className={`timeline-hour${entries.length ? " has-activity" : ""}`}
            >
              <div className="timeline-slot-heading">
                <time>{timeLabel(minute)}</time>
                <button
                  aria-label={`Add activity at ${timeLabel(minute)}`}
                  onClick={() => onAdd(minute)}
                >
                  <Plus size={26} />
                </button>
              </div>
              {entries.map((entry) => (
                <button
                  className="timeline-entry"
                  key={entry.id}
                  aria-label={`Edit ${entry.name} at ${timeLabel(minute)}`}
                  onClick={() => onEdit(entry)}
                >
                  <ActivityIcon id={entry.icon} />
                  <span>
                    <strong>{entry.name}</strong>
                    <span>
                      {entry.status === "planned" ? "Planned" : "Completed"}
                    </span>
                    {entry.mood !== undefined && (
                      <span>Mood: {entry.mood} / 10</span>
                    )}
                    {entry.rating !== undefined && (
                      <span>Enjoyment: {entry.rating} / 10</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            {current && (
              <div
                className="current-time-line"
                role="img"
                aria-label={`Current time: ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                style={{
                  top: `${(((now.getMinutes() % 30) + now.getSeconds() / 60) / 30) * 100}%`,
                }}
              >
                <span className="current-time-dot" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
