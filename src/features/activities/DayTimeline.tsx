import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Plus, GripHorizontal, Repeat2 } from "lucide-react";
import { ItemActions } from "../../shared/ui/ItemActions";
import { type Entry, type Data, currentSlot, dateKey, entriesOnDate, entryEnd, entryTimeLabel, timeLabel, resizeActivity } from "../../domain/model";
import { ScheduleControls } from "./ScheduleControls";
import { ActivityIcon } from "./ActivityIcon";

export function DayTimeline({ date, data, onAdd, onEdit, onDelete, onToggle, onResize }: {
  date: string; data: Data; onAdd: (minute: number) => void; onEdit: (entry: Entry) => void;
  onDelete: (id: string) => void; onToggle: (id: string, outcome: "done" | "missed") => void; onResize: (entry: Entry) => boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const area = useRef<HTMLDivElement>(null);
  const activeSlot = useRef<HTMLDivElement>(null);
  const drag = useRef<{ entry: Entry; edge: "start" | "end"; preview: Entry } | null>(null);
  const [preview, setPreview] = useState<Entry | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (area.current) area.current.scrollTop = activeSlot.current ? activeSlot.current.offsetTop - 40 : 0; drag.current = null; setPreview(null); }, [date]);
  const entries = entriesOnDate(data, date).map((entry) => entry.id === preview?.id ? preview : entry);
  const beginResize = (event: PointerEvent<HTMLButtonElement>, entry: Entry, edge: "start" | "end") => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    drag.current = { entry, edge, preview: entry };
    area.current?.setPointerCapture(event.pointerId);
    setPreview(entry);
  };
  const resizeHandle = (entry: Entry, edge: "start" | "end") => <button type="button" className={`activity-resize-handle resize-${edge}`}
    aria-label={`Adjust ${edge} time for ${entry.name}`} title={`Drag to adjust ${edge} time, or use the arrow keys`}
    onPointerDown={(event) => beginResize(event, entry, edge)}
    onKeyDown={(event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault(); event.stopPropagation();
      const resized = resizeActivity(entry, edge, (edge === "start" ? entry.startMinute : entryEnd(entry)) + (event.key === "ArrowUp" ? -30 : 30));
      const accepted = onResize(resized);
      setMessage(accepted ? `${entry.name}: ${entryTimeLabel(resized)}` : "Duration unchanged.");
      requestAnimationFrame(() => Array.from(area.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .find((button) => button.getAttribute("aria-label") === `Adjust ${edge} time for ${entry.name}`)?.focus());
    }}><GripHorizontal size={20} aria-hidden="true" /></button>;
  return <>
    <p className="timeline-help">Drag an activity’s start or end handle to change its duration. You can also focus a handle and use the arrow keys.</p>
    <p className="sr-only" role="status">{preview ? `${preview.name}: ${entryTimeLabel(preview)}` : message}</p>
    <div className={`day-timeline ${preview ? "is-resizing" : ""}`} ref={area} tabIndex={0} role="region" aria-label="Day timeline"
      onKeyDown={(event) => { if (event.key === "Escape" && drag.current) { drag.current = null; setPreview(null); setMessage("Duration change cancelled."); } }}
      onPointerMove={(event) => {
        const current = drag.current, root = area.current;
        if (!current || !root) return;
        const boundary = root.getBoundingClientRect();
        if (event.clientY < boundary.top + 35) root.scrollTop -= 18;
        else if (event.clientY > boundary.bottom - 35) root.scrollTop += 18;
        const slots = Array.from(root.querySelectorAll<HTMLElement>('.timeline-slot'));
        const slot = slots.find((item) => { const rect = item.getBoundingClientRect(); return event.clientY >= rect.top && event.clientY < rect.bottom; })
          ?? (event.clientY < boundary.top ? slots[0] : slots[slots.length - 1]);
        if (!slot) return;
        current.preview = resizeActivity(current.entry, current.edge, Number(slot.dataset.minute) + (current.edge === "end" ? 30 : 0));
        setPreview(current.preview);
      }}
      onPointerUp={(event) => {
        const current = drag.current; if (!current) return;
        drag.current = null; setPreview(null);
        if (current.preview.startMinute !== current.entry.startMinute || entryEnd(current.preview) !== entryEnd(current.entry)) {
          const accepted = onResize(current.preview);
          setMessage(accepted ? `${current.preview.name}: ${entryTimeLabel(current.preview)}` : "Duration unchanged.");
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; setPreview(null); setMessage("Duration change cancelled."); }}>
      {Array.from({ length: 48 }, (_, i) => i * 30).map((minute) => {
        const items = entries.filter((entry) => entry.startMinute < minute + 30 && entryEnd(entry) > minute);
        const current = date === dateKey(now) && minute === currentSlot(now);
        return <div className="timeline-slot" data-minute={minute} key={minute} ref={current ? activeSlot : undefined}>
          <div className={`timeline-hour${items.length ? " has-activity" : ""}${items.some((item) => item.id === preview?.id) ? " resizing-range" : ""}`}>
            <div className="timeline-slot-heading"><time>{timeLabel(minute)}</time><button aria-label={`Add activity at ${timeLabel(minute)}`} onClick={() => onAdd(minute)}><Plus size={26} /></button></div>
            {items.map((entry) => {
              const first = Math.floor(entry.startMinute / 30) * 30 === minute;
              const last = Math.ceil(entryEnd(entry) / 30) * 30 - 30 === minute;
              const resizable = !entry.sleepId && !entry.sleepBoundary;
              return <div className={`timeline-entry ${entry.source === "scheduled" ? "scheduled-entry" : ""} ${first ? "" : "activity-continuation"}`} key={entry.id} data-entry-id={entry.id}>
                {first && resizable && resizeHandle(entry, "start")}
                <div className="timeline-entry-content"><div className="timeline-entry-info">
                  <span className="activity-art"><ActivityIcon id={entry.icon} name={entry.name} /></span>
                  <div className="entry-name-time"><strong>{entry.name}{entry.seriesId && <Repeat2 size={18} aria-label="Repeating activity" />}</strong>
                    <time>{first ? entryTimeLabel(entry) : `Continues until ${timeLabel(entryEnd(entry))}`}</time></div>
                </div>
                {first && <div className="entry-controls"><ScheduleControls entry={entry} now={now} onOutcome={onToggle} />
                  {!entry.sleepId && <ItemActions name={entry.name} onDelete={() => onDelete(entry.id)} onEdit={() => onEdit(entry)} />}
                </div>}</div>
                {last && resizable && resizeHandle(entry, "end")}
              </div>;
            })}
          </div>
          {current && <div className="current-time-line" role="img" aria-label={`Current time: ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            style={{ top: `${(((now.getMinutes() % 30) + now.getSeconds() / 60) / 30) * 100}%` }}><span className="current-time-dot" /></div>}
        </div>;
      })}
    </div>
  </>;
}
