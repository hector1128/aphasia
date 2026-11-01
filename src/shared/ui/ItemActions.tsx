import { useEffect, useId, useRef, useState } from "react";
import { Menu, Pencil, Trash2 } from "lucide-react";

export function ItemActions({ name, onEdit, onDelete, deleteLabel = `Delete ${name}` }: {
  name: string; onEdit?: () => void; onDelete: () => void; deleteLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [shift, setShift] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", close); };
  }, [open]);
  return <div ref={root} className={`item-actions ${open ? "is-open" : ""} ${above ? "opens-up" : ""}`}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }}>
    <button type="button" ref={trigger} className="item-actions-trigger" aria-label={`Options for ${name}`}
      aria-expanded={open} aria-controls={panelId} onClick={() => {
        if (!open && root.current) {
          const boundary = root.current.closest(".day-timeline")?.getBoundingClientRect();
          const anchor = root.current.getBoundingClientRect();
          const height = (panel.current?.offsetHeight ?? 70) + 8;
          const below = Math.min(boundary?.bottom ?? window.innerHeight, window.innerHeight) - anchor.bottom;
          const above = anchor.top - Math.max(boundary?.top ?? 0, 0);
          setAbove(below < height && above > below);
          const width = panel.current?.offsetWidth ?? 240;
          const left = anchor.right - width;
          setShift(Math.max((boundary?.left ?? 0) + 8, Math.min(left, (boundary?.right ?? window.innerWidth) - width - 8)) - left);
        }
        setOpen(!open);
      }}><Menu aria-hidden="true" /></button>
    <div ref={panel} id={panelId} className="item-actions-panel" style={{ right: -shift }} role="group" aria-label={`Actions for ${name}`} aria-hidden={!open} inert={!open}>
      <button type="button" className="item-action-delete" aria-label={deleteLabel} onClick={() => { setOpen(false); onDelete(); }}>
        <Trash2 aria-hidden="true" /><span>{deleteLabel.startsWith("Unlink") ? "Unlink" : "Delete"}</span>
      </button>
      {onEdit && <button type="button" className="item-action-edit" aria-label={`Edit ${name}`} onClick={() => { setOpen(false); onEdit(); }}>
        <Pencil aria-hidden="true" /><span>Edit</span>
      </button>}
    </div>
  </div>;
}
