import { useState } from "react";
import { ArrowLeft, ChevronRight, Plus, Heart, Pencil, Trash2 } from "lucide-react";
import {
  Data,
  LifeArea,
  LifeValue,
  lifeAreas,
  dateKey,
  suggestedActivities,
} from "./model";
import { weekDates } from "./date-time";
import { ActivityPicker } from "./ActivityPicker";
import { ActivityIcon } from "./ActivityIcon";
export function Values({
  data,
  onChange,
}: {
  data: Data;
  onChange: (data: Data) => void;
}) {
  const [area, setArea] = useState<LifeArea | null>(null);
  const [id, setId] = useState<string | null>(null);
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
            (c) => c.name.toLowerCase() !== a.name.toLowerCase(),
          ),
          a,
        ],
      });
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
            <span className="value-heart"><Heart size={30} /></span>
            <strong>{a.replaceAll("/", "/ ")}</strong>
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
          if (selected) {
            update({ ...selected, name: name.trim() });
            setId(null);
          }
          else
            onChange({
              ...data,
              values: [
                ...data.values,
                {
                  id: crypto.randomUUID(),
                  area,
                  name: name.trim(),
                  activities: [],
                },
              ],
            });
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
        <input
          id="value-name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button className="primary" disabled={!name.trim()}>
          Save value
        </button>
      </form>
    );
  if (selected)
    return (
      <>
        <button
          className="back"
          onClick={() => {
            setId(null);
            setLinkMode(null);
          }}
        >
          <ArrowLeft />
          {area}
        </button>
        <h2>{selected.name}</h2>
        {linkMode ? (
          <>
            <button className="back" onClick={() => setLinkMode(null)}>
              <ArrowLeft />
              Back to value
            </button>
            {linkMode === "week" ? (
              <>
                <h2>This week</h2>
                {weekChoices.length ? (
                  <div className="week-activity-list">{weekChoices.map((a) => (
                    <button
                      className="activity-choice"
                      key={a.id}
                      onClick={() => link(a)}
                    >
                      <ActivityIcon id={a.icon} name={a.name} />
                      {a.name}
                      <Plus />
                    </button>
                  ))}</div>
                ) : (
                  <p>No activities this week.</p>
                )}
              </>
            ) : (
              <>
                <ActivityPicker
                  value={choice}
                  recent={data.recentActivities}
                  suggestions={suggestedActivities(data)}
                  onChange={setChoice}
                />
                <button
                  className="primary"
                  disabled={!choice.name}
                  onClick={() => link(choice)}
                >
                  Link activity
                </button>
              </>
            )}
          </>
        ) : (
          <>
            {selected.activities.map((a) => (
              <div className="linked-row" key={a.name}>
                <ActivityIcon id={a.icon} name={a.name} />
                <span>{a.name}</span>
                <button
                  className="icon-button"
                  aria-label={`Unlink ${a.name}`}
                  onClick={() =>
                    update({
                      ...selected,
                      activities: selected.activities.filter(
                        (c) => c.name !== a.name,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
            <div className="value-link-actions">
              <button className="primary" onClick={() => setLinkMode("week")}>
                Choose from this week
              </button>
              <button className="secondary" onClick={() => setLinkMode("add")}>
                <Plus />
                Add activity
              </button>
            </div>
          </>
        )}
      </>
    );
  return (
    <>
      <button className="back" onClick={() => setArea(null)}>
        <ArrowLeft />
        Life areas
      </button>
      <h2>{area}</h2>
      <div className="value-list">
        {data.values
          .filter((v) => v.area === area)
          .map((v) => (
            <div key={v.id} className="entry-row value-entry-row">
              <button className="value-row-main" onClick={() => setId(v.id)}>
                <span className="value-heart"><Heart size={30} /></span>
                <strong>{v.name}</strong>
              </button>
              <button
                className="value-row-action is-delete"
                aria-label={`Delete ${v.name}`}
                onClick={() => {
                  onChange({
                    ...data,
                    values: data.values.filter((item) => item.id !== v.id),
                  });
                }}
              >
                <Trash2 size={25} />
              </button>
              <button
                className="value-row-action"
                aria-label={`Edit ${v.name}`}
                onClick={() => {
                  setId(v.id);
                  setName(v.name);
                  setEditing(true);
                }}
              >
                <Pencil size={25} />
              </button>
              <button
                className="value-row-next"
                aria-label={`Open ${v.name}`}
                onClick={() => setId(v.id)}
              >
                <ChevronRight size={26} />
              </button>
            </div>
          ))}
      </div>
      <button
        className="primary"
        onClick={() => {
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
