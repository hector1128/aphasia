import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { type Data, timeLabel } from "./model";
import { weeklyStats } from "./weekly";

export async function buildWeeklyReportPdf(data: Data, date: string, now = new Date()): Promise<Uint8Array> {
  const stats = weeklyStats(data, date, now);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());
  const clean = (text: string) => [...text].map((c) => supported.has(c.codePointAt(0) ?? 0) ? c : "-").join("");
  const green = rgb(.21, .42, .29), purple = rgb(.4, .29, .53), orange = rgb(.68, .36, .15), ink = rgb(.14, .23, .20);
  const pale = rgb(.94, .96, .93), line = rgb(.8, .84, .81);
  const width = 511;
  let page = pdf.addPage([595, 842]), y = 788;
  const text = (value: string, x: number, top: number, size = 11, strong = false, color = ink) =>
    page.drawText(clean(value), { x, y: top - size, size, font: strong ? bold : regular, color });
  const heading = (title: string) => { text(title, 42, y, 17, true); y -= 32; };
  const nextPage = () => { page = pdf.addPage([595, 842]); y = 788; };
  const wrap = (value: string, maxWidth: number) => {
    const lines: string[] = []; let current = "";
    for (const character of clean(value)) {
      if (regular.widthOfTextAtSize(current + character, 9) > maxWidth) { lines.push(current); current = ""; }
      current += character;
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };
  const note = (value: string) => {
    for (const part of wrap(value, width)) { text(part, 42, y, 9); y -= 13; }
    y -= 7;
  };
  const format = (value: number | undefined, unit = "") => value === undefined ? "Not recorded" : `${value.toFixed(1)}${unit}`;
  text("ACTIVITY LOG", 42, y, 11, true, green); y -= 25;
  heading("Weekly report");
  note(`${stats.dates[0]} to ${stats.dates[6]} | ${data.name || "Name not provided"}`);
  const cards = [
    ["Days with activities", `${stats.daysLogged} of ${stats.elapsedDays} elapsed days`],
    ["Total activities", String(stats.totalActivities)],
    ["Activities per day", format(stats.averageActivities)],
    ["Average sleep", format(stats.averageSleep, " hours")],
    ["Mindfulness completed", String(stats.mindfulness)],
    ["Scheduled completion", stats.completionRate === undefined ? "No due plans" : `${Math.round(stats.completionRate * 100)}% (${stats.completedPlans}/${stats.duePlans})`],
  ];
  cards.forEach(([label, value], i) => {
    const x = 42 + (i % 3) * 174, top = y - Math.floor(i / 3) * 73;
    page.drawRectangle({ x, y: top - 63, width: 163, height: 63, color: pale });
    text(label, x + 9, top - 9, 10, true);
    text(value, x + 9, top - 34, 12, true);
  });
  y -= 160;
  note(`Sleep average uses ${stats.sleepDays} recorded ${stats.sleepDays === 1 ? "day" : "days"}, by wake-up date. -- means not recorded.`);
  note(`Due plans: ${stats.completedPlans} completed | ${stats.missedPlans} not completed | ${stats.unansweredPlans} unanswered.`);

  const chart = (title: string, values: (number | undefined)[], max: number, color: typeof green, mode: "line" | "bars", unit = "") => {
    if (y < 295) nextPage();
    heading(title);
    const top = y, bottom = top - 132, left = 75, plotWidth = 455;
    for (let i = 0; i <= 5; i++) {
      const axisY = bottom + i * 132 / 5;
      page.drawLine({ start: { x: left, y: axisY }, end: { x: left + plotWidth, y: axisY }, thickness: .5, color: line });
      text(`${Number((i * max / 5).toFixed(1))}${unit}`, 42, axisY + 4, 8);
    }
    let previous: { x: number; y: number } | undefined;
    values.forEach((value, i) => {
      const x = left + (i + .5) * plotWidth / 7;
      const label = new Date(`${stats.dates[i]}T12:00`).toLocaleDateString("en-US", { weekday: "short" });
      text(label, x - 12, bottom - 10, 9);
      if (value === undefined) { text("--", x - 4, bottom + 17, 9); previous = undefined; return; }
      const point = { x, y: bottom + value / max * 132 };
      if (mode === "bars") page.drawRectangle({ x: x - 16, y: bottom, width: 32, height: Math.max(.5, point.y - bottom), color });
      else {
        if (previous) page.drawLine({ start: previous, end: point, thickness: 2, color });
        page.drawCircle({ x, y: point.y, size: 3.5, color });
      }
      text(Number(value.toFixed(1)).toString(), x - 7, Math.min(point.y + 15, top + 16), 9, true, color);
      previous = point;
    });
    y = bottom - 40;
  };
  chart("Daily mood (0-10)", stats.daily.map((d) => d.dailyMood), 10, orange, "line");
  chart("Average activity mood (0-10)", stats.daily.map((d) => d.activityMood), 10, green, "line");
  nextPage();
  heading("Activity, sleep and mindfulness");
  chart("Activities completed each day", stats.daily.map((d) => d.activities), Math.max(5, ...stats.daily.map((d) => d.activities)), green, "bars");
  chart("Sleep recorded by wake-up day", stats.daily.map((d) => d.sleepHours), Math.max(10, ...stats.daily.map((d) => d.sleepHours ?? 0)), purple, "bars", "h");
  chart("Mindfulness completed each day", stats.daily.map((d) => d.mindfulness), Math.max(5, ...stats.daily.map((d) => d.mindfulness)), green, "bars");
  nextPage();
  heading("Activities and ratings");
  note("Daily mood and average activity mood are separate measures. Missing ratings are shown as --.");
  note("Sleep blocks are excluded from activity counts. Future plans are excluded from completion rates.");
  const columns = [68, 58, 171, 88, 42, 42, 42];
  const drawRow = (cells: string[], header = false) => {
    const lines = cells.map((cell, i) => wrap(cell, columns[i] - 10));
    const height = Math.max(29, Math.max(...lines.map((part) => part.length)) * 12 + 14);
    if (y - height < 65) { nextPage(); heading("Activities and ratings (continued)"); drawHeader(); }
    page.drawRectangle({ x: 42, y: y - height, width, height, color: header ? pale : rgb(.99, .99, .98) });
    let x = 47;
    lines.forEach((part, i) => { part.forEach((item, j) => text(item, x, y - 6 - j * 12, 9, header)); x += columns[i]; });
    page.drawLine({ start: { x: 42, y: y - height }, end: { x: 553, y: y - height }, thickness: .5, color: line });
    y -= height;
  };
  const drawHeader = () => drawRow(["Date", "Time", "Activity / value", "Status", "Mood", "Enjoy.", "Import."], true);
  drawHeader();
  const rating = (n?: number) => n === undefined ? "--" : String(n);
  for (const entry of [...stats.entries].sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute)) {
    const value = data.values.find((v) => v.id === entry.valueId)?.name || entry.lifeArea;
    drawRow([entry.date, timeLabel(entry.startMinute), `${entry.name}${value ? ` | ${value}` : ""}`,
      entry.source === "logged" ? "Logged" : entry.status === "done" ? "Plan: done" : entry.status === "missed" ? "Plan: not done" : "Scheduled",
      rating(entry.status === "done" ? entry.mood : undefined), rating(entry.status === "done" ? entry.rating : undefined), rating(entry.status === "done" ? entry.importance : undefined)]);
  }
  if (!stats.entries.length) drawRow(["", "", "No activities recorded", "", "", "", ""]);
  pdf.getPages().forEach((item, i, pages) => {
    item.drawText(`${stats.dates[0]} to ${stats.dates[6]} | Weekly report | ${i + 1} / ${pages.length}`, { x: 42, y: 30, font: regular, size: 9, color: ink });
  });
  pdf.setTitle(`Activity Log weekly report ${stats.dates[0]}`);
  return pdf.save();
}
