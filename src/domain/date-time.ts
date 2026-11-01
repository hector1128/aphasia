import { dateKey, currentSlot } from "./model.js";
export function nextActivitySlot(now = new Date()) {
  const next = new Date(now);
  next.setHours(0, currentSlot(now) + 30, 0, 0);
  return { date: dateKey(next), startMinute: currentSlot(next) };
}

export function weekDates(selectedDate: string): Date[] {
  const monday = new Date(`${selectedDate}T12:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + offset);
    return date;
  });
}

export function shiftWeek(date: string, direction: number): string {
  const next = new Date(`${date}T12:00`);
  next.setDate(next.getDate() + direction * 7);
  return dateKey(next);
}

export function to24Hour(hour: number, period: "AM" | "PM"): number {
  return (hour % 12) + (period === "PM" ? 12 : 0);
}
