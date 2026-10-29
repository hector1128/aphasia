import {
  Activity, Apple, Bath, BedDouble, Bike, Bird, BookOpen, Brain, BriefcaseBusiness,
  Camera, Car, Church, Clapperboard, ClipboardList, Cloud, Coffee, CookingPot,
  Dices, Dumbbell, Fish, Flower2, Footprints, Frame, Gamepad2, Gem, Gift,
  GraduationCap, Hammer, HandHeart, Headphones, HeartHandshake, HeartPulse,
  House, Landmark, Library, ListMusic, Mail, MessageCircle, Monitor,
  Music2, NotebookPen, Palette, PartyPopper, PawPrint, PersonStanding, Phone,
  Puzzle, Sandwich, Scissors, Shapes, Shirt, ShoppingBag, ShoppingCart, Smile,
  Speech, Sprout, Stethoscope, Sunrise, Sunset, Tent, Trees, Trophy, Tv, Users,
  UsersRound, Utensils, Video, Volleyball, Waves, GlassWater, Cookie,
  EggFried, UtensilsCrossed, SprayCan, WashingMachine, Wind, Image, createLucideIcon, type LucideIcon,
} from "lucide-react";
import { catalogueActivity } from "./activity-catalogue";
import { sleepBoundary } from "./model";

const RunningIcon = createLucideIcon("Running", [
  ["circle", { cx: "16", cy: "4", r: "2", key: "head" }],
  ["path", { d: "m10 8 4-1 3 4 4 1M14 7l-3 6 5 3-1 5M11 13l-4 4H3M10 8l-3 4-3-1", key: "body" }],
]);
const ToothbrushIcon = createLucideIcon("Toothbrush", [
  ["rect", { x: "9", y: "2", width: "5", height: "8", rx: "1.5", key: "head" }],
  ["path", { d: "M10 10v10a1.5 1.5 0 0 0 3 0V10M5 3h4M5 6h4M5 9h4", key: "handle-and-bristles" }],
]);

const StretchingIcon = createLucideIcon("Stretching", [
  ["circle", { cx: "12", cy: "4", r: "2", key: "head" }],
  ["path", { d: "M12 8v6m0-5L5 5m7 4 7-4m-7 9-4 7m4-7 4 7", key: "stretch" }],
]);

// Keep stored icon IDs working; all artwork now uses the same Lucide strokes.
const icons: Record<string, LucideIcon> = {
  phone: Phone, pets: PawPrint, computer: Monitor, journal: NotebookPen,
  car: Car, "aphasia-house": HandHeart, research: ClipboardList,
  walk: Footprints, read: BookOpen, eat: Utensils, friends: Users,
  rest: Coffee, art: Palette, game: Puzzle, home: House, care: Bath,
  out: ShoppingBag, health: HeartPulse, work: BriefcaseBusiness,
  music: Music2, cooking: CookingPot, groceries: ShoppingCart,
  mindfulness: Brain, sleep: BedDouble,
  breathing: Wind, visualization: Image, stretching: StretchingIcon,
};

