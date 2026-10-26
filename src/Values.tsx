import { useState } from "react";
import { SpeechField } from "./SpeechField";
import { ArrowLeft, CalendarDays, ChevronRight, Plus } from "lucide-react";
import { ItemActions } from "./ItemActions";
import {
  Data,
  LifeArea,
  LifeValue,
  lifeAreas,
  dateKey,
} from "./model";
import { weekDates } from "./date-time";
import { WeekPicker } from "./DateTimePicker";
import { ActivityPicker } from "./ActivityPicker";
import { ActivityIcon } from "./ActivityIcon";

import { AreaIcon, areaLabel } from "./LifeAreaIcon";

export function valueActivitiesOnDay(data: Data, day: string) {
  return Object.values(data.entries)
    .filter((entry) => entry.date === day && !entry.sleepId && !entry.sleepBoundary)
    .sort((a, b) => a.startMinute - b.startMinute)
    .filter((entry, index, entries) => entries.findIndex((other) =>
      other.name.trim().toLowerCase() === entry.name.trim().toLowerCase()) === index);
}

export function Values({
  data,
  onChange,
  onSchedule,
  initialValueId,
}: {
  data: Data;
  onChange: (data: Data) => void;
  onSchedule: (value: LifeValue) => void;
  initialValueId?: string;
}) {
  const initialValue = data.values.find((value) => value.id === initialValueId);
  const [area, setArea] = useState<LifeArea | null>(initialValue?.area ?? null);
  const [id, setId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(initialValue?.id ?? null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [linkMode, setLinkMode] = useState<"choose" | "week" | "add" | null>(null);
  const [choice, setChoice] = useState({ name: "", icon: "custom" });
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const selected = data.values.find((v) => v.id === id);
  const update = (v: LifeValue) =>
    onChange({
      ...data,
      values: data.values.map((item) => (item.id === v.id ? v : item)),
    });
  const link = (a: { name: string; icon: string }) => {
    if (selected)
      update({
        ...selected,
        activities: [
          ...selected.activities.filter(
            (c) => c.name !== replacing && c.name.toLowerCase() !== a.name.toLowerCase(),
          ),
          a,
        ],
      });
    setExpanded(id);
    setId(null);
    setReplacing(null);
    setLinkMode(null);
    setChoice({ name: "", icon: "custom" });
  };
  const days = weekDates(dateKey(new Date())).map(dateKey);
  const dayChoices = valueActivitiesOnDay(data, selectedDay);
  if (!area)
    return (
      <div className="value-list view-transition" key="life-areas">
        {lifeAreas.map((a) => (
          <button className="entry-row value-navigation-row" key={a} onClick={() => setArea(a)}>
            <span className="value-heart"><AreaIcon area={a} /></span>
            <strong>{areaLabel(a)}</strong>
            <ChevronRight />
          </button>
        ))}
      </div>
    );
  if (editing)
    return (
      <form
        className="view-transition"
        key={`edit-${id ?? "new"}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const value: LifeValue = selected
            ? { ...selected, name: name.trim() }
            : { id: crypto.randomUUID(), area, name: name.trim(), activities: [] };
          if (selected) update(value);
          else onChange({ ...data, values: [...data.values, value] });
          setExpanded(value.id);
          setId(null);
          setEditing(false);
          setName("");
        }}
      >
        <button
          type="button"
          className="back"
          onClick={() => {
            setEditing(false);
            setId(null);
            setName("");
          }}
        >
          <ArrowLeft />
          Back
        </button>
        <label htmlFor="value-name">What matters to you?</label>
        <SpeechField
          id="value-name"
          aria-label="What matters to you?"
          value={name}
          maxLength={120}
          onValueChange={setName}
          autoFocus
        />
        <button className="primary" disabled={!name.trim()}>
          Save value
        </button>
      </form>
    );
  if (selected && linkMode)
    return (
      <div className="value-link-screen" key={`link-${linkMode}`}>
        <button className="back" onClick={() => { setLinkMode(null); setId(null); setReplacing(null); setChoice({ name: "", icon: "custom" }); }}>
          <ArrowLeft />
          Back to value
        </button>
        <h1 className="sr-only">
          {linkMode === "week" ? "Choose an activity from this week" : "Add an activity to this value"}
        </h1>
        {linkMode === "choose" ? (
          <div className="value-link-options">
            <button className="entry-row value-navigation-row" onClick={() => setLinkMode("week")}><span className="value-heart"><CalendarDays aria-hidden="true" /></span><strong>Choose from this week</strong><ChevronRight aria-hidden="true" /></button>
            <button className="entry-row value-navigation-row" onClick={() => onSchedule(selected)}><span className="value-heart"><Plus aria-hidden="true" /></span><strong>Schedule an activity</strong><ChevronRight aria-hidden="true" /></button>
          </div>
        ) : linkMode === "week" ? (
          <div className="value-week-activities">
            <WeekPicker value={selectedDay} onChange={setSelectedDay} min={days[0]} max={days[6]} />
            <h2 className="value-day-heading">{new Date(`${selectedDay}T12:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2>
          {dayChoices.length ? (
            <div className="week-activity-list view-transition" key={selectedDay}>{dayChoices.map((a) => (
              <button className="activity-choice" key={a.id} onClick={() => link({ name: a.name, icon: a.icon })}>
                <ActivityIcon id={a.icon} name={a.name} />
                {a.name}
                <Plus />
              </button>
            ))}</div>
          ) : (
            <div className="view-transition" key={selectedDay}><p role="status">No activities on this day. Choose another day or schedule an activity.</p><button className="primary" onClick={() => onSchedule(selected)}>Schedule an activity</button></div>
          )}
          </div>
        ) : (
          <>
            <ActivityPicker
              value={choice}
              recent={data.recentActivities}
              onChange={setChoice}
            />
            <button className="primary" disabled={!choice.name} onClick={() => link(choice)}>
              {replacing ? "Save activity" : "+ Add activity"}
            </button>
            <button className="secondary choose-week" onClick={() => setLinkMode("week")}>Choose from this week</button>
          </>
        )}
      </div>
    );
  return (
    <div className="view-transition" key={area}>
      <button className="back" onClick={() => setArea(null)}>
        <ArrowLeft />
        Life areas
      </button>
      <h2>{areaLabel(area)}</h2>
      <div className="value-list">
        {data.values
          .filter((v) => v.area === area)
          .map((v) => (
            <section key={v.id} className={`value-accordion ${expanded === v.id ? "is-expanded" : ""}`}>
              <div className="entry-row value-entry-row">
                <button className="value-row-main" aria-expanded={expanded === v.id} aria-controls={`value-activities-${v.id}`}
                  onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                  <span className="value-heart"><AreaIcon area={v.area} /></span>
                  <strong>{v.name}</strong>
                </button>
                <ItemActions name={v.name}
                  onDelete={() => onChange({ ...data, values: data.values.filter((item) => item.id !== v.id) })}
                  onEdit={() => { setId(v.id); setName(v.name); setEditing(true); }} />
                <button className="value-row-next" aria-label={`Activities for ${v.name}`} aria-expanded={expanded === v.id}
                  aria-controls={`value-activities-${v.id}`} onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                  <ChevronRight size={26} />
                </button>
              </div>
              <div id={`value-activities-${v.id}`} className="value-accordion-body" aria-hidden={expanded !== v.id} inert={expanded !== v.id}>
                <div className="value-accordion-inner">
                  <div className="value-activity-grid">
                    {v.activities.map((a) => (
                      <div className="value-activity-card" key={a.name}>
                        <span className="activity-art"><ActivityIcon id={a.icon} name={a.name} /></span>
                        <strong>{a.name}</strong>
                        <ItemActions name={a.name} deleteLabel={`Unlink ${a.name}`}
                          onDelete={() => update({ ...v, activities: v.activities.filter((activity) => activity.name !== a.name) })}
                          onEdit={() => { setId(v.id); setReplacing(a.name); setChoice(a); setLinkMode("add"); }} />
                      </div>
                    ))}
                    <button className="value-add-activity" aria-label={`Add activity to ${v.name}`}
                      onClick={() => { setId(v.id); setReplacing(null); setChoice({ name: "", icon: "custom" }); setLinkMode("choose"); }}>
                      <Plus aria-hidden="true" /><span>Add activity</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ))}
      </div>
      <button
        className="primary"
        onClick={() => {
          setId(null);
          setName("");
          setEditing(true);
        }}
      >
        <Plus />
        Add a value
      </button>
    </div>
  );
}

export function ScheduleValuePicker({ data, area, valueId, onChange, onDataChange }: {
  data: Data; area?: LifeArea; valueId?: string;
  onChange: (selection: { lifeArea?: LifeArea; valueId?: string }) => void;
  onDataChange: (data: Data) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newArea, setNewArea] = useState<LifeArea | null>(null);
  const [name, setName] = useState("");
  if (adding) return <div className="schedule-values schedule-value-create view-transition" key={newArea ?? "areas"}>
    {!newArea ? <>
      <h2>Choose a life area</h2>
      <div className="schedule-value-grid schedule-area-grid">{lifeAreas.map((item) =>
        <button type="button" className="entry-row" key={item} onClick={() => setNewArea(item)}>
          <span className="value-heart"><AreaIcon area={item} /></span><strong>{areaLabel(item)}</strong><ChevronRight />
        </button>)}</div>
      <div className="value-create-actions"><button type="button" className="wizard-back" onClick={() => setAdding(false)}><ArrowLeft aria-hidden="true" />Back</button></div>
    </> : <form onSubmit={(event) => {
      event.preventDefault();
      if (!name.trim()) return;
      const value: LifeValue = { id: crypto.randomUUID(), area: newArea, name: name.trim(), activities: [] };
      onDataChange({ ...data, values: [...data.values, value] });
      onChange({ lifeArea: newArea, valueId: value.id });
      setAdding(false); setNewArea(null); setName("");
    }}>
      <h2>{areaLabel(newArea)}</h2>
      <label htmlFor="schedule-value-name">What matters to you?</label>
      <SpeechField id="schedule-value-name" aria-label="What matters to you?" value={name} maxLength={120} onValueChange={setName} autoFocus />
      <div className="value-create-actions">
        <button type="button" className="wizard-back" onClick={() => setNewArea(null)}><ArrowLeft aria-hidden="true" />Back</button>
        <button className="wizard-next" disabled={!name.trim()}>Save value</button>
      </div>
    </form>}
  </div>;
  return <div className="schedule-values view-transition" key="values">
    <p> What is your goal for this activity</p>
    {/* {!data.values.length && <p>No values so far. Add a value, or continue without one.</p>} */}
    <div className="schedule-value-grid">
      {data.values.map((value) => <button type="button" className="entry-row" key={value.id}
        autoFocus={valueId === value.id} aria-pressed={valueId === value.id} onClick={() => onChange({ lifeArea: value.area, valueId: value.id })}>
        <span className="value-heart"><AreaIcon area={value.area} /></span><strong>{value.name}</strong>
      </button>)}
      <button type="button" className="entry-row add-schedule-value" onClick={() => setAdding(true)}><Plus /><span>Add a value</span></button>
    </div>
    {!valueId && area && <p>Life area: {areaLabel(area)}</p>}
  </div>;
}
