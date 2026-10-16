import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Entry,
  Data,
  currentSlot,
  dateKey,
  entriesInSlot,
  timeLabel,
} from "./model";
import { ScheduleControls } from "./ScheduleControls";
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
  onToggle: (id: string, outcome: "done" | "missed") => void;
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
                <div className={`timeline-entry ${entry.source === "scheduled" ? "scheduled-entry" : ""}`} key={entry.id}>
                  <div className="timeline-entry-info">
                    <ActivityIcon id={entry.icon} name={entry.name} />
                    <div>
                      <div className="entry-name-time"><strong>{entry.name}</strong><time>{timeLabel(entry.startMinute)}</time></div>
                      {entry.source === "scheduled" && <span className="schedule-label">Scheduled{entry.status === "missed" ? " · Not completed" : entry.status === "done" ? " · Completed" : ""}</span>}
                    </div>
                  </div>
                  <div className="entry-controls">
                    {!entry.sleepId && (
                      <>
                        <button className="entry-icon-control is-delete" aria-label={`Delete ${entry.name}`} onClick={() => onDelete(entry.id)}><Trash2 /></button>
                        <button className="entry-icon-control" aria-label={`Edit ${entry.name}`} onClick={() => onEdit(entry)}><Pencil /></button>
                      </>
                    )}
                    <ScheduleControls entry={entry} now={now} onOutcome={onToggle} />
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
