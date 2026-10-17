import { HeartHandshake, Brain, GraduationCap, Palette, ListChecks } from "lucide-react";
import type { LifeArea } from "./model";

const areaIcons = {
  "Personal relationships": HeartHandshake,
  "Mind/body/spirit": Brain,
  "Education/career": GraduationCap,
  "Recreation/interests": Palette,
  "Daily responsibilities": ListChecks,
} satisfies Record<LifeArea, typeof HeartHandshake>;

export const areaLabel = (area: LifeArea) => area.replaceAll("/", " | ");

export function AreaIcon({ area }: { area: LifeArea }) {
  const Icon = areaIcons[area];
  return <Icon size={30} aria-hidden="true" />;
}
