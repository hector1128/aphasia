export type ActivityStep = "activity" | "value" | "day" | "time" | "mood" | "enjoyment" | "importance";
export function activitySteps({ planning, completing, chooseTime, sleep }: {
  planning: boolean; completing: boolean; chooseTime: boolean; sleep: boolean;
}): ActivityStep[] {
  if (completing) return ["mood", "enjoyment", "importance"];
  return ["activity", ...(planning ? ["value"] as const : []),
    ...(chooseTime ? ["day", "time"] as const : []),
    ...(!planning && !sleep ? ["mood", "enjoyment", "importance"] as const : [])];
}
