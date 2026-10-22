import { catalogueActivity } from "./activity-catalogue";
import type { Data } from "./model";

const importanceKey = (name: string) => (catalogueActivity(name)?.name ?? name).trim().toLowerCase();
const twoWeeks = 14 * 24 * 60 * 60 * 1000;

export function cachedImportance(data: Data, name: string, now = new Date()): number | undefined {
  const cached = data.importanceRatings[importanceKey(name)];
  if (!cached) return undefined;
  const age = now.getTime() - Date.parse(cached.ratedAt);
  return age >= 0 && age < twoWeeks ? cached.rating : undefined;
}

export function rememberImportance(data: Data, name: string, rating: number, now = new Date()): Data {
  return { ...data, importanceRatings: { ...data.importanceRatings,
    [importanceKey(name)]: { rating, ratedAt: now.toISOString() } } };
}
