export type ReminderKind = "morning" | "afternoon" | "evening";
export type ReminderTimes = { morning: number | null; afternoon: boolean; evening: number | null };
export const defaultReminderTimes = (): ReminderTimes => ({ morning: null, afternoon: true, evening: null });
export type ReminderPreferences = { email: string; timeZone: string; enabled: boolean; confirmed: boolean; pending: boolean; times: ReminderTimes };
export const validReminderEmail = (email: string) => email.length <= 254 && /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email);
export function validTimeZone(zone: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(); return true; }
  catch { return false; }
}
const validReminderMinute = (minute: unknown) => minute === null || (typeof minute === "number" && Number.isInteger(minute) && minute >= 0 && minute < 1440 && minute % 30 === 0);
export function validReminderTimes(value: unknown): value is ReminderTimes {
  return !!value && typeof value === "object" && "morning" in value && validReminderMinute(value.morning) &&
    "evening" in value && validReminderMinute(value.evening) && "afternoon" in value && typeof value.afternoon === "boolean" &&
    (value.morning !== null || value.evening !== null || value.afternoon);
}
export function parseReminderPreferences(input: unknown): ReminderPreferences {
  if (!input || typeof input !== "object" || !("email" in input) || typeof input.email !== "string" ||
    !("timeZone" in input) || typeof input.timeZone !== "string" || !validTimeZone(input.timeZone) ||
    !("enabled" in input) || typeof input.enabled !== "boolean" ||
    !("confirmed" in input) || typeof input.confirmed !== "boolean" ||
    !("pending" in input) || typeof input.pending !== "boolean" || ("times" in input && !validReminderTimes(input.times))) throw Error("Could not read reminder settings.");
  return { email: input.email, timeZone: input.timeZone, enabled: input.enabled, confirmed: input.confirmed, pending: input.pending,
    times: "times" in input && validReminderTimes(input.times) ? input.times : defaultReminderTimes() };
}
export function reminderMessage(kind: ReminderKind) {
  if (kind === "morning") return { subject: "Good morning from My Day", text: "Good morning! Take a moment to start your activity log today." };
  if (kind === "evening") return { subject: "Good night from My Day", text: "Good night! Before you finish your day, remember to log your activities." };
  return { subject: "A reminder from My Day", text: "A quick reminder to log an activity today." };
}
