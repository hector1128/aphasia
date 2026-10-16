import { Check, Clock, LockKeyhole, Minus } from "lucide-react";
import { type Entry, slotDate } from "./model";
export function ScheduleControls({ entry, now, onOutcome }: {
  entry: Entry; now: Date; onOutcome: (id: string, outcome: "done" | "missed") => void;
}) {
  if (entry.source !== "scheduled" || entry.sleepId) return null;
  if (slotDate(entry.date, entry.startMinute) > now) return <span className="schedule-locked" role="img" aria-label="Scheduled for later. Completion locked.">
    <Clock size={24} /><LockKeyhole size={14} />
  </span>;
  return <>
    <button type="button" className={`completion-toggle ${entry.status === "done" ? "is-complete" : ""}`}
      aria-label={`Complete and rate ${entry.name}`} aria-pressed={entry.status === "done"} onClick={() => onOutcome(entry.id, "done")}><Check /></button>
    <button type="button" className={`completion-toggle is-missed ${entry.status === "missed" ? "selected" : ""}`}
      aria-label={`Mark ${entry.name} as not completed`} aria-pressed={entry.status === "missed"} onClick={() => onOutcome(entry.id, "missed")}><Minus /></button>
  </>;
}
