import { activities } from "./activities";
import type { ActivityChoice, Data, LifeArea } from "./model";

type CatalogueActivity = ActivityChoice & {
  areas: LifeArea[];
  features: string[];
  aliases: string[];
  relatedNames?: string[];
};

// Keep older names searchable and recognizable in saved history.
const legacyActivities: CatalogueActivity[] = [
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
  { name: "Aphasia House", icon: "aphasia-house", areas: ["Personal relationships", "Education/career"], features: ["connection", "communication", "learning", "language"], aliases: ["At Aphasia House"], relatedNames: ["Going to a support group", "Going to a community center"] },
  { name: "Physical therapy", icon: "health", areas: ["Mind/body/spirit"], features: ["movement", "therapy"], aliases: [], relatedNames: ["Occupational therapy"] },
  { name: "Speech therapy", icon: "health", areas: ["Mind/body/spirit", "Education/career"], features: ["language", "communication", "therapy", "learning"], aliases: [], relatedNames: ["Speech practice"] },
  { name: "Participate in research", icon: "research", areas: ["Education/career"], features: ["learning", "community", "communication"], aliases: ["Participating in research"] },
];

// These are activity categories, separate from the five life areas used by values.
const activityIcons: Record<string, string> = {
  "Phone call": "phone", "Video call": "computer", Texting: "phone",
  Cooking: "cooking", "Pet care": "pets", "Grocery shopping": "groceries", "Other shopping": "out",
  Reading: "read", "Watching TV": "computer", "Listening to music": "music",
  "Board and card games": "game", "Video games": "game", "Making music": "music",
  "Taking a trip": "car", "Caring for someone": "aphasia-house",
};
const activityAliases: Record<string, string[]> = {
  Sleeping: ["Sleep", "Went to bed", "Getting ready for bed"],
  Nap: ["Having a nap"], Snack: ["Having a snack"],
  "Coffee or tea": ["Drinking coffee", "Drinking tea"],
  "Eating out": ["Eating at a restaurant"],
  "Shower or bath": ["Taking a shower", "Taking a bath"],
  "Hair and grooming": ["Brushing hair", "Shaving", "Doing skin care", "Getting a haircut"],
  "Visiting friends": ["Seeing friends", "Meeting a friend"],
  "Time with partner": ["Spending time with a partner"],
  "Gathering or celebration": ["Celebrating a birthday"],
  "Phone call": ["Call | On the phone", "Call/On the phone", "Calling a friend", "Calling family", "Talking on the phone"],
  "Video call": ["Video calling"],
  Cooking: ["Cook"], Cleaning: ["Cleaning | Doing chores", "Cleaning/Doing chores", "Washing dishes", "Tidying a room", "Vacuuming", "Dusting"],
  Laundry: ["Doing laundry", "Folding clothes"],
  "Pet care": ["Taking care of pets", "Feeding a pet", "Brushing a pet"],
  "Grocery shopping": ["Buying groceries"],
  "Other shopping": ["Go shopping", "Shopping"],
  Walking: ["Walking in the park", "Walking with a friend", "Going for a stroll"],
  Biking: ["Riding a bicycle"], "Stretching or yoga": ["Gentle stretching"],
  Workout: ["Exercise | Fitness activity", "Exercise/Fitness activity", "Chair exercises"],
  Reading: ["Read", "Reading a book", "Reading a newspaper", "Reading a magazine", "Reading poetry"],
  "Watching TV": ["Watch TV", "Watching television"],
  "Board and card games": ["Playing cards", "Playing a board game", "Playing chess", "Playing checkers", "Playing dominoes"],
  "Video games": ["Playing a video game"], "Arts and crafts": ["Making crafts"],
  "Taking a class": ["Going to a class"], "Religious service": ["Going to church"],
  "Doctor appointment": ["Seeing a doctor"], "Support group": ["Going to a support group"],
  "Beach visit": ["Going to the beach"], Photography: ["Taking photos"],
  "Visiting a library": ["Visiting the library"],
  "Visiting a movie theater": ["Going to the cinema"], "Visiting a concert": ["Going to a concert"],
  "Listen to an audiobook": ["Listening to an audiobook"], "Make a playlist": ["Making a playlist"],
  "Watch the sunset": ["Watching the sunset"], "Sit in a garden": ["Sitting in the garden"],
  "Arrange flowers": ["Arranging flowers"], "Work on a jigsaw puzzle": ["Doing a puzzle"],
  "Color a picture": ["Coloring"],
};
const activityFeatures: Record<string, string[]> = {
  Cooking: ["food", "creativity", "self-care"],
  "Grocery shopping": ["errands", "food", "outdoors"],
  "Other shopping": ["errands", "outdoors"],
  Gardening: ["home", "outdoors", "movement"],
  "Pet care": ["caregiving", "movement", "companionship"],
  "Bird watching": ["outdoors", "quiet"],
  Reading: ["quiet", "learning", "language"],
  "Watching TV": ["entertainment", "quiet", "technology"],
  "Listening to music": ["creativity", "entertainment", "quiet"],
  "Making music": ["creativity", "entertainment", "communication"],
  "Speech therapy": ["language", "communication", "therapy", "learning"],
  "Speech practice": ["language", "communication", "therapy", "learning"],
  "Support group": ["connection", "communication", "therapy"],
};

