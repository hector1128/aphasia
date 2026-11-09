import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { timeLabel } from "../../domain/model";

export function TimeSelect({ label, value, onChange, min = 0, max = 1410, disabled = false }: {
  label: string; value: number; onChange: (minute: number) => void; min?: number; max?: number; disabled?: boolean;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 150 });
  const options = Array.from({ length: Math.max(0, Math.floor((max - min) / 30) + 1) }, (_, i) => min + i * 30);
  const optionLabel = (minute: number) => `${timeLabel(minute)}${minute === 1440 ? " (midnight)" : ""}`;
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (!(event.target instanceof Node) || !panel.current?.contains(event.target)) panel.current?.hidePopover(); };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    const selected = panel.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?? panel.current?.querySelector<HTMLButtonElement>('[role="option"]');
    selected?.scrollIntoView({ block: "nearest" });
    selected?.focus({ preventScroll: true });
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [open]);
  const show = () => {
    if (!button.current) return;
    const rect = button.current.getBoundingClientRect();
    const height = Math.min(260, options.length * 48 + 16);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.max(150, rect.width) - 12)),
      top: rect.bottom + height + 12 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - height - 8), width: Math.max(150, rect.width) });
    panel.current?.togglePopover();
  };
  return <div className="time-select">
    <span id={`${id}-label`} className="time-select-label">{label}</span>
    <button type="button" ref={button} className="time-select-trigger" aria-labelledby={`${id}-label ${id}-value`}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={show}
      onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (!open) show(); } }}>
      <span id={`${id}-value`}>{timeLabel(value)}</span><ChevronDown size={20} aria-hidden="true" />
    </button>
    <div id={id} popover="auto" ref={panel} role="listbox" aria-labelledby={`${id}-label`} className="time-select-options"
      style={position} onToggle={(event) => setOpen(event.newState === "open")}
      onKeyDown={(event) => {
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
        const index = buttons.findIndex((item) => item === document.activeElement);
        let next: number;
        if (event.key === "ArrowDown") next = Math.min(buttons.length - 1, index + 1);
        else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else if (event.key === "Tab") { panel.current?.hidePopover(); return; }
        else if (event.key === "Escape") { panel.current?.hidePopover(); button.current?.focus(); return; }
        else return;
        event.preventDefault(); buttons[next]?.focus();
      }}>
      {options.map((minute) => <button type="button" role="option" key={minute} aria-selected={minute === value}
        tabIndex={minute === value ? 0 : -1} onClick={() => { onChange(minute); panel.current?.hidePopover(); button.current?.focus(); }}>{optionLabel(minute)}</button>)}
    </div>
  </div>;
}
