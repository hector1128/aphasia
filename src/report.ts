import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { type Data, type Entry, lifeAreas, timeLabel, dateKey } from "./model";
import { reportData } from "./report-data";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const LEFT = 42;
const RIGHT = PAGE_W - LEFT;
const CONTENT = RIGHT - LEFT;
const BOTTOM = 58;
const ink = rgb(0.14, 0.23, 0.20);
const muted = rgb(0.39, 0.45, 0.42);
const green = rgb(0.21, 0.42, 0.29);
const paleGreen = rgb(0.90, 0.95, 0.89);
const paleOrange = rgb(0.98, 0.94, 0.88);
const palePurple = rgb(0.95, 0.92, 0.98);
const line = rgb(0.84, 0.87, 0.84);
const missing = "Not completed";
const score = (n?: number) => n === undefined ? missing : `${n}/10`;
const localDate = (iso: string) => {
  const value = new Date(iso);
  return `${dateKey(value)} ${timeLabel(value.getHours() * 60 + value.getMinutes())}`;
};

export async function buildReportPdf(data: Data, date: string): Promise<Uint8Array> {
  const snapshot = reportData(data, date);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());
  const clean = (value: string) => [...value.replace(/[–—]/g, "-")]
    .map((character) => supported.has(character.codePointAt(0)!) ? character : "?")
    .join("");
  const wrap = (value: string, font: PDFFont, size: number, width: number): string[] => {
    const words = clean(value).split(/\s+/).filter(Boolean);
    const result: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) result.push(current);
      current = "";
      for (const character of word) {
        if (font.widthOfTextAtSize(current + character, size) > width && current) {
          result.push(current);
          current = "";
        }
        current += character;
      }
    }
    if (current) result.push(current);
    return result.length ? result : [""];
  };
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 46;
    page.drawRectangle({ x: 0, y: PAGE_H - 12, width: PAGE_W, height: 12, color: paleGreen });
  };
  const ensure = (height: number) => {
    if (y - height < BOTTOM) newPage();
  };
  const text = (value: string, x: number, top: number, size = 10, weight: "regular" | "bold" = "regular", color = ink) => {
    page.drawText(clean(value), { x, y: top - size, size, font: weight === "bold" ? bold : regular, color });
  };
  const paragraph = (value: string, x = LEFT, width = CONTENT, size = 10, color = ink, weight: "regular" | "bold" = "regular") => {
    const font = weight === "bold" ? bold : regular;
    const lines = wrap(value, font, size, width);
    ensure(lines.length * (size + 4) + 4);
    for (const item of lines) {
      text(item, x, y, size, weight, color);
      y -= size + 4;
    }
    y -= 4;
  };
  const section = (title: string, tint = paleGreen, nextContentHeight = 0) => {
    ensure(43 + nextContentHeight);
    y -= 9;
    page.drawRectangle({ x: LEFT, y: y - 27, width: CONTENT, height: 30, color: tint });
    text(title, LEFT + 10, y - 1, 13, "bold");
    y -= 40;
  };
  const table = (columns: { label: string; width: number }[], rows: string[][]) => {
    const sizes = columns.map((column) => column.width);
    const drawHeader = () => {
      ensure(29);
      page.drawRectangle({ x: LEFT, y: y - 28, width: CONTENT, height: 28, color: paleGreen });
      let x = LEFT + 7;
      columns.forEach((column) => {
        text(column.label, x, y - 5, 9, "bold", green);
        x += column.width;
      });
      y -= 28;
    };
    drawHeader();
    if (!rows.length) rows = [[missing, ...columns.slice(1).map(() => "")]];
    rows.forEach((row, index) => {
      const lines = row.map((cell, i) => wrap(cell, regular, 9, sizes[i] - 13));
      const height = Math.max(30, Math.max(...lines.map((part) => part.length)) * 12 + 12);
      if (y - height < BOTTOM) {
        newPage();
        drawHeader();
      }
      if (index % 2) page.drawRectangle({ x: LEFT, y: y - height, width: CONTENT, height, color: rgb(0.975, 0.98, 0.97) });
      let x = LEFT + 7;
      lines.forEach((part, i) => {
        part.forEach((item, j) => text(item, x, y - 6 - j * 12, 9));
        x += sizes[i];
      });
      page.drawLine({ start: { x: LEFT, y: y - height }, end: { x: RIGHT, y: y - height }, thickness: 0.6, color: line });
      y -= height;
    });
    y -= 10;
  };
  const entries = Object.values(snapshot.entries)
    .filter((entry) => !entry.sleepId && !entry.sleepBoundary)
    .sort((a, b) => a.startMinute - b.startMinute || a.name.localeCompare(b.name));
  const done = entries.filter((entry) => entry.status === "done");
  const planned = entries.filter((entry) => entry.status === "planned");
  const rated = done.filter((entry) => entry.rating !== undefined);
  const sessions = snapshot.mindfulness;
  const completedSessions = sessions.filter((session) => session.status === "completed");
  const average = (values: number[]) => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;
  const avgEnjoyment = average(rated.map((entry) => entry.rating!));
  const avgMood = average(done.filter((entry) => entry.mood !== undefined).map((entry) => entry.mood!));
  const avgImportance = average(done.filter((entry) => entry.importance !== undefined).map((entry) => entry.importance!));

  newPage();
  text("ACTIVITY LOG", LEFT, y, 11, "bold", green);
  y -= 24;
  paragraph("Daily report", LEFT, CONTENT, 25, ink, "bold");
  paragraph(`${date}  |  ${snapshot.name || "Name not provided"}`, LEFT, CONTENT, 11, muted);
  y -= 5;
  const cardW = (CONTENT - 16) / 3;
  const cards = [
    { label: "Activities done", value: String(done.length), color: paleGreen },
    { label: "Still planned", value: String(planned.length), color: paleOrange },
    { label: "Mindfulness done", value: String(completedSessions.length), color: palePurple },
  ];
  cards.forEach((card, i) => {
    const x = LEFT + i * (cardW + 8);
    page.drawRectangle({ x, y: y - 68, width: cardW, height: 68, color: card.color });
    text(card.value, x + 11, y - 9, 21, "bold");
    text(card.label, x + 11, y - 44, 10);
  });
  y -= 82;
  section("Ratings at a glance", paleOrange);
  const chart = [
    ["Day mood", snapshot.ratings[date]],
    ["Activity mood", avgMood],
    ["Enjoyment", avgEnjoyment],
    ["Importance", avgImportance],
  ] as const;
  for (const [label, value] of chart) {
    ensure(39);
    text(label, LEFT, y, 10, "bold");
    const barX = LEFT + 125;
    const barW = CONTENT - 225;
    page.drawRectangle({ x: barX, y: y - 18, width: barW, height: 12, color: rgb(0.92, 0.93, 0.91) });
    if (value !== undefined) page.drawRectangle({ x: barX, y: y - 18, width: barW * value / 10, height: 12, color: green });
    text(value === undefined ? missing : `${value.toFixed(value % 1 ? 1 : 0)}/10`, barX + barW + 10, y - 1, 10, "bold");
    y -= 39;
  }
  paragraph("Activity averages use completed activities with a rating. Missing ratings are shown as not completed.", LEFT, CONTENT, 9, muted);

  section("Activities and ratings", paleGreen, 70);
  table(
    [{ label: "Time", width: 74 }, { label: "Activity", width: 177 }, { label: "Status", width: 76 }, { label: "Mood", width: 61 }, { label: "Enjoy.", width: 62 }, { label: "Value", width: 61 }],
    entries.map((entry: Entry) => [timeLabel(entry.startMinute), entry.name, entry.status === "done" ? "Done" : "Planned", score(entry.mood), score(entry.rating), score(entry.importance)]),
  );

  section("Sleep", palePurple, 70);
  const sleepRows = snapshot.sleeps.map((sleep) => {
    const hours = (new Date(sleep.end).getTime() - new Date(sleep.start).getTime()) / 3_600_000;
    return [localDate(sleep.start), localDate(sleep.end), `${hours.toFixed(hours % 1 ? 1 : 0)} hours`];
  });
  table([{ label: "From", width: 190 }, { label: "To", width: 190 }, { label: "Duration", width: 133 }], sleepRows);

  section("Mindfulness", palePurple, 70);
  table(
    [{ label: "Activity", width: 270 }, { label: "Completed", width: 120 }, { label: "Started", width: 123 }],
    ([
      ["Breathing", "breathing"],
      ["Visualization", "visualization"],
      ["Gentle stretching", "stretching"],
    ] as const).map(([label, kind]) => {
      const matching = sessions.filter((session) => session.kind === kind);
      return [label, matching.filter((session) => session.status === "completed").length.toString(), matching.filter((session) => session.status === "started").length.toString()];
    }),
  );
  paragraph("Video activity completion is self-reported.", LEFT, CONTENT, 9, muted);

  section("Patterns in today's entries", paleOrange, 62);
  if (done.length) {
    const counts = new Map<string, number>();
    done.forEach((entry) => counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1));
    const most = Math.max(...counts.values());
    paragraph(`Most frequent: ${[...counts].filter(([, count]) => count === most).map(([name]) => name).join(", ")} (${most} ${most === 1 ? "time" : "times"})`);
  } else paragraph(`Most frequent: ${missing}`);
  if (rated.length) {
    const highest = Math.max(...rated.map((entry) => entry.rating!));
    paragraph(`Highest enjoyment: ${rated.filter((entry) => entry.rating === highest).map((entry) => entry.name).join(", ")} (${highest}/10)`);
  } else paragraph(`Highest enjoyment: ${missing}`);
  paragraph("Patterns describe recorded activities only. They are not a clinical interpretation.", LEFT, CONTENT, 9, muted);

  section("Life areas and values", palePurple, 65);
  for (const area of lifeAreas) {
    ensure(42);
    paragraph(area, LEFT, CONTENT, 12, green, "bold");
    const values = snapshot.values.filter((value) => value.area === area);
    if (!values.length) {
      paragraph(missing, LEFT + 10, CONTENT - 10, 10, muted);
      continue;
    }
    for (const value of values) {
      ensure(57);
      paragraph(value.name, LEFT + 10, CONTENT - 10, 10, ink, "bold");
      paragraph(`Linked activities: ${value.activities.length ? value.activities.map((activity) => activity.name).join(", ") : missing}`, LEFT + 18, CONTENT - 18, 9);
      const linked = value.activities.filter((activity) => done.some((entry) => entry.name.toLowerCase() === activity.name.toLowerCase()));
      paragraph(`Done today: ${linked.length ? linked.map((activity) => activity.name).join(", ") : missing}`, LEFT + 18, CONTENT - 18, 9, muted);
    }
  }
  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: LEFT, y: 48 }, end: { x: RIGHT, y: 48 }, thickness: 0.7, color: line });
    current.drawText(clean(`${date}  |  Activity Log`), { x: LEFT, y: 30, font: regular, size: 9, color: muted });
    const pageText = `Page ${index + 1} of ${pages.length}`;
    current.drawText(pageText, { x: RIGHT - regular.widthOfTextAtSize(pageText, 9), y: 30, font: regular, size: 9, color: muted });
  });
  pdf.setTitle(`Activity Log daily report ${date}`);
  return pdf.save();
}
