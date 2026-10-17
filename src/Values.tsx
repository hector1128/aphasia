import { suggestedActivities } from "./activity-catalogue";
import { useState } from "react";
import { SpeechField } from "./SpeechField";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { ItemActions } from "./ItemActions";
import {
  Data,
  LifeArea,
  LifeValue,
  lifeAreas,
  dateKey,
} from "./model";
import { weekDates } from "./date-time";
import { ActivityPicker } from "./ActivityPicker";
import { ActivityIcon, hasActivityIcon } from "./ActivityIcon";

import { AreaIcon, areaLabel } from "./LifeAreaIcon";

export function Values({
  data,
  onChange,
}: {
  data: Data;
  onChange: (data: Data) => void;
}) {
  const [area, setArea] = useState<LifeArea | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [linkMode, setLinkMode] = useState<"week" | "add" | null>(null);
  const [choice, setChoice] = useState({ name: "", icon: "custom" });
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
  const weekChoices = Object.values(data.entries)
    .filter((e) => days.includes(e.date))
    .filter((e) => !e.sleepId && !e.sleepBoundary)
    .filter(
      (e, i, all) =>
        all.findIndex((a) => a.name.toLowerCase() === e.name.toLowerCase()) ===
        i,
    );
  if (!area)
    return (
      <div className="value-list">
        {lifeAreas.map((a) => (
          <button className="entry-row" key={a} onClick={() => setArea(a)}>
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
      <div className="value-link-screen">
        <button className="back" onClick={() => { setLinkMode(null); setId(null); setReplacing(null); setChoice({ name: "", icon: "custom" }); }}>
          <ArrowLeft />
          Back to value
        </button>
        <h1 className="sr-only">
          {linkMode === "week" ? "Choose an activity from this week" : "Add an activity to this value"}
        </h1>
        {linkMode === "week" ? (
          weekChoices.length ? (
            <div className="week-activity-list">{weekChoices.map((a) => (
              <button className="activity-choice" key={a.id} onClick={() => link(a)}>
                <ActivityIcon id={a.icon} name={a.name} />
                {a.name}
                <Plus />
              </button>
            ))}</div>
          ) : (
            <p>No activities this week.</p>
          )
        ) : (
          <>
            <button className="secondary choose-week" onClick={() => setLinkMode("week")}>Choose activity from this week</button>
            <ActivityPicker
              value={choice}
              recent={data.recentActivities}
              suggestions={suggestedActivities(data)}
              onChange={setChoice}
            />
            <button className="primary" disabled={!choice.name} onClick={() => link(choice)}>
              {replacing ? "Save activity" : "Link activity"}
            </button>
          </>
        )}
      </div>
    );
  return (
    <>
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
                        {hasActivityIcon(a.icon, a.name) && <span className="activity-art"><ActivityIcon id={a.icon} name={a.name} /></span>}
                        <strong>{a.name}</strong>
                        <ItemActions name={a.name} deleteLabel={`Unlink ${a.name}`}
                          onDelete={() => update({ ...v, activities: v.activities.filter((activity) => activity.name !== a.name) })}
                          onEdit={() => { setId(v.id); setReplacing(a.name); setChoice(a); setLinkMode("add"); }} />
                      </div>
                    ))}
                    <button className="value-add-activity" aria-label={`Add activity to ${v.name}`}
                      onClick={() => { setId(v.id); setReplacing(null); setChoice({ name: "", icon: "custom" }); setLinkMode("add"); }}>
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
    </>
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
  if (adding) return <div className="schedule-values schedule-value-create">
    {!newArea ? <>
      <h2>Choose a life area</h2>
      <div className="schedule-value-grid schedule-area-grid">{lifeAreas.map((item) =>
        <button type="button" className="entry-row" key={item} onClick={() => setNewArea(item)}>
          <span className="value-heart"><AreaIcon area={item} /></span><strong>{areaLabel(item)}</strong><ChevronRight />
        </button>)}</div>
      <div className="value-create-actions"><button type="button" className="wizard-back" onClick={() => setAdding(false)}>Back</button></div>
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
        <button type="button" className="wizard-back" onClick={() => setNewArea(null)}>Back</button>
        <button className="wizard-next" disabled={!name.trim()}>Save value</button>
      </div>
    </form>}
  </div>;
  return <div className="schedule-values">
    <p>Choose a value for this activity.</p>
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