function activityGroup(name: string, icon: string, areas: LifeArea[], features: string[], names: string) {
  return { name, icon, activities: names.split("; ").map((name): CatalogueActivity => ({
    name, icon: activityIcons[name] ?? icon, areas,
    features: activityFeatures[name] ?? features, aliases: activityAliases[name] ?? [],
  })) };
}

export const activityCategories = [
  activityGroup("Food and drinks", "eat", ["Daily responsibilities"], ["food", "routine"],
    "Breakfast; Lunch; Dinner; Snack; Coffee or tea; Eating out"),
  activityGroup("Sleep and rest", "sleep", ["Mind/body/spirit"], ["rest", "quiet", "routine"],
    "Sleeping; Nap; Resting"),
  activityGroup("Personal care", "care", ["Daily responsibilities"], ["self-care", "routine"],
    "Shower or bath; Getting dressed; Brushing teeth; Hair and grooming"),
  activityGroup("Time with others", "friends", ["Personal relationships"], ["connection", "communication", "companionship"],
    "Visiting family; Visiting friends; Time with partner; Gathering or celebration; Phone call; Video call; Texting"),
  activityGroup("Home and errands", "home", ["Daily responsibilities"], ["home", "routine", "caregiving"],
    "Cooking; Cleaning; Laundry; Pet care; Gardening; Home repairs; Grocery shopping; Other shopping"),
  activityGroup("Exercise", "walk", ["Mind/body/spirit", "Recreation/interests"], ["movement", "outdoors"],
    "Walking; Running; Biking; Swimming; Stretching or yoga; Workout; Playing a sport"),
  activityGroup("Hobbies and fun", "art", ["Recreation/interests"], ["creativity", "entertainment", "quiet"],
    "Reading; Watching TV; Listening to music; Board and card games; Video games; Arts and crafts; Making music; Going to an event"),
  activityGroup("Work and community", "work", ["Education/career", "Personal relationships"], ["learning", "community", "connection"],
    "Working; Taking a class; Volunteering; Religious service; Caring for someone; Taking a trip"),
  activityGroup("Health and therapy", "health", ["Mind/body/spirit"], ["self-care", "therapy"],
    "Doctor appointment; Speech therapy; Speech practice; Other therapy; Support group"),
];
export const mainActivities = activityCategories.flatMap((category) => category.activities);

// Recommendation candidates are not rendered as extra browsing categories.
export const suggestionActivities = [
  activityGroup("Trips outdoors", "walk", ["Recreation/interests"], ["outdoors", "travel"],
    "Picnic; Beach visit; Camping; Fishing; Road trips"),
  activityGroup("Active hobbies", "walk", ["Mind/body/spirit", "Recreation/interests"], ["movement", "outdoors"],
    "Pickleball; Tennis; Swimming; Dancing; Bowling; Gardening"),
  activityGroup("Creative hobbies", "art", ["Recreation/interests"], ["creativity", "quiet"],
    "Painting; Drawing; Photography; Scrapbooking; Sewing; Bird watching"),
  activityGroup("Visits", "out", ["Recreation/interests"], ["entertainment", "learning", "outdoors"],
    "Visiting a library; Visiting a museum; Visiting a movie theater; Visiting a concert"),
  activityGroup("Community activities", "work", ["Education/career", "Personal relationships"], ["community", "learning", "connection"],
    "Volunteering; Taking a class; Attending a community gathering"),
  activityGroup("Art and making things", "art", ["Recreation/interests"], ["creativity", "quiet"],
    "Make a greeting card; Paint a flowerpot; Make a photo collage; Try clay modeling; Decorate a picture frame; Make a bracelet"),
  activityGroup("Music and entertainment", "music", ["Recreation/interests"], ["entertainment", "creativity", "quiet"],
    "Listen to a new artist; Make a playlist; Watch a nature documentary; Listen to an audiobook; Attend a local performance; Try a new board game"),
  activityGroup("Food and cooking", "cooking", ["Daily responsibilities", "Recreation/interests"], ["food", "creativity", "self-care"],
    "Try a new fruit; Make a smoothie; Bake cookies; Cook a family recipe; Visit a farmers market; Try a new restaurant"),
  activityGroup("Nature and outdoors", "walk", ["Recreation/interests", "Mind/body/spirit"], ["outdoors", "quiet", "rest"],
    "Visit a botanical garden; Watch the sunset; Plant herbs; Visit a new park; Take nature photos; Have a meal outside"),
  activityGroup("Friends and family", "friends", ["Personal relationships"], ["connection", "companionship", "communication"],
    "Look through family photos together; Invite someone for tea; Play a game with someone; Send a photo to a friend; Make a gift for someone; Have a movie night"),
  activityGroup("Local outings", "out", ["Recreation/interests"], ["outdoors", "travel", "community"],
    "Visit a new café; Explore a nearby town; Visit an aquarium; Go to a craft fair; Visit a historic site; Attend a community festival"),
  activityGroup("Learning and discovery", "read", ["Education/career", "Recreation/interests"], ["learning", "creativity"],
    "Take a cooking class; Try a pottery class; Learn about a favorite animal; Visit a science museum; Attend a library event; Learn to grow a plant"),
  activityGroup("Community and kindness", "work", ["Personal relationships", "Education/career"], ["community", "caregiving", "connection"],
    "Donate books; Make a thank-you card; Join a hobby group; Visit an animal shelter; Help with a community garden; Put together a care package"),
  activityGroup("Movement and play", "walk", ["Mind/body/spirit", "Recreation/interests"], ["movement", "entertainment"],
    "Try chair dancing; Play mini golf; Try a gentle movement class; Play a tossing game; Walk somewhere new; Try a beginner dance class"),
  activityGroup("Quiet activities", "rest", ["Mind/body/spirit", "Recreation/interests"], ["quiet", "rest", "creativity"],
    "Sit in a garden; Watch the clouds; Arrange flowers; Work on a jigsaw puzzle; Color a picture; Watch birds from a window"),
].flatMap((group) => group.activities);

