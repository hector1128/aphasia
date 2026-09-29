export type ActivityChoice = { name: string; icon: string };
export type Entry = ActivityChoice & {
  id: string;
  date: string;
  startMinute: number;
  status: "planned" | "done";
  mood?: number;
  rating?: number;
};
export type Data = {
  version: 2;
  name: string;
  entries: Record<string, Entry>;
  // Retained for the temporarily hidden daily mood feature.
  ratings: Record<string, number>;
  recentActivities: ActivityChoice[];
};
export const STORAGE_KEY = "my-day-v2";
export const LEGACY_STORAGE_KEY = "my-day-v1";
export const emptyData = (): Data => ({
  version: 2,
  name: "",
  entries: {},
  ratings: {},
  recentActivities: [],
});
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const currentSlot = (d = new Date()) =>
  d.getHours() * 60 + (d.getMinutes() < 30 ? 0 : 30);
export const timeLabel = (minute: number) =>
  `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${minute < 720 ? "AM" : "PM"}`;
export const slotDate = (date: string, minute: number) =>
  new Date(
    `${date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00`,
  );
export const validRating = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10;
export const validMinute = (v: unknown): v is number =>
  typeof v === "number" &&
  Number.isInteger(v) &&
  v >= 0 &&
  v <= 1410 &&
  v % 30 === 0;
const validDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(new Date(`${v}T12:00`).getTime()) &&
  dateKey(new Date(`${v}T12:00`)) === v;
const validChoice = (v: unknown): v is ActivityChoice =>
  !!v &&
  typeof v === "object" &&
  typeof (v as ActivityChoice).name === "string" &&
  !!(v as ActivityChoice).name.trim() &&
  typeof (v as ActivityChoice).icon === "string";
export function readData(raw: string | null): Data {
  try {
    const d = JSON.parse(raw || "null");
    if (
      ![1, 2].includes(d?.version) ||
      typeof d.name !== "string" ||
      !d.entries ||
      typeof d.entries !== "object"
    )
      return emptyData();
    const data = emptyData();
    data.name = d.name;
    data.ratings = Object.fromEntries(
      Object.entries(d.ratings || {}).filter(
        ([date, value]) => validDate(date) && validRating(value),
      ),
    ) as Record<string, number>;
    for (const [oldKey, value] of Object.entries(d.entries)) {
      const source = value as Entry & { hour?: number };
      if (
        !validChoice(source) ||
        !validDate(source.date) ||
        !["planned", "done"].includes(source.status)
      )
        continue;
      const startMinute =
        d.version === 1 ? (source.hour ?? -1) * 60 : source.startMinute;
      if (!validMinute(startMinute)) continue;
      const id = d.version === 1 ? `legacy-${oldKey}` : source.id;
      if (typeof id !== "string" || !id || (d.version === 2 && id !== oldKey))
        continue;
      data.entries[id] = {
        id,
        date: source.date,
        startMinute,
        name: source.name,
        icon: source.icon,
        status: source.status,
        ...(validRating(source.rating) ? { rating: source.rating } : {}),
        ...(validRating(source.mood) ? { mood: source.mood } : {}),
      };
    }
    const choices: ActivityChoice[] = Array.isArray(d.recentActivities)
      ? d.recentActivities.filter(validChoice)
      : Object.values(data.entries).sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.startMinute - a.startMinute,
        );
    data.recentActivities = choices
      .reduce<
        ActivityChoice[]
      >((result, choice) => (result.some((c) => c.name.toLowerCase() === choice.name.toLowerCase()) ? result : [...result, { name: choice.name, icon: choice.icon }]), [])
      .slice(0, 8);
    return data;
  } catch {
    return emptyData();
  }
}
export function rememberActivity(data: Data, choice: ActivityChoice): Data {
  return {
    ...data,
    recentActivities: [
      { name: choice.name, icon: choice.icon },
      ...data.recentActivities.filter(
        (a) => a.name.toLowerCase() !== choice.name.toLowerCase(),
      ),
    ].slice(0, 8),
  };
}
export function saveEntry(data: Data, entry: Entry): Data {
  return rememberActivity(
    { ...data, entries: { ...data.entries, [entry.id]: entry } },
    entry,
  );
}
export function completeEntry(data: Data, id: string): Data {
  const entry = data.entries[id];
  return entry ? saveEntry(data, { ...entry, status: "done" }) : data;
}
export function entriesInSlot(
  data: Data,
  date: string,
  minute: number,
): Entry[] {
  return Object.values(data.entries).filter(
    (entry) => entry.date === date && entry.startMinute === minute,
  );
}
