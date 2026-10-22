import { useEffect } from "react";
type SpokenTarget = { element: HTMLElement; text: string; range?: Range };
function wordsAt(event: MouseEvent): SpokenTarget | null {
  if (!(event.target instanceof Element) || event.target.closest('[data-read-aloud="off"], input, textarea, select, audio')) return null;
  const control = event.target.closest<HTMLElement>('button, a, label, summary, [role="switch"], [role="button"]');
  if (control) return { element: control, text: control.getAttribute("aria-label") || control.textContent || "" };
  const element = event.target.closest<HTMLElement>('h1, h2, h3, p, strong, time, .eyebrow, [data-speak]');
  if (!element) return null;
  const position = document.caretPositionFromPoint?.(event.clientX, event.clientY);
  const caret = position ? undefined : document.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = position?.offsetNode ?? caret?.startContainer;
  const offset = position?.offset ?? caret?.startOffset ?? 0;
  if (node?.nodeType === Node.TEXT_NODE && element.contains(node)) {
    const text = node.textContent || "";
    const wordCharacter = (index: number) => index >= 0 && index < text.length && /[\p{L}\p{N}'’-]/u.test(text[index]);
    let start = offset, end = offset;
    while (wordCharacter(start - 1)) start--;
    while (wordCharacter(end)) end++;
    if (end > start) {
      const range = document.createRange(); range.setStart(node, start); range.setEnd(node, end);
      return { element, text: text.slice(start, end), range };
    }
  }
  return { element, text: element.textContent || "" };
}
export function useReadAloud(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !window.speechSynthesis) return;
    let armed: SpokenTarget | null = null, hovered: SpokenTarget | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let touched = false;
    const same = (a: SpokenTarget | null, b: SpokenTarget | null) => Boolean(a && b && a.element === b.element && a.text === b.text);
    const clear = () => {
      clearTimeout(timer);
      armed?.element.classList.remove("read-highlight");
      CSS.highlights?.delete("read-word");
      armed = null;
    };
    const speak = (target: SpokenTarget) => {
      clear(); armed = target;
      if (target.range && typeof Highlight !== "undefined" && CSS.highlights)
        CSS.highlights.set("read-word", new Highlight(target.range));
      else target.element.classList.add("read-highlight");
      if (!target.text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(target.text.trim());
      utterance.lang = "en-US"; utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    };
    const pointer = (event: PointerEvent) => { touched = event.pointerType === "touch" || event.pointerType === "pen"; };
    const click = (event: MouseEvent) => {
      if (!touched || event.detail === 0) return; // Preserve keyboard and screen-reader activation.
      const target = wordsAt(event);
      if (!target || (target.element instanceof HTMLButtonElement && target.element.disabled)) return;
      if (same(armed, target)) { clear(); window.speechSynthesis.cancel(); return; }
      event.preventDefault(); event.stopImmediatePropagation(); speak(target);
    };
    const hover = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = wordsAt(event);
      if (same(hovered, target)) return;
      clearTimeout(timer); hovered = target;
      if (target && !same(armed, target)) timer = setTimeout(() => {
        if (target.element.isConnected) speak(target);
      }, 900);
    };
    const leave = () => { clearTimeout(timer); hovered = null; };
    const stopAudio = () => { clear(); window.speechSynthesis.cancel(); };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("click", click, true);
    document.addEventListener("pointermove", hover, true);
    document.addEventListener("pointerleave", leave, true);
    document.addEventListener("play", stopAudio, true);
    document.addEventListener("my-day-stop-speaking", stopAudio);
    return () => {
      stopAudio();
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("pointermove", hover, true);
      document.removeEventListener("pointerleave", leave, true);
      document.removeEventListener("play", stopAudio, true);
      document.removeEventListener("my-day-stop-speaking", stopAudio);
    };
  }, [enabled]);
}
