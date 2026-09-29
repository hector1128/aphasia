import { useState } from "react";
import { X, Check } from "lucide-react";
import { activities, filterActivities } from "./activities";
import { ActivityIcon } from "./ActivityIcon";
import type { ActivityChoice } from "./model";

export function ActivityPicker({
  value,
  recent,
  onChange,
}: {
  value: ActivityChoice;
  recent: ActivityChoice[];
  onChange: (choice: ActivityChoice) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = filterActivities(query);
  const recents = filterActivities(query, recent);
  const renderChoice = (choice: ActivityChoice) => (
    <button
      type="button"
      className={`activity-choice ${value.name === choice.name ? "selected" : ""}`}
      key={choice.name}
      aria-pressed={value.name === choice.name}
      onClick={() => onChange(choice)}
    >
      <ActivityIcon id={choice.icon} />
      <span>{choice.name}</span>
      {value.name === choice.name && <Check size={24} />}
    </button>
  );
  return (
    <>
      <div className="activity-search">
        <label className="sr-only" htmlFor="activity-search">
          Search activities
        </label>
        <input
          id="activity-search"
          placeholder="Search activities"
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
          >
            <X />
          </button>
        )}
      </div>
      {value.name && (
        <div className="selected-activity" role="status">
          <Check size={24} />
          <span>{value.name}</span>
        </div>
      )}
      <div
        className="activity-library"
        tabIndex={0}
        role="region"
        aria-label="Activity choices"
        key={query}
      >
        {recents.length > 0 && (
          <section>
            <h2>Most recent</h2>
            <div className="activity-options">{recents.map(renderChoice)}</div>
          </section>
        )}
        <section>
          <h2>{query ? "Matching activities" : "Activities"}</h2>
          <div className="activity-options">
            {matches
              .filter((a) => !recents.some((r) => r.name === a.name))
              .map(renderChoice)}
          </div>
        </section>
        {query.trim() &&
          !activities.some(
            (a) => a.name.toLowerCase() === query.trim().toLowerCase(),
          ) && (
            <button
              type="button"
              className="secondary custom-activity"
              onClick={() => onChange({ name: query.trim(), icon: "custom" })}
            >
              Use “{query.trim()}”
            </button>
          )}
      </div>
    </>
  );
}
