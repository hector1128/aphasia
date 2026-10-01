import { Data, lifeAreas, timeLabel, dateKey } from "./model";
const missing = "Not completed";
const score = (n?: number) => (n === undefined ? missing : `${n}/10`);
export function reportData(data: Data, date: string): Data {
  return {
    ...data,
    email: "",
    recentActivities: [],
    entries: Object.fromEntries(
      Object.entries(data.entries).filter(([, e]) => e.date === date),
    ),
    ratings:
      data.ratings[date] === undefined ? {} : { [date]: data.ratings[date] },
    mindfulness: data.mindfulness.filter((s) => s.date === date),
    sleeps: data.sleeps.filter(
      (s) =>
        dateKey(new Date(s.start)) <= date && dateKey(new Date(s.end)) >= date,
    ),
  };
}
export function reportSections(data: Data, date: string) {
  const entries = Object.values(data.entries)
    .filter((e) => e.date === date)
    .sort(
      (a, b) => a.startMinute - b.startMinute || a.name.localeCompare(b.name),
    );
  const done = entries.filter((e) => e.status === "done" && !e.sleepId && !e.sleepBoundary);
  const sessions = data.mindfulness.filter((s) => s.date === date);
  const rated = done.filter((e) => e.rating !== undefined);
  const freq = new Map<string, number>();
  done.forEach((e) => freq.set(e.name, (freq.get(e.name) ?? 0) + 1));
  const maxCount = Math.max(0, ...freq.values());
  const maxEnjoy = Math.max(-1, ...rated.map((e) => e.rating!));
  const covered = new Set(entries.map((e) => e.startMinute));
  return [
    {
      title: "Day overview",
      lines: [
        `Person: ${data.name || missing}`,
        `Date: ${date}`,
        `Daily mood: ${score(data.ratings[date])}`,
        `Activities completed: ${done.length}`,
        `Activities planned, not completed: ${entries.filter((e) => e.status === "planned").length}`,
        `Half-hour slots without an entry: ${48 - covered.size} (not completed)`,
      ],
    },
    {
      title: "Activities and ratings",
      lines: entries.filter((e) => !e.sleepId).length
        ? entries.filter((e) => !e.sleepId).map(
            (e) =>
              e.sleepBoundary
                ? `${timeLabel(e.startMinute)} | ${e.name}\nSleep period ${e.sleepBoundary === "sleep" ? "started" : "ended"}`
                : `${timeLabel(e.startMinute)} | ${e.name}\n${e.status === "done" ? "Completed" : "Planned - not completed"}\nMood: ${score(e.mood)}    Enjoyment: ${score(e.rating)}    Importance: ${score(e.importance)}`,
          )
        : [missing],
    },
    {
      title: "Sleep",
      lines: data.sleeps.length
        ? data.sleeps.map(
            (s) => `${s.start.replace("T", " ")} to ${s.end.replace("T", " ")}`,
          )
        : [missing],
    },
    {
      title: "Mindfulness",
      lines: (["breathing", "visualization", "stretching"] as const)
        .map((kind) => {
          const items = sessions.filter((s) => s.kind === kind);
          return `${kind === "breathing" ? "Breathing" : kind === "visualization" ? "Visualization" : "Gentle stretching"}: ${items.filter((s) => s.status === "completed").length} completed; ${items.filter((s) => s.status === "started").length} started, not completed${!items.length ? " - Not completed" : ""}`;
        })
        .concat(
          "Breathing completion is timed. Video activity completion is self-reported.",
        ),
    },
    {
      title: "Patterns in today's entries",
      lines: [
        done.length
          ? `Most frequent: ${[...freq]
              .filter(([, n]) => n === maxCount)
              .map(([name]) => name)
              .join(", ")} (${maxCount} each)`
          : `Most frequent: ${missing}`,
        rated.length
          ? `Highest enjoyment: ${rated
              .filter((e) => e.rating === maxEnjoy)
              .map((e) => e.name)
              .join(", ")} (${maxEnjoy}/10)`
          : `Enjoyment pattern: ${missing}`,
        rated.length
          ? `Average enjoyment: ${(rated.reduce((n, e) => n + e.rating!, 0) / rated.length).toFixed(1)}/10 from ${rated.length} rated activities.`
          : "Average enjoyment: Not completed",
        "Descriptions of this day's recorded data only; no clinical interpretation. Sleep entries excluded from activity patterns.",
      ],
    },
    ...lifeAreas.map((area) => ({
      title: `Values: ${area}`,
      lines: data.values.some((v) => v.area === area)
        ? data.values
            .filter((v) => v.area === area)
            .map(
              (v) =>
                `${v.name}\nLinked activities: ${v.activities.length ? v.activities.map((a) => a.name).join(", ") : missing}\nDone today: ${
                  v.activities
                    .filter((a) =>
                      done.some(
                        (e) => e.name.toLowerCase() === a.name.toLowerCase(),
                      ),
                    )
                    .map((a) => a.name)
                    .join(", ") || missing
                }`,
            )
        : [missing],
    })),
  ];
}
