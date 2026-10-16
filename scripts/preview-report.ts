import { mkdir, writeFile } from "node:fs/promises";
import { emptyData, type Entry } from "../src/model";
import { buildWeeklyReportPdf } from "../src/report-week";
const data = emptyData(); data.name = "Design Test";
const days = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
const names = ["Walking", "Reading", "Visiting family", "Making lunch", "Listening to music"];
for (const [day, date] of days.entries()) {
  if (day !== 2) data.ratings[date] = [5, 7, 0, 3, 8, 6, 9][day];
  for (let i = 0; i < (day % 4) + 2; i++) {
    const id = `${day}-${i}`;
    const entry: Entry = { id, name: names[i % names.length], date, startMinute: 9 * 60 + i * 75 + day,
      icon: "walk", source: i === 1 ? "scheduled" : "logged", status: i === 1 && day % 2 ? "missed" : "done",
      mood: (day + i) % 11, rating: (day + i + 3) % 11, importance: 7 };
    data.entries[id] = entry;
  }
  if (day !== 3) data.sleeps.push({ id: `sleep-${day}`, start: `${date}T00:05`, end: `${date}T07:17` });
  data.mindfulness.push({ id: `mind-${day}`, date, kind: "breathing", status: day === 2 ? "started" : "completed" });
}
await mkdir("output/pdf", { recursive: true });
await writeFile("output/pdf/weekly-report-preview.pdf", await buildWeeklyReportPdf(data, days[0], new Date("2026-10-19T12:00")));
console.info("Created output/pdf/weekly-report-preview.pdf using fictional test data.");
