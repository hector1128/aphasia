export type ReminderPreferences = { email: string; timeZone: string; enabled: boolean; confirmed: boolean; pending: boolean };
export const validReminderEmail = (email: string) => email.length <= 254 && /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email);
export function validTimeZone(zone: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(); return true; }
  catch { return false; }
}
export function parseReminderPreferences(input: unknown): ReminderPreferences {
  if (!input || typeof input !== "object" || !("email" in input) || typeof input.email !== "string" ||
    !("timeZone" in input) || typeof input.timeZone !== "string" || !validTimeZone(input.timeZone) ||
    !("enabled" in input) || typeof input.enabled !== "boolean" ||
    !("confirmed" in input) || typeof input.confirmed !== "boolean" ||
    !("pending" in input) || typeof input.pending !== "boolean") throw Error("Could not read reminder settings.");
  return { email: input.email, timeZone: input.timeZone, enabled: input.enabled, confirmed: input.confirmed, pending: input.pending };
}
