import { useState } from "react";
import { X, Check, ArrowLeft, ChevronRight } from "lucide-react";
import {
  activities,
  filterActivities,
  activityCategories,
  categoryActivities,
} from "./activities";
import { ActivityIcon } from "./ActivityIcon";
import type { ActivityChoice } from "./model";

export function ActivityPicker({
  value,
  recent,
  onChange,
  suggestions = [],
}: {
  suggestions?: ActivityChoice[];
  value: ActivityChoice;
  recent: ActivityChoice[];
  onChange: (choice: ActivityChoice) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const choices =
    category === "Most recent"
      ? recent
      : category === "Suggestions"
        ? [
            { name: "Wake up", icon: "sleep" },
            ...suggestions.filter((choice) => choice.name.toLowerCase() !== "wake up"),
          ]
        : categoryActivities(category);
  const matches = query ? filterActivities(query) : choices;
  const recents = filterActivities(query, recent);
  const renderChoice = (choice: ActivityChoice) => (
    <button
      type="button"
      className={`activity-choice ${value.name === choice.name ? "selected" : ""}`}
      key={choice.name}
      aria-pressed={value.name === choice.name}
      onClick={() => onChange(choice)}
    >
      <ActivityIcon id={choice.icon} name={choice.name} />
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
        {!query && !category ? (
          <div className="activity-options">
            {recent.length > 0 && (
              <button
                type="button"
                className="activity-choice"
                onClick={() => setCategory("Most recent")}
              >
                Most recent <ChevronRight />
              </button>
            )}
            <button
              type="button"
              className="activity-choice"
              onClick={() => setCategory("Suggestions")}
            >
              Need suggestions? <ChevronRight />
            </button>
            {activityCategories.map((c) => (
              <button
                type="button"
                className="activity-choice"
                key={c.name}
                onClick={() => setCategory(c.name)}
              >
                <ActivityIcon id={c.icon} />
                <span>{c.name}</span>
                <ChevronRight />
              </button>
            ))}
          </div>
        ) : (
          <section>
            {!query && (
              <button
                type="button"
                className="back"
                onClick={() => setCategory("")}
              >
                <ArrowLeft />
                Categories
              </button>
            )}
            <h2>{query ? "Matching activities" : category}</h2>
            <div className="activity-options">{matches.map(renderChoice)}</div>
            {!matches.length && (
              <p>
                {category === "Suggestions" && !query
                  ? "Log an activity or link a value to get suggestions."
                  : "No activities found."}
              </p>
            )}
          </section>
        )}
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
