import { Check, Clock } from "lucide-react";
import { type Entry, slotDate } from "./model";
export function ScheduleControls({ entry, now, onOutcome }: {
  entry: Entry; now: Date; onOutcome: (id: string, outcome: "done" | "missed") => void;
}) {
  if (entry.source !== "scheduled" || entry.sleepId) return null;
  const upcoming = slotDate(entry.date, entry.startMinute) > now;
  const completed = entry.status === "done";
  return <button type="button" className={`completion-toggle ${completed ? "is-complete" : "is-empty"}`}
    disabled={upcoming} aria-label={upcoming ? `${entry.name} is scheduled for later` : completed ? `Mark ${entry.name} as not completed` : `Complete and rate ${entry.name}`}
    aria-pressed={completed} onClick={() => onOutcome(entry.id, completed ? "missed" : "done")}>
    {upcoming ? <Clock aria-hidden="true" /> : completed ? <Check aria-hidden="true" /> : null}
  </button>;
}
