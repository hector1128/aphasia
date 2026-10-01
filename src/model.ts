export type ActivityChoice = { name: string; icon: string };
export type Entry = ActivityChoice & {
  id: string;
  date: string;
  startMinute: number;
  status: "planned" | "done";
  mood?: number;
  rating?: number;
  importance?: number;
  sleepId?: string;
  sleepBoundary?: "sleep" | "wake";
};
export type Data = {
  version: 2;
  name: string;
  entries: Record<string, Entry>;
  email: string;
  values: LifeValue[];
  mindfulness: MindfulnessSession[];
  sleeps: SleepRecord[];
  ratings: Record<string, number>;
  recentActivities: ActivityChoice[];
  pendingSleepStart?: string;
};
export const STORAGE_KEY = "my-day-v2";
export const LEGACY_STORAGE_KEY = "my-day-v1";
export const emptyData = (): Data => ({
  version: 2,
  name: "",
  email: "",
  values: [],
  mindfulness: [],
  sleeps: [],
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
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10;
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
    data.email = typeof d.email === "string" ? d.email : "";
    if (typeof d.pendingSleepStart === "string" && Number.isFinite(Date.parse(d.pendingSleepStart)))
      data.pendingSleepStart = d.pendingSleepStart;
    data.values = Array.isArray(d.values)
      ? d.values
          .filter(
            (v: LifeValue) =>
              v &&
              typeof v.id === "string" &&
              lifeAreas.includes(v.area) &&
              typeof v.name === "string" &&
              Array.isArray(v.activities),
          )
          .map((v: LifeValue) => ({
            ...v,
            activities: v.activities.filter(validChoice),
          }))
      : [];
    data.mindfulness = Array.isArray(d.mindfulness)
      ? d.mindfulness.filter(
          (v: MindfulnessSession) =>
            v &&
            typeof v.id === "string" &&
            validDate(v.date) &&
            ["breathing", "visualization", "stretching"].includes(v.kind) &&
            ["completed", "started"].includes(v.status),
        )
      : [];
    data.sleeps = Array.isArray(d.sleeps)
      ? d.sleeps.filter(
          (v: SleepRecord) =>
            v &&
            typeof v.id === "string" &&
            Number.isFinite(Date.parse(v.start)) &&
            Number.isFinite(Date.parse(v.end)) &&
            Date.parse(v.end) > Date.parse(v.start),
        )
      : [];
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
        ...(validRating(source.importance)
          ? { importance: source.importance }
          : {}),
        ...(typeof source.sleepId === "string"
          ? { sleepId: source.sleepId }
          : {}),
        ...(source.sleepBoundary === "sleep" || source.sleepBoundary === "wake"
          ? { sleepBoundary: source.sleepBoundary }
          : {}),
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
export function sleepBoundary(name: string): "sleep" | "wake" | undefined {
  const text = name.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(wake|wakes|waking|woke|awake|awaken\w*|arise|arose|get up|getting up|got up|gotten up|out of bed)\b/.test(text)) return "wake";
  if (/\b(sleep|sleeping|slept|asleep|bedtime|nap|napping|resting for the night|go to bed|going to bed|went to bed|fall asleep|falling asleep|fell asleep|turn in)\b/.test(text)) return "sleep";
  return undefined;
}
export function saveActivity(data: Data, entry: Entry): Data {
  const existing = data.entries[entry.id];
  const boundary =
    entry.status === "done" ? sleepBoundary(entry.name) : undefined;
  const cleanEntry = { ...entry };
  if (boundary) cleanEntry.sleepBoundary = boundary;
  else delete cleanEntry.sleepBoundary;
  const trackedBoundary = boundary || existing?.sleepBoundary || entry.sleepBoundary;
  let next = trackedBoundary
    ? { ...data, entries: { ...data.entries, [entry.id]: cleanEntry } }
    : saveEntry(data, cleanEntry);
  if (trackedBoundary || entry.sleepId)
    next = reconcileSleep(next);
  return next;
}
export function toggleEntryStatus(data: Data, id: string): Data {
  const entry = data.entries[id];
  if (!entry || entry.sleepId) return data;
  return saveActivity(data, {
    ...entry,
    status: entry.status === "done" ? "planned" : "done",
  });
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

export const lifeAreas = [
  "Personal relationships",
  "Mind/body/spirit",
  "Education/career",
  "Recreation/interests",
  "Daily responsibilities",
] as const;
export type LifeArea = (typeof lifeAreas)[number];
export type LifeValue = {
  id: string;
  area: LifeArea;
  name: string;
  activities: ActivityChoice[];
};
export type MindfulnessSession = {
  id: string;
  date: string;
  kind: "breathing" | "visualization" | "stretching";
  status: "started" | "completed";
};
export type SleepRecord = {
  id: string;
  start: string;
  end: string;
  startEntryId?: string;
  endEntryId?: string;
};
export function addSleep(
  data: Data,
  record: SleepRecord,
  now = new Date(),
): Data {
  const start = new Date(record.start),
    end = new Date(record.end);
  const duration = end.getTime() - start.getTime();
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 24 * 60 * 60 * 1000 ||
    end > now ||
    start.getMinutes() % 30 ||
    end.getMinutes() % 30
  )
    throw new Error(
      "Choose a past sleep period of up to 24 hours, in 30-minute steps.",
    );
  if (data.sleeps.some((s) => s.start === record.start && s.end === record.end))
    return data;
  const entries = { ...data.entries };
  for (
    const time = new Date(start);
    time < end;
    time.setMinutes(time.getMinutes() + 30)
  ) {
    const date = dateKey(time),
      startMinute = currentSlot(time);
    if (
      Object.values(entries).some(
        (e) => e.date === date && e.startMinute === startMinute,
      )
    )
      continue;
    const id = `sleep-${record.id}-${date}-${startMinute}`;
    entries[id] = {
      id,
      date,
      startMinute,
      status: "done",
      name: "Sleeping",
      icon: "rest",
      sleepId: record.id,
    };
  }
  return { ...data, entries, sleeps: [...data.sleeps, record] };
}
export function removeSleep(data: Data, id: string): Data {
  return {
    ...data,
    sleeps: data.sleeps.filter((s) => s.id !== id),
    entries: Object.fromEntries(
      Object.entries(data.entries).filter(([, e]) => e.sleepId !== id),
    ),
  };
}
function reconcileSleep(data: Data, now = new Date()): Data {
  const automaticIds = new Set(
    data.sleeps
      .filter((sleep) => sleep.endEntryId || sleep.id.startsWith("sleep-"))
      .map((sleep) => sleep.id),
  );
  const entries = Object.fromEntries(
    Object.entries(data.entries).filter(([, entry]) => !entry.sleepId || !automaticIds.has(entry.sleepId)),
  );
  let next: Data = {
    ...data,
    entries,
    sleeps: data.sleeps.filter((sleep) => !automaticIds.has(sleep.id)),
  };
  const markers = Object.values(entries)
    .filter((entry) => entry.status === "done" && sleepBoundary(entry.name))
    .sort((a, b) => slotDate(a.date, a.startMinute).getTime() - slotDate(b.date, b.startMinute).getTime());
  let start: Entry | undefined;
  for (const marker of markers) {
    if (sleepBoundary(marker.name) === "sleep") {
      start = marker;
      continue;
    }
    if (!start) continue;
    const first = slotDate(start.date, start.startMinute);
    const last = slotDate(marker.date, marker.startMinute);
    const duration = last.getTime() - first.getTime();
    if (duration <= 0 || duration > 24 * 60 * 60 * 1000 || last > now) continue;
    next = addSleep(
      next,
      {
        id: `sleep-${marker.id}`,
        start: first.toISOString(),
        end: last.toISOString(),
        startEntryId: start.id,
        endEntryId: marker.id,
      },
      now,
    );
    start = undefined;
  }
  const { pendingSleepStart: _old, ...withoutPending } = next;
  return start
    ? { ...withoutPending, pendingSleepStart: slotDate(start.date, start.startMinute).toISOString() }
    : withoutPending;
}
export function removeEntry(data: Data, id: string): Data {
  const entries = { ...data.entries };
  delete entries[id];
  return reconcileSleep({ ...data, entries });
}
export function suggestedActivities(data: Data): ActivityChoice[] {
  const ranked = new Map<string, { choice: ActivityChoice; score: number }>();
  for (const e of Object.values(data.entries)) {
    if (e.status !== "done" || e.sleepId || e.sleepBoundary) continue;
    const key = e.name.toLowerCase(),
      prev = ranked.get(key);
    const score = (e.rating ?? 0) + (e.importance ?? 0) / 2;
    if (!prev || score > prev.score)
      ranked.set(key, { choice: { name: e.name, icon: e.icon }, score });
  }
  for (const v of data.values)
    for (const a of v.activities) {
      const key = a.name.toLowerCase(),
        prev = ranked.get(key);
      ranked.set(key, { choice: a, score: (prev?.score ?? 0) + 5 });
    }
  return [...ranked.values()]
    .sort(
      (a, b) => b.score - a.score || a.choice.name.localeCompare(b.choice.name),
    )
    .slice(0, 6)
    .map((r) => r.choice);
}
