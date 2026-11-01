export type ActivityStep = "activity" | "value" | "day" | "time" | "mood" | "enjoyment" | "importance" | "duration";
export function activitySteps({ planning, completing, chooseDay = false, sleep, importanceCached = false, valueLinked = false }: {
  planning: boolean; completing: boolean; chooseDay?: boolean; sleep: boolean;
  importanceCached?: boolean; valueLinked?: boolean;
}): ActivityStep[] {
  const ratings: ActivityStep[] = ["mood", "enjoyment", ...(!importanceCached ? ["importance"] as const : [])];
  if (completing) return [...ratings, ...(!sleep ? ["duration"] as const : [])];
  return ["activity", ...(planning && !valueLinked ? ["value"] as const : []),
    ...(planning && chooseDay ? ["day"] as const : []), ...(planning ? ["time"] as const : []),
    ...(!planning && !sleep ? [...ratings, "duration" as const] : [])];
}
