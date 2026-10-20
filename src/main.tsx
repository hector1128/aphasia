import { suggestedActivities } from "./activity-catalogue";
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
  Clock,
  Heart,
  House,
  Smile,
  Brain,
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
  setScheduledStatus,
  sleepBoundary,
  removeEntry,
  slotDate,
  entriesInSlot,
  rememberActivity,
} from "./model";
import { WeekPicker, TimePicker } from "./DateTimePicker";
import { ActivityIcon, hasActivityIcon } from "./ActivityIcon";
import { ActivityPicker } from "./ActivityPicker";
import { RatingSlider } from "./RatingSlider";
import { DayTimeline } from "./DayTimeline";
import {
  BreathingGuide,
  RelaxationVideo,
  VisualizationChoices,
  VisualizationGuide,
  VisualizationTheme,
  breathingDurations,
  BreathingDurationField,
} from "./Relaxation";
import { SpeechField } from "./SpeechField";
import { Accounts, type Account } from "./Accounts";
import { useCloudSync } from "./useCloudSync";
import { cloud } from "./cloud";
import { useReadAloud } from "./useReadAloud";
import { ScheduleControls } from "./ScheduleControls";
import { ItemActions } from "./ItemActions";
import { activitySteps, type ActivityStep } from "./activity-flow";
import { Values, ScheduleValuePicker } from "./Values";
import { ReportSettings } from "./ReportSettings";
import { FaceSettings } from "./FaceSettings";
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
type Step = ActivityStep;
const stepTitles: Record<Step, string> = {
  activity: "What activity?",
  value: "Values",
  day: "Which day?",
  time: "What time?",
  mood: "How did you feel?",
  enjoyment: "How much did you enjoy it?",
  importance: "How important was it?",
};

