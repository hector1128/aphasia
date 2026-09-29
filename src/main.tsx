import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  CalendarDays,
  House,
  Wind,
  Settings,
  X,
  Sun,
  Trash2,
  Clock,
  Play,
  Users,
  Image as ImageIcon,
} from "lucide-react";
import {
  Data,
  Entry,
  ActivityChoice,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  emptyData,
  readData,
  dateKey,
  currentSlot,
  timeLabel,
  saveEntry,
  slotDate,
  entriesInSlot,
  rememberActivity,
} from "./model";
import { WeekPicker, TimePicker } from "./DateTimePicker";
import { ActivityIcon } from "./ActivityIcon";
import { ActivityPicker } from "./ActivityPicker";
import { RatingSlider } from "./RatingSlider";
import { DayTimeline } from "./DayTimeline";
import { BreathingGuide, RelaxationVideo } from "./Relaxation";
// Daily mood UI and data are preserved; frontend access is temporarily disabled below.
import { DailyMood } from "./DailyMood";
import "./style.css";

type Screen =
  | "home"
  | "plan"
  | "edit"
  | "detail"
  | "relax"
  | "breathing"
  | "visualization"
  | "stretching"
  | "settings"
  | "dailyMood";
type Step = "activity" | "day" | "time" | "mood" | "enjoyment";
const stepTitles: Record<Step, string> = {
  activity: "What activity?",
  day: "Which day?",
  time: "What time?",
  mood: "How did you feel?",
  enjoyment: "How important?",
};

