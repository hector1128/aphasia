import {
  Footprints,
  BookOpen,
  Utensils,
  Users,
  Coffee,
  Palette,
  Puzzle,
  House,
  Bath,
  ShoppingBag,
  HeartPulse,
  BriefcaseBusiness,
} from "lucide-react";
import { sleepBoundary } from "./model";

const illustrations: Record<string, string> = {
  walk: "/illustrations/walk.svg",
  read: "/illustrations/read.svg",
  eat: "/illustrations/eat.svg",
  friends: "/illustrations/friends.svg",
  music: "/illustrations/music.svg",
  rest: "/illustrations/mindfulness.svg",
  art: "/illustrations/art.svg",
  game: "/illustrations/game.svg",
  home: "/illustrations/home.svg",
  health: "/illustrations/health.svg",
  work: "/illustrations/work.svg",
  cooking: "/illustrations/cooking.svg",
  groceries: "/illustrations/shopping.svg",
  mindfulness: "/illustrations/mindfulness.svg",
  sleep: "/illustrations/sleep.svg",
};
const icons: Record<string, typeof Footprints> = {
  walk: Footprints,
  read: BookOpen,
  eat: Utensils,
  friends: Users,
  rest: Coffee,
  art: Palette,
  game: Puzzle,
  home: House,
  care: Bath,
  out: ShoppingBag,
  health: HeartPulse,
  work: BriefcaseBusiness,
};
export function hasActivityIcon(id: string, name = ""): boolean {
  return Boolean(
    sleepBoundary(name) ||
    /\b(groceries|grocery)\b/i.test(name) ||
    illustrations[id] ||
    icons[id],
  );
}

export function ActivityIcon({ id, size = 32, name = "" }: { id: string; size?: number; name?: string }) {
  const illustration = sleepBoundary(name)
    ? "/illustrations/sleep.svg"
    : id === "eat" && /\b(cook|cooking|bake|baking)\b/i.test(name)
      ? "/illustrations/cooking.svg"
      : /\b(groceries|grocery)\b/i.test(name)
        ? "/illustrations/shopping.svg"
        : illustrations[id];
  if (illustration)
    return (
      <img
        className="activity-illustration"
        src={illustration}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
      />
    );
  const Icon = icons[id];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
