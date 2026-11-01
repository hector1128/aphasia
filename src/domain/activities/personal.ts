import type { ActivityChoice, Data } from "../model.js";
import { catalogueActivity, searchableActivities } from "./catalogue.js";

export const customShapes = ["shape-circle", "shape-triangle", "shape-square", "shape-diamond", "shape-hexagon", "shape-pentagon"] as const;
const key = (name: string) => name.trim().toLocaleLowerCase();
export function personalActivity(known: ActivityChoice[], choice: ActivityChoice): ActivityChoice {
  const saved = known.find((item) => key(item.name) === key(choice.name));
  if (saved) return { ...saved, name: choice.name.trim() };
  const library = catalogueActivity(choice.name) ?? searchableActivities.find((item) => key(item.name) === key(choice.name));
  return { name: choice.name.trim(), icon: library?.icon ?? customShapes[known.filter((item) => item.icon.startsWith("shape-")).length % customShapes.length] };
}
export function personalActivities(data: Pick<Data, "myActivities" | "recentActivities" | "entries" | "values">): ActivityChoice[] {
  const result: ActivityChoice[] = [];
  for (const choice of [...data.myActivities, ...Object.values(data.entries).filter((entry) => !entry.sleepId && !entry.sleepBoundary), ...data.values.flatMap((value) => value.activities), ...data.recentActivities]) {
    if (!choice.name.trim() || result.some((item) => key(item.name) === key(choice.name))) continue;
    result.push(choice.icon.startsWith("shape-") ? { name: choice.name, icon: choice.icon } : personalActivity(result, choice));
  }
  return result;
}
