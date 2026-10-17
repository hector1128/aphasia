import { activities } from "./activities";
import type { ActivityChoice, Data, LifeArea } from "./model";

type CatalogueActivity = ActivityChoice & {
  areas: LifeArea[];
  features: string[];
  aliases: string[];
  relatedNames?: string[];
};

// ponytail: curated graph for 21 main choices; extend these edges as the catalogue grows.
// Activity-to-feature edges. Life areas are broad connections; features describe
// what people actually do, independently of the artwork used for the activity.
export const mainActivities: CatalogueActivity[] = [
  { name: "Sleep", icon: "sleep", areas: ["Mind/body/spirit"], features: ["rest", "routine"], aliases: ["Sleeping", "Went to bed", "Getting ready for bed"] },
  { name: "Wake up", icon: "sleep", areas: ["Mind/body/spirit"], features: ["routine"], aliases: ["Waking up", "Woke up", "Getting up"] },
  { name: "Getting ready", icon: "care", areas: ["Daily responsibilities"], features: ["self-care", "routine"], aliases: ["Getting dressed", "Taking a shower", "Taking a bath", "Brushing teeth", "Washing hands", "Brushing hair", "Shaving", "Doing skin care", "Getting a haircut"] },
  { name: "Eat a meal", icon: "eat", areas: ["Daily responsibilities"], features: ["food", "routine"], aliases: ["Eating", "Breakfast", "Lunch", "Dinner", "Having a snack", "Eating at a restaurant"] },
  { name: "Call | On the phone", icon: "phone", areas: ["Personal relationships"], features: ["connection", "communication"], aliases: ["Call/On the phone", "Calling a friend", "Calling family", "Video calling", "Talking on the phone"] },
  { name: "Exercise | Fitness activity", icon: "health", areas: ["Mind/body/spirit", "Recreation/interests"], features: ["movement", "outdoors"], aliases: ["Exercise/Fitness activity", "Walking", "Walking in the park", "Walking with a friend", "Going for a stroll", "Hiking", "Swimming", "Riding a bicycle", "Chair exercises", "Gentle stretching", "Dancing"] },
  { name: "Taking care of pets", icon: "pets", areas: ["Daily responsibilities", "Personal relationships"], features: ["caregiving", "movement", "companionship"], aliases: ["Walking the dog", "Feeding a pet", "Brushing a pet"] },
  { name: "On the computer", icon: "computer", areas: ["Education/career", "Recreation/interests"], features: ["technology", "learning", "communication"], aliases: ["Using a computer", "Sending an email", "Reading messages"] },
  { name: "Go shopping", icon: "groceries", areas: ["Daily responsibilities"], features: ["errands", "food", "outdoors"], aliases: ["Shopping", "Buying groceries", "Going to the market", "Walking to the shop", "Making a shopping list"] },
  { name: "Read", icon: "read", areas: ["Recreation/interests", "Education/career"], features: ["quiet", "learning", "language"], aliases: ["Reading", "Reading a book", "Reading a newspaper", "Reading a magazine", "Reading poetry", "Listening to an audiobook", "Visiting the library"] },
  { name: "Spending time with loved ones", icon: "friends", areas: ["Personal relationships"], features: ["connection", "companionship", "communication"], aliases: ["Seeing friends", "Visiting family", "Talking with a neighbor", "Having visitors", "Meeting a friend", "Spending time with a partner", "Playing with grandchildren", "Celebrating a birthday"] },
  { name: "Cook", icon: "cooking", areas: ["Daily responsibilities", "Recreation/interests"], features: ["food", "creativity", "self-care"], aliases: ["Cooking", "Baking", "Making a sandwich", "Preparing vegetables", "Setting the table"] },
  { name: "Write in journal", icon: "journal", areas: ["Mind/body/spirit", "Recreation/interests"], features: ["quiet", "reflection", "language", "creativity"], aliases: ["Writing in a journal", "Journaling", "Writing a letter", "Writing a card"] },
  { name: "Practicing mindfulness", icon: "mindfulness", areas: ["Mind/body/spirit"], features: ["quiet", "reflection", "rest"], aliases: ["Meditation", "Breathing practice", "Mindfulness"], relatedNames: ["Resting", "Taking a break", "Listening to nature", "Watching the sunset", "Sitting in the garden", "Sitting outside", "Looking out the window"] },
  { name: "Watch TV", icon: "game", areas: ["Recreation/interests"], features: ["entertainment", "quiet", "technology"], aliases: ["Watching television", "Watching TV", "Watching a film", "Watching sports", "Watching a concert"] },
  { name: "Cleaning | Doing chores", icon: "home", areas: ["Daily responsibilities"], features: ["home", "routine", "movement"], aliases: ["Cleaning/Doing chores", "Cleaning", "Washing dishes", "Doing laundry", "Folding clothes", "Making the bed", "Tidying a room", "Vacuuming", "Dusting", "Watering plants", "Gardening"] },
  { name: "Driving", icon: "car", areas: ["Daily responsibilities"], features: ["travel", "errands", "outdoors"], aliases: [], relatedNames: ["Riding in a car", "Taking a bus"] },
  { name: "At Aphasia House", icon: "aphasia-house", areas: ["Personal relationships", "Education/career"], features: ["connection", "communication", "learning", "language"], aliases: [], relatedNames: ["Going to a support group", "Going to a community center"] },
  { name: "Physical therapy", icon: "health", areas: ["Mind/body/spirit"], features: ["movement", "therapy"], aliases: [], relatedNames: ["Occupational therapy"] },
  { name: "Speech therapy", icon: "health", areas: ["Mind/body/spirit", "Education/career"], features: ["language", "communication", "therapy", "learning"], aliases: [], relatedNames: ["Speech practice"] },
  { name: "Participate in research", icon: "research", areas: ["Education/career"], features: ["learning", "community", "communication"], aliases: ["Participating in research"] },
];

