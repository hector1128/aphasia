export type ActivityStep = "activity" | "value" | "day" | "time" | "mood" | "enjoyment" | "importance";
export function activitySteps({ planning, completing, chooseTime, sleep, importanceCached = false, valueLinked = false }: {
  planning: boolean; completing: boolean; chooseTime: boolean; sleep: boolean;
  importanceCached?: boolean; valueLinked?: boolean;
}): ActivityStep[] {
  const ratings: ActivityStep[] = ["mood", "enjoyment", ...(!importanceCached ? ["importance"] as const : [])];
  if (completing) return ratings;
  return ["activity", ...(planning && !valueLinked ? ["value"] as const : []),
    ...(chooseTime ? ["day", "time"] as const : []),
    ...(!planning && !sleep ? ratings : [])];
}
