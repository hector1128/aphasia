import { catalogueActivity } from "./activity-catalogue";
import type { Data } from "./model";

const importanceKey = (name: string) => (catalogueActivity(name)?.name ?? name).trim().toLowerCase();
const twoWeeks = 14 * 24 * 60 * 60 * 1000;

export function cachedImportance(data: Data, name: string, now = new Date()): number | undefined {
  const key = importanceKey(name);
  // Reuse a rating stored under an older equivalent name without renewing it.
  const cached = data.importanceRatings[key] ?? Object.entries(data.importanceRatings)
    .find(([storedName]) => importanceKey(storedName) === key)?.[1];
  if (!cached) return undefined;
  const age = now.getTime() - Date.parse(cached.ratedAt);
  return age >= 0 && age < twoWeeks ? cached.rating : undefined;
}

export function rememberImportance(data: Data, name: string, rating: number, now = new Date()): Data {
  return { ...data, importanceRatings: { ...data.importanceRatings,
    [importanceKey(name)]: { rating, ratedAt: now.toISOString() } } };
}