const nameKey = (name: string) => name.trim().toLowerCase().replace(/[|/]/g, " ").replace(/\s+/g, " ");
export function catalogueActivity(name: string) {
  const key = nameKey(name);
  return mainActivities.find((activity) => nameKey(activity.name) === key || activity.aliases.some((alias) => nameKey(alias) === key));
}

export const searchableActivities = [...mainActivities, ...activities.filter((activity) =>
  !mainActivities.some((main) => nameKey(main.name) === nameKey(activity.name)))];

const starters = ["Eat a meal", "Call | On the phone", "Read", "Practicing mindfulness", "Spending time with loved ones"];

// The wider searchable library also informs the profile. Look up its fixed
// catalogue group by name, never a user's chosen artwork or a guessed word.
const libraryFeatures: Record<string, { areas: LifeArea[]; features: string[] }> = {
  music: { areas: ["Recreation/interests"], features: ["creativity", "entertainment", "quiet"] },
  art: { areas: ["Recreation/interests"], features: ["creativity", "quiet"] },
  game: { areas: ["Recreation/interests"], features: ["entertainment", "quiet", "learning"] },
  work: { areas: ["Education/career"], features: ["learning", "community", "communication"] },
  out: { areas: ["Daily responsibilities"], features: ["errands", "outdoors", "travel"] },
  walk: { areas: ["Mind/body/spirit", "Recreation/interests"], features: ["movement", "outdoors"] },
  read: { areas: ["Recreation/interests", "Education/career"], features: ["quiet", "language", "learning"] },
  friends: { areas: ["Personal relationships"], features: ["connection", "communication", "companionship"] },
  health: { areas: ["Mind/body/spirit"], features: ["self-care", "therapy"] },
  rest: { areas: ["Mind/body/spirit"], features: ["quiet", "rest"] },
  care: { areas: ["Daily responsibilities"], features: ["self-care", "routine"] },
  home: { areas: ["Daily responsibilities"], features: ["home", "routine"] },
  eat: { areas: ["Daily responsibilities"], features: ["food", "routine"] },
};

export function suggestedActivities(data: Data, now = new Date()): ActivityChoice[] {
  const completed = Object.values(data.entries).filter((entry) => entry.status === "done" && !entry.sleepId && !entry.sleepBoundary);
  const tried = new Set(completed.map((entry) => catalogueActivity(entry.name)?.name ?? nameKey(entry.name)));
  const planned = new Set(Object.values(data.entries).filter((entry) => entry.source === "scheduled" && entry.status === "planned")
    .map((entry) => catalogueActivity(entry.name)?.name ?? nameKey(entry.name)));
  const profile = new Map<string, number>();
  for (const entry of completed) {
    const matched = catalogueActivity(entry.name) ?? mainActivities.find((candidate) =>
      candidate.relatedNames?.some((name) => nameKey(name) === nameKey(entry.name)));
    if (matched?.name === "Sleep" || matched?.name === "Wake up") continue;
    const library = activities.find((choice) => nameKey(choice.name) === nameKey(entry.name));
    const activity = matched ?? (library && libraryFeatures[library.icon]);
    // Unknown custom activities can still contribute their explicitly chosen area.
    const areas = entry.lifeArea ? [entry.lifeArea] : activity?.areas ?? [];
    const edges = [...(activity?.features ?? []), ...areas.map((area) => `area:${area}`)];
    const ageDays = Math.max(0, (now.getTime() - new Date(`${entry.date}T12:00:00`).getTime()) / 86400000);
    const weight = 1 / (1 + ageDays / 14);
    for (const edge of edges) profile.set(edge, (profile.get(edge) ?? 0) + weight / edges.length);
  }
  return mainActivities.filter((activity) => activity.name !== "Sleep" && activity.name !== "Wake up" && !tried.has(activity.name) && !planned.has(activity.name))
    .map((activity) => {
      const edges = [...activity.features, ...activity.areas.map((area) => `area:${area}`)];
      const score = edges.reduce((sum, edge) => sum + (profile.get(edge) ?? 0) * (edge.startsWith("area:") ? 0.25 : 1), 0) / Math.sqrt(edges.length);
      const starter = starters.indexOf(activity.name);
      return { activity, score, starter: starter < 0 ? starters.length : starter };
    })
    .sort((a, b) => b.score - a.score || a.starter - b.starter || a.activity.name.localeCompare(b.activity.name))
    .slice(0, 5).map(({ activity }) => ({ name: activity.name, icon: activity.icon }));
}
