import { useEffect, useRef, useState } from "react";
import { Plus, Check, Clock, Pencil, Trash2 } from "lucide-react";
import {
  Entry,
  Data,
  currentSlot,
  dateKey,
  entriesInSlot,
  slotDate,
  timeLabel,
} from "./model";
import { ActivityIcon } from "./ActivityIcon";
export function DayTimeline({
  date,
  data,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
}: {
  date: string;
  data: Data;
  onAdd: (minute: number) => void;
  onEdit: (entry: Entry) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
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
                <div className="timeline-entry" key={entry.id}>
                  <div className="timeline-entry-info">
                    <ActivityIcon id={entry.icon} name={entry.name} />
                    <div>
                      <strong>{entry.name}</strong>
                    </div>
                  </div>
                  <div className="entry-controls">
                    {!entry.sleepId && (
                      <>
                        <button className="entry-icon-control is-delete" aria-label={`Delete ${entry.name}`} onClick={() => onDelete(entry.id)}><Trash2 /></button>
                        <button className="entry-icon-control" aria-label={`Edit ${entry.name}`} onClick={() => onEdit(entry)}><Pencil /></button>
                      </>
                    )}
                    <button
                      type="button"
                      className={`completion-toggle ${entry.status === "done" ? "is-complete" : "is-planned"}`}
                      aria-label={entry.sleepId ? "Automatic sleep entry" : `Mark ${entry.name} as ${entry.status === "done" ? "planned" : "completed"}`}
                      aria-pressed={entry.status === "done"}
                      disabled={Boolean(entry.sleepId) || (entry.status === "planned" && slotDate(entry.date, entry.startMinute) > now)}
                      onClick={() => onToggle(entry.id)}
                    >
                      {entry.status === "done" ? <Check /> : <Clock />}
                    </button>
                  </div>
                </div>
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