function App() {
  const [data, setData] = useState<Data>(() => {
    try {
      return readData(
        localStorage.getItem(STORAGE_KEY) ??
          localStorage.getItem(LEGACY_STORAGE_KEY),
      );
    } catch {
      return emptyData();
    }
  });
  const [screen, setScreen] = useState<Screen>("home");
  const [name, setName] = useState(data.name);
  const [clock, setClock] = useState(() => new Date());
  const [minute, setMinute] = useState(currentSlot());
  const [date, setDate] = useState(dateKey(new Date()));
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [draft, setDraft] = useState<Entry | null>(null);
  const [step, setStep] = useState<Step>("activity");
  const [returnTo, setReturnTo] = useState<"home" | "plan">("home");
  const heading = useRef<HTMLHeadingElement>(null);
  const today = dateKey(clock);
  const homeEntries = entriesInSlot(data, today, minute);
  const relaxed = [
    "relax",
    "breathing",
    "visualization",
    "stretching",
  ].includes(screen);
  const steps: Step[] =
    draft?.status === "planned"
      ? ["activity", "day", "time"]
      : ["activity", "day", "time", "mood", "enjoyment"];

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [data]);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [screen, step, data.name]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const go = (next: Screen) => {
    setNotice("");
    setScreen(next);
  };
  const newEntry = (
    status: Entry["status"],
    selectedDate = today,
    selectedMinute = minute,
    origin: "home" | "plan" = "home",
  ) => {
    setDraft({
      id: crypto.randomUUID(),
      name: "",
      icon: "custom",
      date: selectedDate,
      startMinute: selectedMinute,
      status,
    });
    setReturnTo(origin);
    setStep("activity");
    go("edit");
  };
  const openEntry = (entry: Entry, origin: "home" | "plan") => {
    setDraft({ ...entry });
    setReturnTo(origin);
    go("detail");
  };
  const chooseActivity = (choice: ActivityChoice) => {
    setDraft((prev) => (prev ? { ...prev, ...choice } : prev));
    setData((prev) => rememberActivity(prev, choice));
  };
  const validateTime = (entry: Entry) => {
    const now = new Date();
    const future = slotDate(entry.date, entry.startMinute) > now;
    if (entry.status === "done" && future) {
      setNotice("Choose now or an earlier time.");
      return false;
    }
    const old = data.entries[entry.id];
    const unchanged =
      old && old.date === entry.date && old.startMinute === entry.startMinute;
    if (entry.status === "planned" && !unchanged && !future) {
      setNotice("Choose a later time.");
      return false;
    }
    return true;
  };
  const save = (entry: Entry) => {
    if (!entry.name.trim() || !validateTime(entry)) return;
    setData((prev) => saveEntry(prev, { ...entry, name: entry.name.trim() }));
    setDate(entry.date);
    if (entry.date === today) setMinute(entry.startMinute);
    go(returnTo === "plan" || entry.status === "planned" ? "plan" : "home");
    setNotice("Activity saved");
  };
  const nextStep = () => {
    if (!draft) return;
    if (step === "time" && !validateTime(draft)) return;
    if (step === "mood") {
      setDraft({ ...draft, mood: draft.mood ?? 5 });
      setStep("enjoyment");
      return;
    }
    if (step === "enjoyment") {
      save({ ...draft, rating: draft.rating ?? 5 });
      return;
    }
    if (step === "time" && draft.status === "planned") {
      save(draft);
      return;
    }
    setStep(steps[steps.indexOf(step) + 1]);
  };
  const previousStep = () => {
    const index = steps.indexOf(step);
    if (index > 0) setStep(steps[index - 1]);
    else go(draft && data.entries[draft.id] ? "detail" : returnTo);
  };
  const reset = () => {
    setData(emptyData());
    setName("");
    setDraft(null);
    setStep("activity");
    setMinute(currentSlot());
    setDate(dateKey(new Date()));
    go("home");
    // Keep old data from being re-imported if the current storage key is later removed.
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      setStorageError(true);
    }
  };
  const header = (
    title: string,
    back: () => void = () => go("home"),
    backLabel = "Home",
  ) => (
    <>
      <button className="back" onClick={back}>
        <ArrowLeft size={24} />
        {backLabel}
      </button>
      <div className="page-title">
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
      </div>
    </>
  );

  return (
    <div className={`app-shell ${relaxed ? "theme-relax" : "theme-activity"}`}>
      <main>
        {!data.name ? (
          <div className="welcome">
            <img
              className="welcome-illustration"
              src="/images/welcome-adult.png"
              alt="An adult relaxing in a comfortable chair beside a book and a plant"
            />
            <h1>
              Your day.
              <br />
              At your pace.
            </h1>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim())
                  setData((prev) => ({ ...prev, name: name.trim() }));
              }}
            >
              <label htmlFor="name">What’s your name?</label>
              <input
                id="name"
                autoComplete="given-name"
                placeholder="Your first name"
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
              />
              <button className="primary" disabled={!name.trim()}>
                Let’s begin <ArrowRight size={24} />
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="topbar">
              <button
                className="icon-button"
                aria-label="Settings"
                onClick={() => {
                  setName(data.name);
                  go("settings");
                }}
              >
                <Settings size={26} />
              </button>
            </div>
            {screen === "home" && (
              <>
                <div className="greeting">
                  <span className="eyebrow">
                    {clock.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <h1>
                    Hi, {data.name}{" "}
                    <span className="hello-sun">
                      <Sun size={29} />
                    </span>
                  </h1>
                </div>
                <section className="moment-section">
                  <div className="hour-selector">
                    <button
                      aria-label="Previous 30 minutes"
                      disabled={minute === 0}
                      onClick={() => setMinute(minute - 30)}
                    >
                      <ChevronLeft />
                    </button>
                    <div>
                      <Clock size={25} />
                      <strong>{timeLabel(minute)}</strong>
                    </div>
                    <button
                      aria-label="Next 30 minutes"
                      disabled={minute === 1410}
                      onClick={() => setMinute(minute + 30)}
                    >
                      <ChevronRight />
                    </button>
                  </div>
                  {homeEntries.map((entry) => (
                    <button
                      key={entry.id}
                      className="activity-card home-activity"
                      aria-label={`Edit ${entry.name}`}
                      onClick={() => openEntry(entry, "home")}
                    >
                      <span className="activity-art">
                        <ActivityIcon id={entry.icon} size={48} />
                      </span>
                      <strong>{entry.name}</strong>
                      {entry.mood !== undefined && (
                        <span>Mood: {entry.mood} / 10</span>
                      )}
                      {entry.rating !== undefined && (
                        <span>Enjoyment: {entry.rating} / 10</span>
                      )}
                      {entry.status === "planned" && <span>Planned</span>}
                    </button>
                  ))}
                  <button
                    className={
                      homeEntries.length
                        ? "secondary"
                        : "activity-card home-activity"
                    }
                    onClick={() =>
                      newEntry(
                        slotDate(today, minute) > new Date()
                          ? "planned"
                          : "done",
                      )
                    }
                  >
                    <Plus size={32} />
                    {homeEntries.length
                      ? "Add activity"
                      : minute > currentSlot(clock)
                        ? "Schedule activity"
                        : "Log activity"}
                  </button>
                </section>
                <div className="section-heading next-heading" />
                <div className="action-grid">
                  <button
                    className="action-card plan-card"
                    onClick={() => {
                      setDate(today);
                      go("plan");
                    }}
                  >
                    <span className="tile-icon">
                      <CalendarDays size={30} />
                    </span>
                    <h3>Schedule activity</h3>
                    <ChevronRight className="tile-arrow" size={23} />
                  </button>
                  <button
                    className="action-card relax-card"
                    onClick={() => go("relax")}
                  >
                    <span className="tile-icon">
                      <Wind size={30} />
                    </span>
                    <h3>Take a breath</h3>
                    <ChevronRight className="tile-arrow" size={23} />
                  </button>
                </div>
                 
       {/* <button className="day-card" onClick={() => go('dailyMood')}>
         <strong>Log your mood</strong><span>{data.ratings[today]} / 10</span>
       </button>
      */}
              </>
            )}
            {screen === "plan" && (
              <>
                {header("Your plans")}
                <WeekPicker value={date} onChange={setDate} />
                <div className="section-heading">
                  <h2>
                    {date === today
                      ? "Today"
                      : new Date(`${date}T12:00`).toLocaleDateString("en-US", {
                          weekday: "long",
                        })}
                  </h2>
                  <CalendarDays size={26} />
                </div>
                <DayTimeline
                  date={date}
                  data={data}
                  onEdit={(entry) => openEntry(entry, "plan")}
                  onAdd={(selectedMinute) =>
                    newEntry(
                      slotDate(date, selectedMinute) > new Date()
                        ? "planned"
                        : "done",
                      date,
                      selectedMinute,
                      "plan",
                    )
                  }
                />
                <button
                  className="primary"
                  onClick={() => {
                    const later = Math.min(currentSlot() + 30, 1410);
                    const selectedDate = date < today ? today : date;
                    newEntry(
                      "planned",
                      selectedDate,
                      selectedDate === today ? later : 540,
                      "plan",
                    );
                  }}
                >
                  <Plus /> Plan activity
                </button>
              </>
            )}
            {screen === "edit" && draft && (
              <>
                {header(stepTitles[step], previousStep, "Back")}
                <div
                  className="wizard-progress"
                  aria-label={`Step ${steps.indexOf(step) + 1} of ${steps.length}`}
                >
                  {steps.map((item) => (
                    <span
                      key={item}
                      className={item === step ? "active" : ""}
                    />
                  ))}
                </div>
                {step === "activity" && (
                  <ActivityPicker
                    key={draft.id}
                    value={draft}
                    recent={data.recentActivities}
                    onChange={chooseActivity}
                  />
                )}
                {step === "day" && (
                  <WeekPicker
                    value={draft.date}
                    min={
                      draft.status === "planned"
                        ? data.entries[draft.id]?.date < today
                          ? data.entries[draft.id].date
                          : today
                        : undefined
                    }
                    max={draft.status === "done" ? today : undefined}
                    onChange={(date) => setDraft({ ...draft, date })}
                  />
                )}
                {step === "time" && (
                  <>
                    <div className="chosen-time">
                      {timeLabel(draft.startMinute)}
                    </div>
                    <TimePicker
                      value={draft.startMinute}
                      onChange={(startMinute) =>
                        setDraft({ ...draft, startMinute })
                      }
                    />
                  </>
                )}
                {step === "mood" && (
                  <RatingSlider
                    label="Mood"
                    value={draft.mood ?? 5}
                    onChange={(mood) => setDraft({ ...draft, mood })}
                  />
                )}
                {step === "enjoyment" && (
                  <RatingSlider
                    label="Enjoyment"
                    value={draft.rating ?? 5}
                    onChange={(rating) => setDraft({ ...draft, rating })}
                  />
                )}
                <div className="wizard-actions">
                  <button
                    className="primary"
                    disabled={step === "activity" && !draft.name.trim()}
                    onClick={nextStep}
                  >
                    {step === "enjoyment" ||
                    (step === "time" && draft.status === "planned") ? (
                      <>
                        <Check /> Save activity
                      </>
                    ) : (
                      <>
                        Next <ArrowRight />
                      </>
                    )}
                  </button>
                  {(step === "mood" || step === "enjoyment") && (
                    <button
                      className="secondary"
                      onClick={() => {
                        if (step === "mood") {
                          setDraft({ ...draft, mood: undefined });
                          setStep("enjoyment");
                        } else save({ ...draft, rating: undefined });
                      }}
                    >
                      Skip
                    </button>
                  )}
                </div>
              </>
            )}
            {screen === "detail" && draft && (
              <>
                {header("Your activity", () => go(returnTo), "Back")}
                <div className="activity-detail">
                  <span className="activity-art">
                    <ActivityIcon id={draft.icon} size={48} />
                  </span>
                  <h2>{draft.name}</h2>
                  <p>
                    {new Date(`${draft.date}T12:00`).toLocaleDateString(
                      "en-US",
                      { weekday: "long", month: "short", day: "numeric" },
                    )}
                    <br />
                    {timeLabel(draft.startMinute)}
                  </p>
                  <p>{draft.status === "planned" ? "Planned" : "Completed"}</p>
                  {draft.status === "done" && (
                    <>
                      <button
                        className="score-row"
                        onClick={() => {
                          setStep("mood");
                          go("edit");
                        }}
                      >
                        Mood <strong>{draft.mood ?? "—"} / 10</strong>
                        <ChevronRight />
                      </button>
                      <button
                        className="score-row"
                        onClick={() => {
                          setStep("enjoyment");
                          go("edit");
                        }}
                      >
                        Enjoyment <strong>{draft.rating ?? "—"} / 10</strong>
                        <ChevronRight />
                      </button>
                    </>
                  )}
                </div>
                {draft.status === "planned" && (
                  <button
                    className="primary"
                    disabled={
                      slotDate(draft.date, draft.startMinute) > new Date()
                    }
                    onClick={() => {
                      setDraft({ ...draft, status: "done" });
                      setStep("mood");
                      go("edit");
                    }}
                  >
                    <Check /> I did this activity
                  </button>
                )}
                <button
                  className="secondary"
                  onClick={() => {
                    setStep("activity");
                    go("edit");
                  }}
                >
                  Edit activity
                </button>
                <button
                  className="delete-button"
                  onClick={() => {
                    setData((prev) => {
                      const entries = { ...prev.entries };
                      delete entries[draft.id];
                      return { ...prev, entries };
                    });
                    go(returnTo);
                    setNotice("Activity deleted");
                  }}
                >
                  <Trash2 size={24} /> Delete activity
                </button>
              </>
            )}
            {screen === "relax" && (
              <>
                {header("Take a breath")}
                <div className="relaxation-options">
                  <button className="entry-row" onClick={() => go("breathing")}>
                    <span className="entry-picture">
                      <Wind size={36} />
                    </span>
                    <strong>Breathing</strong>
                    <ChevronRight />
                  </button>
                  <button
                    className="entry-row"
                    onClick={() => go("visualization")}
                  >
                    <span className="entry-picture">
                      <ImageIcon size={36} />
                    </span>
                    <strong>Visualization</strong>
                    <ChevronRight />
                  </button>
                  <button
                    className="entry-row"
                    onClick={() => go("stretching")}
                  >
                    <span className="entry-picture">
                      <Users size={36} />
                    </span>
                    <strong>Gentle stretching</strong>
                    <ChevronRight />
                  </button>
                </div>
              </>
            )}
            {screen === "breathing" && (
              <>
                {header("Breathing", () => go("relax"), "Back")}
                <BreathingGuide />
              </>
            )}
            {screen === "visualization" && (
              <>
                {header("Visualization", () => go("relax"), "Back")}
                <RelaxationVideo kind="visualization" />
              </>
            )}
            {screen === "stretching" && (
              <>
                {header("Gentle stretching", () => go("relax"), "Back")}
                <RelaxationVideo kind="stretching" />
              </>
            )}
            {/* Retained daily mood page; uncomment with its Home entry point to restore it.
     {screen === 'dailyMood' && <>{header('How was your day?')}<DailyMood value={data.ratings[today]} onSave={value => {setData(prev => ({...prev, ratings: {...prev.ratings, [today]: value}}));go('home');}}/></>}
   */}
            {screen === "settings" && (
              <>
                {header("Settings")}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (name.trim()) {
                      setData((prev) => ({ ...prev, name: name.trim() }));
                      go("home");
                    }
                  }}
                >
                  <label htmlFor="edit-name">Your name</label>
                  <input
                    id="edit-name"
                    value={name}
                    maxLength={40}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <button className="primary" disabled={!name.trim()}>
                    Save name <Check />
                  </button>
                </form>
                <button className="secondary reset-button" onClick={reset}>
                  Start over
                </button>
                <p className="reset-description">
                  Clear name, activities, and ratings.
                </p>
              </>
            )}
          </>
        )}
        {storageError && (
          <div className="error" role="alert">
            Could not save. Keep this page open.
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <Check size={24} />
            {notice}
            <button aria-label="Dismiss" onClick={() => setNotice("")}>
              <X size={24} />
            </button>
          </div>
        )}
      </main>
      {data.name && (
        <nav aria-label="Main navigation">
          <button
            className={screen === "home" ? "active" : ""}
            onClick={() => go("home")}
          >
            <House size={25} />
            <span>Home</span>
          </button>
          <button
            className={screen === "plan" ? "active" : ""}
            onClick={() => {
              setDate(today);
              go("plan");
            }}
          >
            <CalendarDays size={25} />
            <span>My plans</span>
          </button>
          <button
            className={relaxed ? "active relax-nav" : "relax-nav"}
            onClick={() => go("relax")}
          >
            <Wind size={25} />
            <span>Relax</span>
          </button>
        </nav>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