function App({ account }: { account?: Account }) {
  const [data, setData] = useState<Data>(() => {
    if (account) return account.initial.data;
    try {
      return readData(
        localStorage.getItem(STORAGE_KEY) ??
          localStorage.getItem(LEGACY_STORAGE_KEY),
      );
    } catch {
      return emptyData();
    }
  });
  const sync = useCloudSync(account, data, setData);
  const [screen, setScreen] = useState<Screen>("home");
  const [name, setName] = useState(data.name);
  const [clock, setClock] = useState(() => new Date());
  const [minute, setMinute] = useState(currentSlot());
  const [date, setDate] = useState(dateKey(new Date()));
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [draft, setDraft] = useState<Entry | null>(null);
  const [step, setStep] = useState<Step>("activity");
  const [completingPlan, setCompletingPlan] = useState(false);
  const [timeValid, setTimeValid] = useState(true);
  const [chooseTime, setChooseTime] = useState(false);
  useReadAloud(data.readAloud);
  const [returnTo, setReturnTo] = useState<"home" | "plan">("home");
  const [breathingDuration, setBreathingDuration] = useState<number | null>(null);
  const [visualizationTheme, setVisualizationTheme] = useState<VisualizationTheme | null>(null);
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
  const planning = draft?.source === "scheduled" && draft.status !== "done" && !completingPlan;
  const valueMissing = step === "value" && data.values.length > 0 && !draft?.lifeArea;
  const steps = activitySteps({ planning, completing: completingPlan, chooseTime, sleep: Boolean(draft && sleepBoundary(draft.name)) });
  const lastStep = step === steps[steps.length - 1];

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (account) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [account, data]);
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
    status: "planned" | "done",
    selectedDate = today,
    selectedMinute = minute,
    origin: "home" | "plan" = "home",
    chooseDateAndTime = false,
  ) => {
    setDraft({
      id: crypto.randomUUID(),
      name: "",
      icon: "custom",
      date: selectedDate,
      startMinute: selectedMinute,
      status,
      source: status === "planned" ? "scheduled" : "logged",
    });
    setCompletingPlan(false);
    setChooseTime(chooseDateAndTime);
    setTimeValid(true);
    setReturnTo(origin);
    setStep("activity");
    go("edit");
  };
  const editEntry = (entry: Entry, origin: "home" | "plan") => {
    setDraft({ ...entry });
    setCompletingPlan(false);
    setChooseTime(entry.source === "scheduled" && entry.status !== "done");
    setTimeValid(true);
    setReturnTo(origin);
    setStep("activity");
    go("edit");
  };
  const deleteEntry = (id: string) => {
    setData((previous) => removeEntry(previous, id));
    setNotice("Activity deleted");
  };
  const scheduleOutcome = (id: string, outcome: "done" | "missed", origin: "home" | "plan") => {
    const entry = data.entries[id];
    if (!entry || entry.source !== "scheduled" || slotDate(entry.date, entry.startMinute) > new Date()) return;
    if (outcome === "missed") {
      setData((previous) => setScheduledStatus(previous, id, outcome));
      setNotice("Activity marked not completed");
      return;
    }
    setDraft({ ...entry, status: "done" });
    setCompletingPlan(true);
    setReturnTo(origin);
    setStep("mood");
    go("edit");
  };
  const chooseActivity = (choice: ActivityChoice) => {
    setDraft((prev) => (prev ? { ...prev, ...choice } : prev));
    if (choice.name.trim()) setData((prev) => rememberActivity(prev, choice));
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
    if (entry.source === "scheduled" && entry.status !== "done" && !unchanged && !future) {
      setNotice("Choose a later time.");
      return false;
    }
    return true;
  };
  const save = (entry: Entry) => {
    if (!entry.name.trim() || !validateTime(entry)) return;
    setData((prev) => saveActivity(prev, { ...entry, name: entry.name.trim() }));
    setDate(entry.date);
    if (entry.date === today) setMinute(Math.floor(entry.startMinute / 30) * 30);
    go(returnTo);
    setNotice("Activity saved");
  };
  const nextStep = () => {
    if (!draft) return;
    if (valueMissing) return;
    if (step === "time" && (!timeValid || !validateTime(draft))) return;
    const updated = { ...draft,
      ...(step === "mood" ? { mood: draft.mood ?? 5 } : {}),
      ...(step === "enjoyment" ? { rating: draft.rating ?? 5 } : {}),
      ...(step === "importance" ? { importance: draft.importance ?? 5 } : {}) };
    if (lastStep) { save(updated); return; }
    setDraft(updated);
    setStep(steps[steps.indexOf(step) + 1]);
  };
  const previousStep = () => {
    const index = steps.indexOf(step);
    if (index > 0) setStep(steps[index - 1]);
    else go(returnTo);
  };
  const reset = () => {
    setData({ ...emptyData(), name: account ? data.name : "" });
    setName("");
    setDraft(null);
    setStep("activity");
    setMinute(currentSlot());
    setDate(dateKey(new Date()));
    go("home");
    // Keep old data from being re-imported if the current storage key is later removed.
    try {
      if (!account) localStorage.removeItem(LEGACY_STORAGE_KEY);
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
    <div className={`app-shell ${screen === "edit" && planning ? "theme-values" : relaxed ? "theme-relax" : screen === "values" ? "theme-values" : "theme-activity"}`}>
      <main>
        <div className={`screen-transition ${screen === "edit" ? "activity-wizard" : ""}`} key={`${screen}-${step}`}>
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
              <SpeechField
                id="name"
                autoComplete="given-name"
                placeholder="Your first name"
                value={name}
                maxLength={40}
                onValueChange={setName}
              />
              <button className="primary" disabled={!name.trim()}>
                Let’s begin <ArrowRight size={24} />
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className={`topbar ${screen === "home" ? "" : "page-topbar"}`}>
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
                      className={`activity-card home-activity ${entry.source === "scheduled" ? "scheduled-entry" : ""}`}
                    >
                      <div
                        className="home-activity-open"
                      >
                        {hasActivityIcon(entry.icon, entry.name) && (
                          <span className="activity-art">
                            <ActivityIcon id={entry.icon} size={48} name={entry.name} />
                          </span>
                        )}
                        <div className="home-entry-description"><strong>{entry.name}</strong></div>
                      </div>
                      <div className="entry-controls">
                        <ScheduleControls entry={entry} now={clock} onOutcome={(id, outcome) => scheduleOutcome(id, outcome, "home")} />
                        {!entry.sleepId && (
                          <ItemActions name={entry.name} onDelete={() => deleteEntry(entry.id)} onEdit={() => editEntry(entry, "home")} />
                        )}
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
                    <h3>Activity Log</h3>
                    <ChevronRight className="tile-arrow" size={23} />
                  </button>
                  <button
                    className="action-card relax-card"
                    onClick={() => go("relax")}
                  >
                    <span className="tile-icon">
                      <Brain size={30} aria-hidden="true" />
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
                  onToggle={(id, outcome) => scheduleOutcome(id, outcome, "plan")}
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
                      true,
                    );
                  }}
                >
                  <Plus /> Plan activity
                </button>
              </>
            )}
            {screen === "edit" && draft && (
              <>
                {header(stepTitles[step])}
                {step === "activity" && (
                  <ActivityPicker
                    key={draft.id}
                    value={draft}
                    recent={data.recentActivities}
                    suggestions={suggestedActivities(data)}
                    onChange={chooseActivity}
                  />
                )}
                {step === "value" && <ScheduleValuePicker data={data} onDataChange={setData} area={draft.lifeArea} valueId={draft.valueId}
                  onChange={(selection) => setDraft({ ...draft, ...selection, valueId: selection.valueId })} />}
                {step === "day" && (
                  <WeekPicker
                    value={draft.date}
                    min={
                      planning
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
                    <TimePicker
                      value={draft.startMinute}
                      onValidityChange={setTimeValid}
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
                {step === "time" && !timeValid && <p role="alert">Enter an hour from 1 to 12 and minutes from 00 to 59.</p>}
                {(step === "mood" || step === "enjoyment" || step === "importance") && (
                  <button className="wizard-skip" onClick={() => {
                    if (step === "mood") { setDraft({ ...draft, mood: undefined }); setStep("enjoyment"); }
                    else if (step === "enjoyment") { setDraft({ ...draft, rating: undefined }); setStep("importance"); }
                    else save({ ...draft, importance: undefined });
                  }}>Skip rating</button>
                )}
                <div className="wizard-footer">
                  <div className="wizard-actions">
                    {(steps.indexOf(step) > 0 || completingPlan || editingEntry || lastStep) && (
                      <button type="button" className="wizard-back" onClick={previousStep}><ArrowLeft aria-hidden="true" />Back</button>
                    )}
                    <button type="button" className="wizard-next"
                      disabled={valueMissing || (step === "activity" && !draft.name.trim()) || (step === "time" && !timeValid)}
                      onClick={nextStep}>
                      {lastStep ? <><span>Save activity</span><Check aria-hidden="true" /></> : <><span>Next</span><ArrowRight aria-hidden="true" /></>}
                    </button>
                  </div>
                  <div className="wizard-progress" role="img" aria-label={`Step ${steps.indexOf(step) + 1} of ${steps.length}`}>
                    {steps.map((item) => <span key={item} aria-hidden="true" className={item === step ? "active" : ""} />)}
                  </div>
                </div>
              </>
            )}
            {screen === "relax" && (
              <>
                {header("Mindfulness")}
                <div className="relaxation-options">
                  <button className="entry-row" onClick={() => {
                    setBreathingDuration(null);
                    go("breathing");
                  }}>
                    <span className="entry-picture">
                      <ActivityIcon id="mindfulness" size={48} />
                    </span>
                    <strong>Breathing</strong>
                    <ChevronRight />
                  </button>
                  <button
                    className="entry-row"
                    onClick={() => {
                      setVisualizationTheme(null);
                      go("visualization");
                    }}
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
                {header("Breathing", () => breathingDuration ? setBreathingDuration(null) : go("relax"), "Back")}
                {breathingDuration ? (
                  <BreathingGuide key={breathingDuration} minutes={breathingDuration} onSession={recordMindfulness} />
                ) : (
                  <div className="breathing-setup">
                    <img src="/images/breathing-adult.jpg" alt="An adult sitting comfortably with hands on their abdomen" />
                    <p>Be still.</p>
                    <p>Bring attention to your breath.</p>
                    <h2>How long?</h2>
                    <div className="breathing-durations">
                      {breathingDurations.map((minutes) => (
                        <button key={minutes} onClick={() => setBreathingDuration(minutes)}>
                          <strong>{minutes}</strong>
                          <span>{minutes === 1 ? "minute" : "minutes"}</span>
                        </button>
                      ))}
                    </div>
                    <BreathingDurationField onChoose={setBreathingDuration} />
                  </div>
                )}
              </>
            )}
            {screen === "visualization" && (
              <>
                {header(visualizationTheme?.title ?? "Visualization", () => visualizationTheme ? setVisualizationTheme(null) : go("relax"), "Back")}
                {visualizationTheme ? (
                  <VisualizationGuide key={visualizationTheme.id} theme={visualizationTheme} onSession={recordMindfulness} />
                ) : (
                  <VisualizationChoices onChoose={setVisualizationTheme} />
                )}
              </>
            )}
            {screen === "stretching" && (
              <>
                {header("Gentle stretching", () => go("relax"), "Back")}
                <RelaxationVideo onSession={recordMindfulness} />
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
                  <SpeechField
                    id="edit-name"
                    aria-label="Your name"
                    value={name}
                    maxLength={40}
                    onValueChange={setName}
                  />
                  <button className="primary" disabled={!name.trim()}>
                    Save name <Check />
                  </button>
                </form>
                <section className="read-aloud-settings">
                  <h2>Read aloud</h2>
                  <button className="secondary" role="switch" aria-checked={data.readAloud}
                    onClick={() => setData((previous) => ({ ...previous, readAloud: !previous.readAloud }))}>
                    {data.readAloud ? "Read aloud: On" : "Read aloud: Off"}
                  </button>
                  <p>Touch: tap to listen, then tap again to choose. Mouse: pause over a label to listen.</p>
                </section>
                <section className="account-settings">
                  <h2>Account</h2>
                  {account ? <>
                    <p>Username: {account.username}</p>
                    <p role="status">{sync.status === "saved" ? "Your log is synced." : sync.status === "saving" ? "Saving your changes…" : sync.status === "offline" ? "Changes are saved on this device. Connect to sync." : "Another device changed your log."}</p>
                    {sync.status === "offline" && <button className="secondary" onClick={() => void sync.sync()}>Try syncing</button>}
                    {sync.status === "conflict" && <>
                      <p>Choose which version to keep. Loading the synced log also downloads a backup of this device’s changes.</p>
                      <button className="secondary" onClick={() => sync.resolve("cloud")}>Save backup and load synced log</button>
                      <button className="secondary" onClick={() => sync.resolve("device")}>Keep this device’s changes</button>
                    </>}
                    {!Object.keys(data.entries).length && !data.values.length && !Object.keys(data.ratings).length && !data.sleeps.length && !data.mindfulness.length && <button className="secondary" onClick={() => {
                      try {
                        const previous = readData(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY));
                        if (Object.keys(previous.entries).length || previous.values.length || Object.keys(previous.ratings).length || previous.sleeps.length || previous.mindfulness.length) setData({ ...previous, name: data.name });
                        else setNotice("No existing browser log to import.");
                      } catch { setNotice("Could not read the existing browser log."); }
                    }}>Import this browser’s existing log</button>}
                    <button className="secondary" disabled={sync.status !== "saved"} onClick={async () => {
                      if (await sync.sync()) {
                        const result = await cloud?.auth.signOut();
                        if (result?.error) setNotice("Could not sign out. Try again.");
                      }
                    }}>Sign out</button>
                  </> : <p>Cloud accounts need setup. See docs/account-setup.md.</p>}
                </section>
                {account && <FaceSettings userId={account.session.user.id} username={account.username} />}
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
        {account && (sync.status === "offline" || sync.status === "conflict") && screen !== "settings" && (
          <div className="sync-banner" role="status">
            <span>{sync.status === "offline" ? "Waiting to sync" : "Review sync changes"}</span>
            <button onClick={() => go("settings")}>Settings</button>
          </div>
        )}
        {(storageError || sync.localError) && (
          <div className="error" role="alert">
            Could not save. Keep this page open.
          </div>
        )}
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={24} />
          {notice}
          <button aria-label="Dismiss" onClick={() => setNotice("")}>
            <X size={24} />
          </button>
        </div>
      )}
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
            aria-label="Mindfulness"
            onClick={() => go("relax")}
          >
            <Brain size={25} aria-hidden="true" />
            <span className="nav-mindfulness-full">Mindfulness</span>
            <span className="nav-mindfulness-short">Mindful</span>
          </button>
          <button
            className={screen === "values" ? "active values-nav" : "values-nav"}
            onClick={() => go("values")}
          >
            <Heart size={25} />
            <span>Values</span>
          </button>
        </nav>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Accounts>{(account) => <App key={account?.session.user.id ?? "local"} account={account} />}</Accounts>);
