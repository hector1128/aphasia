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
  Settings,
  X,
  Sun,
  CloudSun,
  MoonStar,
  Trash2,
  Pencil,
  Clock,
  Play,
  Heart,
  House,
  Smile,
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
  saveActivity,
  toggleEntryStatus,
  sleepBoundary,
  removeEntry,
  slotDate,
  entriesInSlot,
  rememberActivity,
  suggestedActivities,
} from "./model";
import { WeekPicker, TimePicker } from "./DateTimePicker";
import { ActivityIcon, hasActivityIcon } from "./ActivityIcon";
import { ActivityPicker } from "./ActivityPicker";
import { RatingSlider } from "./RatingSlider";
import { DayTimeline } from "./DayTimeline";
import { BreathingGuide, RelaxationVideo } from "./Relaxation";
import { Values } from "./Values";
import { ReportSettings } from "./ReportSettings";
import { DailyMood } from "./DailyMood";
import "./style.css";

type Screen =
  | "home"
  | "plan"
  | "edit"
  | "relax"
  | "breathing"
  | "visualization"
  | "stretching"
  | "settings"
  | "dailyMood"
  | "values";
type Step = "activity" | "day" | "time" | "mood" | "enjoyment" | "importance";
const stepTitles: Record<Step, string> = {
  activity: "What activity?",
  day: "Which day?",
  time: "What time?",
  mood: "How did you feel?",
  enjoyment: "How much did you enjoy it?",
  importance: "How important was it?",
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
  const editingEntry = Boolean(draft && data.entries[draft.id]);
  const steps: Step[] = draft?.status === "planned"
    ? editingEntry ? ["activity"] : ["activity", "day", "time"]
    : [
        "activity",
        ...(draft && sleepBoundary(draft.name) ? [] : ["mood", "enjoyment", "importance"] as Step[]),
      ];

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
  const recordMindfulness = (
    id: string,
    kind: "breathing" | "visualization" | "stretching",
    status: "started" | "completed",
  ) => {
    setData((prev) => ({
      ...prev,
      mindfulness: [
        ...prev.mindfulness.filter((s) => s.id !== id),
        {
          id,
          kind,
          status,
          date:
            prev.mindfulness.find((s) => s.id === id)?.date ??
            dateKey(new Date()),
        },
      ],
    }));
  };
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
  const editEntry = (entry: Entry, origin: "home" | "plan") => {
    setDraft({ ...entry });
    setReturnTo(origin);
    setStep("activity");
    go("edit");
  };
  const deleteEntry = (id: string) => {
    setData((previous) => removeEntry(previous, id));
    setNotice("Activity deleted");
  };
  const toggleStatus = (id: string) => {
    const entry = data.entries[id];
    if (!entry || entry.sleepId) return;
    if (entry.status === "planned" && slotDate(entry.date, entry.startMinute) > new Date())
      return;
    setData((previous) => toggleEntryStatus(previous, id));
    setNotice(entry.status === "planned" ? "Activity completed" : "Activity planned");
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
    setData((prev) => saveActivity(prev, { ...entry, name: entry.name.trim() }));
    setDate(entry.date);
    if (entry.date === today) setMinute(entry.startMinute);
    go(returnTo === "plan" || entry.status === "planned" ? "plan" : "home");
    setNotice("Activity saved");
  };
  const nextStep = () => {
    if (!draft) return;
    if (step === "activity" && editingEntry && draft.status === "planned") {
      save(draft);
      return;
    }
    if (step === "activity" && draft.status === "done" && sleepBoundary(draft.name)) {
      save(draft);
      return;
    }
    if (step === "time" && !validateTime(draft)) return;
    if (step === "mood") {
      setDraft({ ...draft, mood: draft.mood ?? 5 });
      setStep("enjoyment");
      return;
    }
    if (step === "enjoyment") {
      setDraft({ ...draft, rating: draft.rating ?? 5 });
      setStep("importance");
      return;
    }
    if (step === "importance") {
      save({ ...draft, importance: draft.importance ?? 5 });
      return;
    }
    if (step === "time" && (draft.status === "planned" || Boolean(sleepBoundary(draft.name)))) {
      save(draft);
      return;
    }
    setStep(steps[steps.indexOf(step) + 1]);
  };
  const previousStep = () => {
    const index = steps.indexOf(step);
    if (index > 0) setStep(steps[index - 1]);
    else go(returnTo);
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
    back?: () => void,
    backLabel = "Back",
  ) => (
    <>
      {back && (
        <button className="back" onClick={back}>
          <ArrowLeft size={24} />
          {backLabel}
        </button>
      )}
      <div className="page-title">
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
      </div>
    </>
  );

  return (
    <div className={`app-shell ${relaxed ? "theme-relax" : screen === "values" ? "theme-values" : "theme-activity"}`}>
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
                    <span className="hello-sun" role="img" aria-label={clock.getHours() < 6 || clock.getHours() >= 18 ? "Evening" : clock.getHours() < 12 ? "Morning" : "Afternoon"}>
                      {clock.getHours() < 6 || clock.getHours() >= 18
                        ? <MoonStar size={29} />
                        : clock.getHours() < 12
                          ? <Sun size={29} />
                          : <CloudSun size={29} />}
                    </span>
                  </h1>
                </div>
                <div className="home-dashboard">
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
                    <div
                      key={entry.id}
                      className="activity-card home-activity"
                    >
                      <button
                        className="home-activity-open"
                        aria-label={`Edit ${entry.name}`}
                        disabled={Boolean(entry.sleepId)}
                        onClick={() => editEntry(entry, "home")}
                      >
                        {hasActivityIcon(entry.icon, entry.name) && (
                          <span className="activity-art">
                            <ActivityIcon id={entry.icon} size={48} name={entry.name} />
                          </span>
                        )}
                        <strong>{entry.name}</strong>
                      </button>
                      <div className="entry-controls">
                        {!entry.sleepId && (
                          <>
                            <button className="entry-icon-control is-delete" aria-label={`Delete ${entry.name}`} onClick={() => deleteEntry(entry.id)}><Trash2 /></button>
                            <button className="entry-icon-control" aria-label={`Edit ${entry.name}`} onClick={() => editEntry(entry, "home")}><Pencil /></button>
                          </>
                        )}
                        <button
                          type="button"
                          className={`completion-toggle ${entry.status === "done" ? "is-complete" : "is-planned"}`}
                          aria-label={entry.sleepId ? "Automatic sleep entry" : `Mark ${entry.name} as ${entry.status === "done" ? "planned" : "completed"}`}
                          aria-pressed={entry.status === "done"}
                          disabled={Boolean(entry.sleepId) || (entry.status === "planned" && slotDate(entry.date, entry.startMinute) > clock)}
                          onClick={() => toggleStatus(entry.id)}
                        >
                          {entry.status === "done" ? <Check /> : <Clock />}
                        </button>
                      </div>
                    </div>
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
                <div className="home-actions">
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
                      <img className="mindfulness-icon" src="/illustrations/mindfulness.svg" alt="" />
                    </span>
                    <h3>Mindfulness</h3>
                    <ChevronRight className="tile-arrow" size={23} />
                  </button>
                </div>

                <div className="action-grid home-secondary-grid">
                  <button className="action-card mood-card" onClick={() => go("dailyMood")}>
                    <span className="mood-topline">
                      <span className="tile-icon"><Smile size={30} /></span>
                      {data.ratings[today] !== undefined && <span className="mood-score">{data.ratings[today]} / 10</span>}
                    </span>
                    <h3>Log your mood</h3>
                    <ChevronRight className="tile-arrow" size={23} />
                  </button>
                  <button className="action-card values-card" onClick={() => go("values")}>
                    <span className="tile-icon"><Heart size={30} /></span>
                    <h3>My values</h3>
                    <ChevronRight className="tile-arrow" size={23} />
                  </button>
                </div>
                </div>
                </div>
              </>
            )}
            {screen === "plan" && (
              <>
                {header("Activity Log")}
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
                  onEdit={(entry) => editEntry(entry, "plan")}
                  onDelete={deleteEntry}
                  onToggle={toggleStatus}
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
                    suggestions={suggestedActivities(data)}
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
                {step === "importance" && (
                  <RatingSlider
                    label="Importance"
                    value={draft.importance ?? 5}
                    onChange={(importance) =>
                      setDraft({ ...draft, importance })
                    }
                  />
                )}
                <div className="wizard-actions">
                  <button
                    className="primary"
                    disabled={step === "activity" && !draft.name.trim()}
                    onClick={nextStep}
                  >
                    {step === "importance" ||
                    (step === "activity" && editingEntry && draft.status === "planned") ||
                    (step === "activity" && draft.status === "done" && !!sleepBoundary(draft.name)) ||
                    (step === "time" &&
                      (draft.status === "planned" || !!sleepBoundary(draft.name))) ? (
                      <>
                        <Check /> Save activity
                      </>
                    ) : (
                      <>
                        Next <ArrowRight />
                      </>
                    )}
                  </button>
                  {(step === "mood" ||
                    step === "enjoyment" ||
                    step === "importance") && (
                    <button
                      className="secondary"
                      onClick={() => {
                        if (step === "mood") {
                          setDraft({ ...draft, mood: undefined });
                          setStep("enjoyment");
                        } else if (step === "enjoyment") {
                          setDraft({ ...draft, rating: undefined });
                          setStep("importance");
                        } else save({ ...draft, importance: undefined });
                      }}
                    >
                      Skip
                    </button>
                  )}
                </div>
              </>
            )}
            {screen === "relax" && (
              <>
                {header("Mindfulness")}
                <div className="relaxation-options">
                  <button className="entry-row" onClick={() => go("breathing")}>
                    <span className="entry-picture">
                      <ActivityIcon id="mindfulness" size={48} />
                    </span>
                    <strong>Breathing</strong>
                    <ChevronRight />
                  </button>
                  <button
                    className="entry-row"
                    onClick={() => go("visualization")}
                  >
                    <span className="entry-picture">
                      <ActivityIcon id="mindfulness" size={48} />
                    </span>
                    <strong>Visualization</strong>
                    <ChevronRight />
                  </button>
                  <button
                    className="entry-row"
                    onClick={() => go("stretching")}
                  >
                    <span className="entry-picture">
                      <ActivityIcon id="health" size={48} />
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
                <BreathingGuide onSession={recordMindfulness} />
              </>
            )}
            {screen === "visualization" && (
              <>
                {header("Visualization", () => go("relax"), "Back")}
                <RelaxationVideo
                  kind="visualization"
                  onSession={recordMindfulness}
                />
              </>
            )}
            {screen === "stretching" && (
              <>
                {header("Gentle stretching", () => go("relax"), "Back")}
                <RelaxationVideo
                  kind="stretching"
                  onSession={recordMindfulness}
                />
              </>
            )}
            {screen === "dailyMood" && (
              <>
                {header("How was your day?")}
                <DailyMood
                  value={data.ratings[today]}
                  onSave={(value) => {
                    setData((prev) => ({
                      ...prev,
                      ratings: { ...prev.ratings, [today]: value },
                    }));
                    go("home");
                  }}
                />
              </>
            )}
            {screen === "values" && (
              <>
                {header("My values")}
                <Values data={data} onChange={setData} />
              </>
            )}
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
                <ReportSettings data={data} onChange={setData} />
                <button className="secondary reset-button" onClick={reset}>
                  Start over
                </button>
                <p className="reset-description">
                  Clear all saved information.
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
            <span>Activity Log</span>
          </button>
          <button
            className={relaxed ? "active relax-nav" : "relax-nav"}
            onClick={() => go("relax")}
          >
            <ActivityIcon id="mindfulness" size={30} />
            <span>Mindfulness</span>
          </button>
        </nav>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
