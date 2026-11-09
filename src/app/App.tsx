import { suggestedActivities } from "../domain/activities/catalogue";
import { recommendedActivities } from "../domain/activities/recommended";
import { useEffect, useRef, useState } from "react";
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
  LifeValue,
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
  entryEnd, entryTimeLabel, findEntry, repeatActivity, stopRepeating, type Repeat,
} from "../domain/model";
import { WeekPicker } from "../shared/ui/WeekPicker";
import { TimePicker } from "../features/activities/TimePicker";
import { DurationPicker } from "../features/activities/DurationPicker";
import { nextActivitySlot } from "../domain/date-time";
import { ActivityIcon } from "../features/activities/ActivityIcon";
import { personalActivity } from "../domain/activities/personal";
import { ActivityPicker } from "../features/activities/ActivityPicker";
import { RatingSlider, ScaleInfo, type RatingKind } from "../shared/ui/RatingSlider";
import { DayTimeline } from "../features/activities/DayTimeline";
import {
  BreathingGuide,
  RelaxationVideo,
  VisualizationChoices,
  VisualizationGuide,
  VisualizationTheme,
  breathingDurations,
  BreathingDurationField,
} from "../features/mindfulness/Relaxation";
import { SpeechField } from "../shared/ui/SpeechField";
import { type Account } from "../services/supabase/account-cache";
import { useCloudSync } from "../services/supabase/useCloudSync";
import { cloud } from "../services/supabase/cloud";
import { useReadAloud } from "../shared/accessibility/useReadAloud";
import { ScheduleControls } from "../features/activities/ScheduleControls";
import { ItemActions } from "../shared/ui/ItemActions";
import { activitySteps, type ActivityStep } from "../features/activities/activity-flow";
import { cachedImportance, rememberImportance } from "../domain/activities/importance";
import { Values, ScheduleValuePicker } from "../features/values/Values";
import { GuidedTour } from "../features/onboarding/GuidedTour";
import { DailyMood } from "../features/mood/DailyMood";
import { SettingsPage } from "./SettingsPage";

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
const stepScales: Partial<Record<Step, RatingKind>> = { mood: "Mood", enjoyment: "Enjoyment", importance: "Importance" };
const stepTitles: Record<Step, string> = {
  activity: "What activity?",
  value: "Values",
  day: "Which day?",
  time: "What time?",
  duration: "Choose how long the activity lasted",
  mood: "What was your mood immediately after this activity?",
  enjoyment: "How much did you enjoy the activity?",
  importance: "How important was the activity?",
};

