import {
  Footprints,
  BookOpen,
  Utensils,
  Users,
  Music,
  Coffee,
  Pencil,
  Palette,
  Puzzle,
  House,
  Bath,
  ShoppingBag,
  HeartPulse,
  BriefcaseBusiness,
} from "lucide-react";
const icons: Record<string, typeof Pencil> = {
  walk: Footprints,
  read: BookOpen,
  eat: Utensils,
  friends: Users,
  music: Music,
  rest: Coffee,
  custom: Pencil,
  art: Palette,
  game: Puzzle,
  home: House,
  care: Bath,
  out: ShoppingBag,
  health: HeartPulse,
  work: BriefcaseBusiness,
};
export function ActivityIcon({ id, size = 32 }: { id: string; size?: number }) {
  const Icon = icons[id] || Pencil;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
