import { catalogueActivity } from "./catalogue.js";
import { dateKey, type ActivityChoice, type Data, type Entry } from "../model.js";

function timeDefaults(minute: number, weekend: boolean): string[] {
  if (minute < 360) return ["Sleeping", "Resting", "Reading"];
  if (minute < 540) return ["Breakfast", "Coffee or tea", "Getting dressed"];
  if (minute < 690) return weekend
    ? ["Walking", "Grocery shopping", "Gardening"]
    : ["Walking", "Working", "Laundry"];
  if (minute < 810) return ["Lunch", "Eating out", "Walking"];
  if (minute < 1020) return weekend
    ? ["Visiting family", "Arts and crafts", "Reading"]
    : ["Walking", "Reading", "Snack"];
  if (minute < 1200) return ["Dinner", "Cooking", "Visiting family"];
  return ["Watching TV", "Reading", "Resting"];
}

export function recommendedActivities(
  data: Pick<Data, "entries">,
  slot: Pick<Entry, "date" | "startMinute">,
  now = new Date(),
): ActivityChoice[] {
  const weekday = new Date(`${slot.date}T12:00`).getDay();
  const minute = Math.floor(slot.startMinute / 30) * 30;
  const today = dateKey(now);
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const ranked = new Map<string, { choice: ActivityChoice; tier: number; count: number; latest: string }>();
  for (const entry of Object.values(data.entries)) {
    if (entry.status !== "done" || entry.sleepId || entry.sleepBoundary ||
        entry.date > today || (entry.date === today && entry.startMinute > nowMinute)) continue;
    const distance = Math.abs(Math.floor(entry.startMinute / 30) * 30 - minute);
    if (distance > 60) continue;
    const sameDay = new Date(`${entry.date}T12:00`).getDay() === weekday;
    const tier = (distance === 0 ? 0 : 2) + (sameDay ? 0 : 1);
    const match = catalogueActivity(entry.name) ?? entry;
    const key = match.name.toLowerCase();
    const previous = ranked.get(key);
    if (!previous || tier < previous.tier) {
      ranked.set(key, { choice: { name: match.name, icon: match.icon }, tier, count: 1, latest: entry.date });
    } else if (tier === previous.tier) {
      previous.count++;
      if (entry.date > previous.latest) previous.latest = entry.date;
    }
  }

  const choices = [...ranked.values()]
    .sort((a, b) => a.tier - b.tier || b.count - a.count || b.latest.localeCompare(a.latest) || a.choice.name.localeCompare(b.choice.name))
    .map(({ choice }) => choice);
  for (const name of timeDefaults(minute, weekday === 0 || weekday === 6)) {
    const match = catalogueActivity(name);
    if (match && !ranked.has(match.name.toLowerCase())) choices.push({ name: match.name, icon: match.icon });
  }
  return choices.slice(0, 3);
}
