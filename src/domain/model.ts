import { personalActivity, personalActivities } from "./activities/personal.js";
export type ActivityChoice = { name: string; icon: string };
export type Repeat = "daily" | "weekdays" | "weekly";
export type RecurringActivity = ActivityChoice & {
  id: string; startDate: string; startMinute: number; durationMinutes: number;
  frequency: Repeat; excludedDates: string[]; endDate?: string;
  lifeArea?: LifeArea; valueId?: string;
};
export type Entry = ActivityChoice & {
  id: string;
  date: string;
  startMinute: number;
  durationMinutes?: number;
  seriesId?: string;
  source: "logged" | "scheduled";
  status: "planned" | "done" | "missed";
  lifeArea?: LifeArea;
  valueId?: string;
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
  autoEmailReports: boolean;
  tutorialSeen: boolean;
  values: LifeValue[];
  mindfulness: MindfulnessSession[];
  sleeps: SleepRecord[];
  ratings: Record<string, number>;
  importanceRatings: Record<string, { rating: number; ratedAt: string }>;
  recentActivities: ActivityChoice[];
  myActivities: ActivityChoice[];
  recurringActivities: RecurringActivity[];
  readAloud: boolean;
  pendingSleepStart?: string;
};
export const STORAGE_KEY = "my-day-v2";
export const LEGACY_STORAGE_KEY = "my-day-v1";
export const emptyData = (): Data => ({
  version: 2,
  name: "",
  email: "",
  autoEmailReports: false,
  tutorialSeen: false,
  values: [],
  mindfulness: [],
  sleeps: [],
  entries: {},
  ratings: {},
  importanceRatings: {},
  recentActivities: [],
  myActivities: [],
  recurringActivities: [],
  readAloud: false,
});
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const currentSlot = (d = new Date()) =>
  d.getHours() * 60 + (d.getMinutes() < 30 ? 0 : 30);
export const timeLabel = (minute: number) =>
  `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${minute % 1440 < 720 ? "AM" : "PM"}`;
export const entryEnd = (entry: Pick<Entry, "startMinute" | "durationMinutes">) => entry.startMinute + (entry.durationMinutes ?? 30 - entry.startMinute % 30);
export const entryTimeLabel = (entry: Entry) => entry.durationMinutes === undefined ? timeLabel(entry.startMinute)
  : `${timeLabel(entry.startMinute)} – ${timeLabel(entryEnd(entry))}`;
