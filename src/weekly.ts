import { type Data, dateKey, slotDate } from "./model.js";
import { weekDates } from "./date-time.js";
export const average = (values: number[]) => values.length
  ? values.reduce((total, value) => total + value, 0) / values.length : undefined;
export function weeklyStats(data: Data, selectedDate: string, now = new Date()) {
  const dates = weekDates(selectedDate).map(dateKey);
  const entries = Object.values(data.entries).filter((entry) => dates.includes(entry.date) && !entry.sleepId && !entry.sleepBoundary);
  const done = entries.filter((entry) => entry.status === "done");
  const daily = dates.map((date) => {
    const activities = done.filter((entry) => entry.date === date);
    const sleep = data.sleeps.filter((record) => dateKey(new Date(record.end)) === date)
      .map((record) => [Date.parse(record.start), Date.parse(record.end)])
      .sort((a, b) => a[0] - b[0]);
    let sleepMs = 0, end = -Infinity;
    for (const [start, finish] of sleep) {
      sleepMs += Math.max(0, finish - Math.max(start, end));
      end = Math.max(end, finish);
    }
    return {
      date, activities: activities.length,
      dailyMood: data.ratings[date],
      activityMood: average(activities.flatMap((entry) => entry.mood === undefined ? [] : [entry.mood])),
      sleepHours: sleep.length ? sleepMs / 3_600_000 : undefined,
      mindfulness: data.mindfulness.filter((session) => session.date === date && session.status === "completed").length,
    };
  });
  const due = entries.filter((entry) => entry.source === "scheduled" && slotDate(entry.date, entry.startMinute) <= now);
  const completedPlans = due.filter((entry) => entry.status === "done").length;
  const elapsedDays = dates.filter((date) => date <= dateKey(now)).length;
  return {
    dates, daily, entries, totalActivities: done.length,
    daysLogged: daily.filter((day) => day.activities > 0).length,
    elapsedDays, averageActivities: elapsedDays ? done.length / elapsedDays : undefined,
    averageSleep: average(daily.flatMap((day) => day.sleepHours === undefined ? [] : [day.sleepHours])),
    sleepDays: daily.filter((day) => day.sleepHours !== undefined).length,
    mindfulness: daily.reduce((total, day) => total + day.mindfulness, 0),
    duePlans: due.length, completedPlans,
    missedPlans: due.filter((entry) => entry.status === "missed").length,
    unansweredPlans: due.filter((entry) => entry.status === "planned").length,
    completionRate: due.length ? completedPlans / due.length : undefined,
  };
}
export function weeklyReportData(data: Data, date: string): Data {
  const dates = weekDates(date).map(dateKey);
  const first = dates[0], last = dates[6];
  return {
    ...data, email: "", recentActivities: [],
    entries: Object.fromEntries(Object.entries(data.entries).filter(([, entry]) => dates.includes(entry.date))),
    ratings: Object.fromEntries(Object.entries(data.ratings).filter(([day]) => dates.includes(day))),
    mindfulness: data.mindfulness.filter((session) => dates.includes(session.date)),
    sleeps: data.sleeps.filter((sleep) => dateKey(new Date(sleep.end)) >= first && dateKey(new Date(sleep.start)) <= last),
  };
}