const nameKey = (name: string) => name.trim().toLowerCase().replace(/[|/]/g, " ").replace(/\s+/g, " ");
const currentCatalogue = [...mainActivities, ...suggestionActivities];
const catalogue = [...currentCatalogue, ...legacyActivities];
export function catalogueActivity(name: string) {
  const key = nameKey(name);
  // Exact choices take precedence over old broad aliases (e.g. Speech practice).
  return currentCatalogue.find((activity) => nameKey(activity.name) === key) ??
    currentCatalogue.find((activity) => activity.aliases.some((alias) => nameKey(alias) === key)) ??
    legacyActivities.find((activity) => nameKey(activity.name) === key || activity.aliases.some((alias) => nameKey(alias) === key));
}
const seen = new Set<string>();
export const searchableActivities = [...catalogue, ...activities].filter((activity) => {
  const key = nameKey(activity.name);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
const starters = ["Listen to a new artist", "Try a new fruit", "Send a photo to a friend", "Color a picture", "Watch the sunset"];

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
  const tried = new Set(completed.map((entry) => nameKey(catalogueActivity(entry.name)?.name ?? entry.name)));
  const planned = new Set(Object.values(data.entries).filter((entry) => entry.source === "scheduled" && entry.status === "planned")
    .map((entry) => nameKey(catalogueActivity(entry.name)?.name ?? entry.name)));
  const profile = new Map<string, number>();
  for (const entry of completed) {
    const matched = catalogueActivity(entry.name) ?? legacyActivities.find((candidate) =>
      candidate.relatedNames?.some((name) => nameKey(name) === nameKey(entry.name)));
    if (matched?.name === "Sleeping" || matched?.name === "Wake up") continue;
    const library = activities.find((choice) => nameKey(choice.name) === nameKey(entry.name));
    const activity = matched ?? (library && libraryFeatures[library.icon]);
    // Unknown custom activities can still contribute their explicitly chosen area.
    const areas = entry.lifeArea ? [entry.lifeArea] : activity?.areas ?? [];
    const edges = [...(activity?.features ?? []), ...areas.map((area) => `area:${area}`)];
    const ageDays = Math.max(0, (now.getTime() - new Date(`${entry.date}T12:00:00`).getTime()) / 86400000);
    const weight = 1 / (1 + ageDays / 14);
    for (const edge of edges) profile.set(edge, (profile.get(edge) ?? 0) + weight / edges.length);
  }
  return suggestionActivities.filter((activity) => !tried.has(nameKey(activity.name)) && !planned.has(nameKey(activity.name)))
    .map((activity) => {
      const edges = [...activity.features, ...activity.areas.map((area) => `area:${area}`)];
      const score = edges.reduce((sum, edge) => sum + (profile.get(edge) ?? 0) * (edge.startsWith("area:") ? 0.25 : 1), 0) / Math.sqrt(edges.length);
      const starter = starters.indexOf(activity.name);
      return { activity, score, starter: starter < 0 ? starters.length : starter };
    })
    .sort((a, b) => b.score - a.score || a.starter - b.starter || a.activity.name.localeCompare(b.activity.name))
    .slice(0, 5).map(({ activity }) => ({ name: activity.name, icon: activity.icon }));
}