export function resizeActivity(entry: Entry, edge: "start" | "end", minute: number): Entry {
  const boundary = Math.round(minute / 30) * 30;
  const end = Math.ceil(entryEnd(entry) / 30) * 30;
  const startMinute = edge === "start" ? Math.max(0, Math.min(end - 30, boundary)) : Math.floor(entry.startMinute / 30) * 30;
  const endMinute = edge === "end" ? Math.min(1440, Math.max(startMinute + 30, boundary)) : end;
  return { ...entry, startMinute, durationMinutes: endMinute - startMinute };
}
export const validDuration = (start: number, duration: unknown): duration is number =>
  typeof duration === "number" && Number.isInteger(duration) && duration >= 30 && duration % 30 === 0 && start + duration <= 1440;
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
  v <= 1439;
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
    data.readAloud = d.readAloud === true;
    data.email = typeof d.email === "string" ? d.email : "";
    data.autoEmailReports = d.autoEmailReports === true;
    // Existing accounts predate the tour; only new or unfinished tours auto-open.
    data.tutorialSeen = d.tutorialSeen !== false;
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
    if (d.importanceRatings && typeof d.importanceRatings === "object" && !Array.isArray(d.importanceRatings)) {
      const ratings: [string, { rating: number; ratedAt: string }][] = [];
      for (const [name, cached] of Object.entries<unknown>(d.importanceRatings)) {
        if (cached && typeof cached === "object" && "rating" in cached && "ratedAt" in cached &&
            validRating(cached.rating) && typeof cached.ratedAt === "string" && Number.isFinite(Date.parse(cached.ratedAt))) {
          ratings.push([name, { rating: cached.rating, ratedAt: cached.ratedAt }]);
        }
      }
      data.importanceRatings = Object.fromEntries(ratings);
    }
    for (const [oldKey, value] of Object.entries(d.entries)) {
      const source = value as Entry & { hour?: number };
      if (
        !validChoice(source) ||
        !validDate(source.date) ||
        !["planned", "done", "missed"].includes(source.status)
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
        ...(validDuration(startMinute, source.durationMinutes) ? { durationMinutes: source.durationMinutes } : {}),
        ...(typeof source.seriesId === "string" ? { seriesId: source.seriesId } : {}),
        name: source.name,
        icon: source.icon,
        source: source.source === "scheduled" || source.status !== "done" ? "scheduled" : "logged",
        status: source.status,
        ...(lifeAreas.includes(source.lifeArea!) ? { lifeArea: source.lifeArea } : {}),
        ...(typeof source.valueId === "string" ? { valueId: source.valueId } : {}),
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
    data.myActivities = Array.isArray(d.myActivities) ? d.myActivities.filter(validChoice) : [];
    data.myActivities = personalActivities(data);
    const icons = new Map(data.myActivities.map((choice) => [choice.name.trim().toLocaleLowerCase(), choice.icon]));
    for (const entry of Object.values(data.entries)) entry.icon = icons.get(entry.name.trim().toLocaleLowerCase()) ?? entry.icon;
    data.recentActivities = data.recentActivities.map((choice) => ({ ...choice, icon: icons.get(choice.name.trim().toLocaleLowerCase()) ?? choice.icon }));
    data.values = data.values.map((value) => ({ ...value, activities: value.activities.map((choice) => ({ ...choice, icon: icons.get(choice.name.trim().toLocaleLowerCase()) ?? choice.icon })) }));
    data.recurringActivities = Array.isArray(d.recurringActivities) ? d.recurringActivities.flatMap((item: unknown): RecurringActivity[] => {
      if (!validChoice(item) || !("id" in item) || typeof item.id !== "string" || !item.id ||
        !("startDate" in item) || !validDate(item.startDate) || !("startMinute" in item) || !validMinute(item.startMinute) ||
        !("durationMinutes" in item) || !validDuration(item.startMinute, item.durationMinutes) || !("frequency" in item) ||
        (item.frequency !== "daily" && item.frequency !== "weekdays" && item.frequency !== "weekly")) return [];
      const area = "lifeArea" in item ? lifeAreas.find((area) => area === item.lifeArea) : undefined;
      return [{ id: item.id, name: item.name, icon: icons.get(item.name.trim().toLocaleLowerCase()) ?? item.icon,
        startDate: item.startDate, startMinute: item.startMinute, durationMinutes: item.durationMinutes, frequency: item.frequency,
        excludedDates: "excludedDates" in item && Array.isArray(item.excludedDates) ? item.excludedDates.filter(validDate) : [],
        ...("endDate" in item && validDate(item.endDate) ? { endDate: item.endDate } : {}),
        ...(area ? { lifeArea: area } : {}),
        ...("valueId" in item && typeof item.valueId === "string" ? { valueId: item.valueId } : {}) }];
    }) : [];
    return data;
  } catch {
    return emptyData();
  }
}
export function rememberActivity(data: Data, choice: ActivityChoice): Data {
  choice = personalActivity(data.myActivities, choice);
  return {
    ...data,
    myActivities: data.myActivities.some((item) => item.name.toLocaleLowerCase() === choice.name.toLocaleLowerCase()) ? data.myActivities : [...data.myActivities, choice],
    recentActivities: [
      { name: choice.name, icon: choice.icon },
      ...data.recentActivities.filter(
        (a) => a.name.toLowerCase() !== choice.name.toLowerCase(),
      ),
    ].slice(0, 8),
  };
}
export function saveEntry(data: Data, entry: Entry): Data {
  entry = { ...entry, ...personalActivity(data.myActivities, entry) };
  const values = data.values.map((value) => {
    if (entry.source !== "scheduled" || value.id !== entry.valueId ||
        value.activities.some((activity) => activity.name.trim().toLowerCase() === entry.name.trim().toLowerCase())) return value;
    return { ...value, activities: [...value.activities, { name: entry.name, icon: entry.icon }] };
  });
  return rememberActivity(
    { ...data, entries: { ...data.entries, [entry.id]: entry }, values },
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
export function setScheduledStatus(
  data: Data,
  id: string,
  status: "planned" | "done" | "missed",
  now = new Date(),
): Data {
  const entry = findEntry(data, id);
  if (!entry || entry.source !== "scheduled" || slotDate(entry.date, entry.startMinute) > now)
    return data;
  return saveActivity(data, { ...entry, status });
}
export function completeEntry(data: Data, id: string): Data {
  const entry = findEntry(data, id);
  return entry ? saveEntry(data, { ...entry, status: "done" }) : data;
}
export function entriesInSlot(
  data: Data,
  date: string,
  minute: number,
): Entry[] {
  return entriesOnDate(data, date).filter(
    (entry) => entry.startMinute < minute + 30 && entryEnd(entry) > minute,
  ).sort((a, b) => a.startMinute - b.startMinute || a.name.localeCompare(b.name));
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
    end > now
  )
    throw new Error(
      "Choose a past sleep period of up to 24 hours.",
    );
  if (data.sleeps.some((s) => s.start === record.start && s.end === record.end))
    return data;
  const entries = { ...data.entries };
  for (
    const time = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), Math.floor(start.getMinutes() / 30) * 30);
    time < end;
    time.setMinutes(time.getMinutes() + 30)
  ) {
    const date = dateKey(time),
      startMinute = currentSlot(time);
    if (
      Object.values(entries).some(
        (e) => e.date === date && e.startMinute < startMinute + 30 && entryEnd(e) > startMinute,
      )
    )
      continue;
    const id = `sleep-${record.id}-${date}-${startMinute}`;
    entries[id] = {
      id,
      date,
      startMinute,
      source: "logged",
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
  const removed = findEntry(data, id);
  const entries = { ...data.entries };
  delete entries[id];
  return reconcileSleep({ ...data, entries, recurringActivities: data.recurringActivities.map((rule) =>
    rule.id === removed?.seriesId ? { ...rule, excludedDates: [...new Set([...rule.excludedDates, removed.date])] } : rule) });
}

export function entriesOnDate(data: Data, date: string): Entry[] {
  const entries = Object.values(data.entries).filter((entry) => entry.date === date);
  const day = new Date(`${date}T12:00`).getDay();
  for (const rule of data.recurringActivities) {
    if (date < rule.startDate || (rule.endDate && date > rule.endDate) || rule.excludedDates.includes(date) ||
      (rule.frequency === "weekly" && day !== new Date(`${rule.startDate}T12:00`).getDay()) ||
      (rule.frequency === "weekdays" && (day === 0 || day === 6))) continue;
    const id = `${rule.id}@${date}`;
    if (data.entries[id]) continue;
    entries.push({ id, seriesId: rule.id, date, name: rule.name, icon: rule.icon, startMinute: rule.startMinute,
      durationMinutes: rule.durationMinutes, source: "scheduled", status: "planned", lifeArea: rule.lifeArea, valueId: rule.valueId });
  }
  return entries.sort((a, b) => a.startMinute - b.startMinute || a.name.localeCompare(b.name));
}
export function findEntry(data: Data, id: string): Entry | undefined {
  if (data.entries[id]) return data.entries[id];
  const date = id.slice(-10);
  return validDate(date) ? entriesOnDate(data, date).find((entry) => entry.id === id) : undefined;
}
export function repeatActivity(data: Data, entry: Entry, frequency: Repeat): Data {
  entry = { ...entry, ...personalActivity(data.myActivities, entry) };
  const rule: RecurringActivity = { id: entry.id, name: entry.name, icon: entry.icon, startDate: entry.date,
    startMinute: entry.startMinute, durationMinutes: entry.durationMinutes ?? 30, frequency, excludedDates: [],
    lifeArea: entry.lifeArea, valueId: entry.valueId };
  return saveActivity({ ...data, recurringActivities: [...data.recurringActivities, rule] },
    { ...entry, id: `${rule.id}@${entry.date}`, seriesId: rule.id });
}
export function stopRepeating(data: Data, seriesId: string, date: string): Data {
  const previous = new Date(`${date}T12:00`); previous.setDate(previous.getDate() - 1);
  return { ...data, recurringActivities: data.recurringActivities.map((rule) => rule.id === seriesId ? { ...rule, endDate: dateKey(previous) } : rule),
    entries: Object.fromEntries(Object.entries(data.entries).filter(([, entry]) => entry.seriesId !== seriesId || entry.date < date || entry.status !== "planned")) };
}