export function App({ account }: { account?: Account }) {
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
  const [tourOpen, setTourOpen] = useState(!data.tutorialSeen);
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
  const [repeat, setRepeat] = useState<Repeat | "none">("none");
  const [importanceRated, setImportanceRated] = useState(false);
  const [chooseDay, setChooseDay] = useState(false);
  useReadAloud(data.readAloud);
  const [returnTo, setReturnTo] = useState<"home" | "plan" | "values">("home");
  const [focusedValueId, setFocusedValueId] = useState<string>();
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
  const steps = activitySteps({ planning, completing: completingPlan, chooseDay,
    sleep: Boolean(draft && sleepBoundary(draft.name)),
    importanceCached: Boolean(draft && cachedImportance(data, draft.name, clock) !== undefined),
    valueLinked: returnTo === "values" && Boolean(draft?.valueId) });
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
    origin: "home" | "plan" | { value: LifeValue; activity: ActivityChoice } = "home",
  ) => {
    const linked = typeof origin === "object" ? origin : undefined;
    setDraft({
      id: crypto.randomUUID(),
      ...(linked?.activity ?? { name: "", icon: "custom" }),
      valueId: linked?.value.id,
      lifeArea: linked?.value.area,
      date: selectedDate,
      startMinute: selectedMinute,
      durationMinutes: 30,
      status,
      source: status === "planned" ? "scheduled" : "logged",
    });
    setCompletingPlan(false);
    setChooseDay(Boolean(linked));
    setRepeat("none");
    setImportanceRated(false);
    setReturnTo(typeof origin === "object" ? "values" : origin);
    setStep(linked ? "day" : "activity");
    go("edit");
  };
  const scheduleFromValue = (value: LifeValue, activity: ActivityChoice) => {
    const later = nextActivitySlot();
    setFocusedValueId(value.id);
    newEntry("planned", later.date, later.startMinute, { value, activity });
  };
  const editEntry = (entry: Entry, origin: "home" | "plan") => {
    const startMinute = Math.floor(entry.startMinute / 30) * 30;
    setDraft({ ...entry, startMinute, durationMinutes: Math.min(1440 - startMinute, Math.ceil((entryEnd(entry) - startMinute) / 30) * 30) });
    setCompletingPlan(false);
    setChooseDay(entry.source === "scheduled" && entry.status !== "done" && !entry.seriesId);
    setRepeat("none");
    setImportanceRated(false);
    setReturnTo(origin);
    setStep("activity");
    go("edit");
  };
  const deleteEntry = (id: string) => {
    setData((previous) => removeEntry(previous, id));
    setNotice("Activity deleted");
  };
  const resizeEntry = (entry: Entry) => {
    if (entry.status === "done" && slotDate(entry.date, entry.startMinute) > new Date()) {
      setNotice("A logged activity must start now or earlier."); return false;
    }
    setData((previous) => {
      const current = findEntry(previous, entry.id);
      return current ? saveActivity(previous, { ...current, startMinute: entry.startMinute, durationMinutes: entry.durationMinutes }) : previous;
    });
    setNotice("Activity duration updated");
    return true;
  };
  const scheduleOutcome = (id: string, outcome: "done" | "missed", origin: "home" | "plan") => {
    const entry = findEntry(data, id);
    if (!entry || entry.source !== "scheduled" || slotDate(entry.date, entry.startMinute) > new Date()) return;
    if (outcome === "missed") {
      setData((previous) => setScheduledStatus(previous, id, outcome));
      setNotice("Activity marked not completed");
      return;
    }
    setDraft({ ...entry, status: "done" });
    setCompletingPlan(true);
    setRepeat("none");
    setImportanceRated(false);
    setReturnTo(origin);
    setStep("mood");
    go("edit");
  };
  const chooseActivity = (choice: ActivityChoice) => {
    choice = personalActivity(data.myActivities, choice);
    setDraft((prev) => (prev ? { ...prev, ...choice,
      ...(choice.name !== prev.name ? { mood: undefined, rating: undefined, importance: undefined } : {}) } : prev));
    if (choice.name.trim()) setData((prev) => rememberActivity(prev, choice));
  };
  const validateTime = (entry: Entry) => {
    const now = new Date();
    const future = slotDate(entry.date, entry.startMinute) > now;
    if (entry.status === "done" && future) {
      setNotice("Choose now or an earlier time.");
      return false;
    }
    const old = findEntry(data, entry.id);
    const unchanged =
      old && old.date === entry.date && old.startMinute === entry.startMinute;
    if (entry.source === "scheduled" && entry.status !== "done" && !unchanged && !future) {
      setNotice("Choose a later time.");
      return false;
    }
    return true;
  };
  const save = (entry: Entry, ratedImportance = importanceRated) => {
    if (!entry.name.trim() || !validateTime(entry)) return;
    setData((prev) => {
      const importance = ratedImportance ? entry.importance : cachedImportance(prev, entry.name);
      const prepared = { ...entry, name: entry.name.trim(), ...(entry.status === "done" && importance !== undefined ? { importance } : {}) };
      const next = repeat !== "none" && planning && !entry.seriesId ? repeatActivity(prev, prepared, repeat) : saveActivity(prev, prepared);
      return ratedImportance && importance !== undefined
        ? rememberImportance(next, entry.name, importance) : next;
    });
    setDate(entry.date);
    if (entry.date === today) setMinute(Math.floor(entry.startMinute / 30) * 30);
    go(returnTo);
    setNotice("Activity saved");
  };
  const nextStep = () => {
    if (!draft) return;
    if (valueMissing) return;
    if (step === "time" && !validateTime(draft)) return;
    const updated = { ...draft,
      ...(step === "mood" ? { mood: draft.mood ?? 5 } : {}),
      ...(step === "enjoyment" ? { rating: draft.rating ?? 5 } : {}),
      ...(step === "importance" ? { importance: draft.importance ?? 5 } : {}) };
    if (step === "importance") setImportanceRated(true);
    if (lastStep) { save(updated, step === "importance" || importanceRated); return; }
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
  const ratingKind = screen === "dailyMood" ? "Mood" : screen === "edit" ? stepScales[step] : undefined;
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
      <div className={`page-title${ratingKind ? " scale-title" : ""}`}>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {ratingKind && <ScaleInfo kind={ratingKind} activity={screen === "edit"} />}
      </div>
    </>
  );

  return (
    <div className={`app-shell ${tourOpen && data.name ? "tutorial-active" : ""} ${screen === "edit" && planning ? "theme-values" : relaxed ? "theme-relax" : screen === "values" ? "theme-values" : "theme-activity"}`}>
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
                data-tour="settings"
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
                <section className="moment-section" data-tour="current">
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
                        <span className="activity-art">
                          <ActivityIcon id={entry.icon} size={48} name={entry.name} />
                        </span>
                        <div className="home-entry-description"><strong>{entry.name}</strong><time>{entryTimeLabel(entry)}</time></div>
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
                    data-tour="add"
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
                    className="action-card plan-card" data-tour="log"
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
                    className="action-card relax-card" data-tour="mindfulness"
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
                  <button className="action-card mood-card" data-tour="mood" onClick={() => go("dailyMood")}>
                    <span className="mood-topline">
                      <span className="tile-icon"><Smile size={30} /></span>
                      {data.ratings[today] !== undefined && <span className="mood-score">{data.ratings[today]} / 10</span>}
                    </span>
                    <h3>Log your mood</h3>
                    <ChevronRight className="tile-arrow" size={23} />
                  </button>
                  <button className="action-card values-card" data-tour="values" onClick={() => go("values")}>
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
                  onResize={resizeEntry}
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
                    const later = nextActivitySlot();
                    const selectedDate = date < later.date ? later.date : date;
                    newEntry(
                      "planned",
                      selectedDate,
                      selectedDate === later.date ? later.startMinute : 540,
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
                {header(stepTitles[step])}
                {step === "activity" && (
                  <ActivityPicker
                    key={draft.id}
                    value={draft}
                    recommended={recommendedActivities(data, draft, clock)}
                    mine={data.myActivities}
                    suggestions={planning ? suggestedActivities(data) : []}
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
                {step === "time" && <>
                  <TimePicker value={{ startMinute: draft.startMinute, durationMinutes: draft.durationMinutes ?? 30 }}
                    onChange={(range) => setDraft({ ...draft, ...range })} />
                  {planning && !draft.seriesId && <div className="repeat-settings">
                    <label className="repeat-checkbox"><input type="checkbox" checked={repeat !== "none"} onChange={(event) => setRepeat(event.target.checked ? "daily" : "none")} />Repeat this activity</label>
                    {repeat !== "none" && <div className="repeat-choices" role="group" aria-label="Repeat frequency">
                      {(["daily", "weekdays", "weekly"] as const).map((frequency) => <button type="button" key={frequency} aria-pressed={repeat === frequency}
                        className={repeat === frequency ? "active" : ""} onClick={() => setRepeat(frequency)}>{frequency === "daily" ? "Every day" : frequency === "weekdays" ? "Weekdays" : "Every week"}</button>)}
                    </div>}
                  </div>}
                  {draft.seriesId && <div className="repeat-settings"><p>This activity repeats. Edits here apply only to this date.</p>
                    <button type="button" className="secondary" onClick={() => { const seriesId = draft.seriesId; if (!seriesId) return; setData((previous) => stopRepeating(previous, seriesId, draft.date)); setDraft({ ...draft, seriesId: undefined }); setNotice("Repeats stopped from this date. Save to keep this activity."); }}>Stop repeating from this date</button></div>}
                </>}
                {step === "duration" && <DurationPicker startMinute={draft.startMinute} value={draft.durationMinutes} onChange={(durationMinutes) => setDraft({ ...draft, durationMinutes })} />}
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
                {step === "importance" && (
                  <button className="wizard-skip" onClick={() => { setImportanceRated(false); if (steps.includes("duration")) { setDraft({ ...draft, importance: undefined }); setStep("duration"); } else save({ ...draft, importance: undefined }, false); }}>Skip rating</button>
                )}
                <div className="wizard-footer">
                  <div className="wizard-actions">
                    {(steps.indexOf(step) > 0 || completingPlan || editingEntry || lastStep || returnTo === "values") && (
                      <button type="button" className="wizard-back" onClick={previousStep}><ArrowLeft aria-hidden="true" />Back</button>
                    )}
                    <button type="button" className="wizard-next"
                      disabled={valueMissing || (step === "activity" && !draft.name.trim())}
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
                      <ActivityIcon id="breathing" size={48} />
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
                      <ActivityIcon id="visualization" size={48} />
                    </span>
                    <strong>Visualization</strong>
                    <ChevronRight />
                  </button>
                  <button
                    className="entry-row"
                    onClick={() => go("stretching")}
                  >
                    <span className="entry-picture">
                      <ActivityIcon id="stretching" size={48} />
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
                <Values data={data} onChange={setData} onSchedule={scheduleFromValue} initialValueId={focusedValueId} />
              </>
            )}
            {screen === "settings" && (
              <>
                {header("Settings")}
                <SettingsPage data={data} onDataChange={setData} name={name} onNameChange={setName}
                  identity={account ? { userId: account.session.user.id, username: account.username } : undefined}
                  sync={sync} onNotice={setNotice} onReset={reset} onTutorial={() => { go("home"); setTourOpen(true); }}
                  onSignOut={async () => {
                    if (await sync.sync()) {
                      const result = await cloud?.auth.signOut();
                      if (result?.error) setNotice("Could not sign out. Try again.");
                    }
                  }} />
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
      {tourOpen && data.name && <GuidedTour onFinish={() => {
        setTourOpen(false);
        setData((previous) => ({ ...previous, tutorialSeen: true }));
      }} />}
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