// Specific choices share a suitable symbol, rather than their category's icon.
const nameIcons: [LucideIcon, string][] = [
  [EggFried, "Breakfast"],
  [Sandwich, "Lunch"],
  [UtensilsCrossed, "Dinner"],
  [Sunrise, "Wake up; Waking up; Woke up; Getting up"],
  [Apple, "Snack; Try a new fruit"],
  [Coffee, "Coffee or tea; Invite someone for tea; Visit a new café; Going to a cafe"],
  [Utensils, "Eating out; Have a meal outside; Try a new restaurant"],
  [BedDouble, "Sleeping; Nap; Resting; Taking a break; Getting ready for bed"],
  [Bath, "Shower or bath"],
  [Shirt, "Getting dressed; Making the bed"],
  [WashingMachine, "Laundry"],
  [ToothbrushIcon, "Brushing teeth"],
  [Smile, "Washing hands; Doing skin care"],
  [Scissors, "Hair and grooming; Sewing; Knitting; Crocheting"],
  [Users, "Visiting family; Visiting friends; Look through family photos together; Having visitors; Playing with grandchildren; Talking with a neighbor"],
  [HeartHandshake, "Time with partner; Caring for someone; Play a game with someone; Helping someone"],
  [PartyPopper, "Gathering or celebration; Going to an event; Attending a community gathering; Attend a community festival"],
  [Phone, "Phone call"],
  [Video, "Video call"],
  [MessageCircle, "Texting; Reading messages"],
  [CookingPot, "Cooking; Cook a family recipe; Take a cooking class; Making a sandwich; Preparing vegetables"],
  [SprayCan, "Cleaning"],
  [House, "Aphasia House"],
  [Hammer, "Home repairs"],
  [PawPrint, "Pet care; Walking the dog; Visit an animal shelter"],
  [Sprout, "Gardening; Plant herbs; Learn to grow a plant; Help with a community garden; Watering plants"],
  [ShoppingCart, "Grocery shopping; Visit a farmers market; Going to the market; Making a shopping list"],
  [ShoppingBag, "Other shopping"],
  [Footprints, "Walking; Walk somewhere new; Hiking; Visiting a nature trail; Dancing; Try chair dancing; Try a beginner dance class"],
  [RunningIcon, "Running"],
  [Bike, "Biking"],
  [Waves, "Swimming; Beach visit"],
  [PersonStanding, "Stretching or yoga; Try a gentle movement class"],
  [Dumbbell, "Workout"],
  [Volleyball, "Playing a sport; Play a tossing game"],
  [BookOpen, "Reading"],
  [Tv, "Watching TV; Watch a nature documentary; Watching sports"],
  [Music2, "Listening to music; Making music; Listen to a new artist; Visiting a concert; Attend a local performance; Singing; Playing piano; Playing guitar; Playing drums; Listening to the radio; Listening to a podcast; Listening to a choir; Watching a concert"],
  [Dices, "Board and card games; Try a new board game; Playing bingo"],
  [Gamepad2, "Video games"],
  [Palette, "Arts and crafts; Painting; Drawing; Paint a flowerpot; Color a picture; Coloring"],
  [BriefcaseBusiness, "Working"],
  [GraduationCap, "Taking a class; Learning something new; Learn about a favorite animal"],
  [HandHeart, "Volunteering; Donate books; Put together a care package"],
  [Church, "Religious service"],
  [Car, "Taking a trip; Road trips; Riding in a car; Planning a trip"],
  [Stethoscope, "Doctor appointment; Seeing a dentist; See Dr. Blackett"],
  [Speech, "Speech therapy; Speech practice"],
  [HeartPulse, "Other therapy; Physical therapy; Occupational therapy; Taking medicine; Having a massage"],
  [UsersRound, "Support group; Join a hobby group; Going to a community center"],
  [Sandwich, "Picnic"],
  [Tent, "Camping"],
  [Fish, "Fishing; Visit an aquarium"],
  [Trophy, "Pickleball; Tennis; Bowling; Play mini golf"],
  [Camera, "Photography; Take nature photos; Send a photo to a friend"],
  [NotebookPen, "Scrapbooking; Write in journal; Organizing photos"],
  [Bird, "Bird watching; Watch birds from a window"],
  [Library, "Visiting a library; Attend a library event"],
  [Landmark, "Visiting a museum; Visit a science museum; Visit a historic site"],
  [Clapperboard, "Visiting a movie theater; Have a movie night; Watching a film"],
  [Mail, "Make a greeting card; Make a thank-you card; Writing a letter; Writing a card; Sending an email"],
  [Frame, "Make a photo collage; Decorate a picture frame; Looking at photos"],
  [Gem, "Make a bracelet; Making jewelry"],
  [Shapes, "Try clay modeling; Try a pottery class; Making pottery"],
  [ListMusic, "Make a playlist"],
  [Headphones, "Listen to an audiobook"],
  [GlassWater, "Make a smoothie; Drinking water"],
  [Cookie, "Bake cookies; Baking"],
  [Sunset, "Watch the sunset"],
  [Trees, "Visit a botanical garden; Visit a new park; Sit in a garden; Visiting a garden; Sitting outside"],
  [Flower2, "Arrange flowers"],
  [Gift, "Make a gift for someone; Go to a craft fair"],
  [Landmark, "Explore a nearby town; Going to the bank"],
  [Puzzle, "Work on a jigsaw puzzle; Doing a crossword; Doing a word search"],
  [Cloud, "Watch the clouds; Looking out the window"],
];
const iconByName = new Map(nameIcons.flatMap(([Icon, names]) =>
  names.split("; ").map((name): [string, LucideIcon] => [name.toLowerCase(), Icon])));

export function ActivityIcon({ id, size = 32, name = "" }: { id: string; size?: number; name?: string }) {
  const canonicalName = catalogueActivity(name)?.name ?? name;
  const boundary = sleepBoundary(name);
  const Icon = iconByName.get(canonicalName.trim().toLowerCase()) ??
    (boundary === "wake" ? Sunrise : boundary === "sleep" ? BedDouble : icons[id]) ?? Activity;
  return <Icon className="activity-icon" size={size} strokeWidth={1.7} aria-hidden="true" />;
}
