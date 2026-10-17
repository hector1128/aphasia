const numbers: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50,
};
export function spokenNumber(text: string): number | undefined {
  const value = text.toLowerCase().replace(/[.,!?]/g, "").trim();
  if (/^\d+$/.test(value)) return Number(value);
  const words = value.split(/[\s-]+/);
  if (!words.length || words.some((word) => !(word in numbers))) return undefined;
  return words.reduce((sum, word) => sum + numbers[word], 0);
}
export function breathingMinutes(text: string): number | undefined {
  const value = text.toLowerCase().trim().replace(/\s*(minutes?|mins?)\s*[.!?]?$/, "").replace(/[.!?]+$/, "").trim();
  const half = value.match(/^(.+) and a half$/);
  const amount = /^(\d+(\.\d+)?|\.\d+)$/.test(value) ? Number(value)
    : value === "half" ? .5 : half ? (spokenNumber(half[1]) ?? NaN) + .5 : /[\d.]/.test(value) ? undefined : spokenNumber(value);
  return amount !== undefined && Number.isFinite(amount) && amount > 0 && amount * 60000 <= Number.MAX_SAFE_INTEGER ? amount : undefined;
}
export function parseSpokenTime(text: string): number | undefined {
  const value = text.toLowerCase().replace(/a\.?\s*m\.?/g, "am").replace(/p\.?\s*m\.?/g, "pm")
    .replace(/o['’]?clock/g, "").replace(/\b(please|at)\b/g, "").trim();
  const match = value.replace(/[.!?]/g, "").match(/^(.*?)\s*(am|pm)$/);
  // Never guess AM/PM from an ambiguous utterance.
  if (!match) return undefined;
  const clock = match[1].trim();
  let hour: number | undefined, minute = 0;
  const digits = clock.match(/^(\d{1,2})(?::|\s)(\d{1,2})$/) ?? clock.match(/^(\d{1,2})(\d{2})$/);
  if (digits) { hour = Number(digits[1]); minute = Number(digits[2]); }
  else {
    const words = clock.split(/\s+/);
    hour = spokenNumber(words[0]);
    if (words.length > 1) {
      const rest = spokenNumber(words.slice(1).join(" "));
      if (rest === undefined) return undefined;
      minute = rest;
    }
  }
  if (hour === undefined || hour < 1 || hour > 12 || minute < 0 || minute > 59) return undefined;
  return (hour % 12 + (match[2] === "pm" ? 12 : 0)) * 60 + minute;
}
