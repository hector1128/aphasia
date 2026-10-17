import { useState } from "react";
import { SpeechField } from "./SpeechField";
import { X, CalendarDays, ArrowLeft, ChevronRight } from "lucide-react";
import { filterActivities } from "./activities";
import { ActivityIcon } from "./ActivityIcon";
import { lifeAreas, type ActivityChoice, type LifeArea } from "./model";
import { mainActivities, searchableActivities } from "./activity-catalogue";
import { AreaIcon, areaLabel } from "./LifeAreaIcon";

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
  const [category, setCategory] = useState<LifeArea | null>(null);
  const choices = mainActivities.filter((activity) => category && activity.areas.includes(category));
  const matches = query.trim() ? filterActivities(query, searchableActivities) : choices;
  const renderChoice = (choice: ActivityChoice) => (
    <button
      type="button"
      className={`activity-choice ${value.name === choice.name ? "selected" : ""}`}
      key={choice.name}
      aria-pressed={value.name === choice.name}
      onClick={() => onChange({ name: choice.name, icon: choice.icon })}
    >
      <ActivityIcon id={choice.icon} name={choice.name} />
      <span>{choice.name}</span>
      {value.name === choice.name && <CalendarDays size={24} />}
    </button>
  );
  return (
    <>
      <div className="activity-search">
        <label className="sr-only" htmlFor="activity-search">
          Search activities
        </label>
        <SpeechField
          id="activity-search"
          placeholder="Search activities"
          value={query}
          maxLength={100}
          onValueChange={setQuery}
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
          <CalendarDays size={24} />
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
        {!query.trim() && !category ? (
          <>
            <section>
              <h2>Most recent</h2>
              {recent.length ? <div className="activity-options">{recent.slice(0, 5).map(renderChoice)}</div> : <p>No recent activities yet.</p>}
            </section>
            <section>
              <h2>Suggestions</h2>
              {suggestions.length ? <div className="activity-options">{suggestions.map(renderChoice)}</div> : <p>You have tried all the suggested activities. Choose a life area or search for something else.</p>}
            </section>
            <section>
              <h2>Choose a life area</h2>
              <div className="activity-options life-area-options">
                {lifeAreas.map((area) => (
                  <button type="button" className="activity-choice" key={area} onClick={() => setCategory(area)}>
                    <span className="area-icon"><AreaIcon area={area} /></span>
                    <span>{areaLabel(area)}</span><ChevronRight />
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section>
            {!query.trim() && <button type="button" className="back" onClick={() => setCategory(null)}><ArrowLeft />Life areas</button>}
            <h2>{query.trim() ? "Matching activities" : category && areaLabel(category)}</h2>
            <div className="activity-options">{matches.map(renderChoice)}</div>
            {!matches.length && <p>No activities found.</p>}
          </section>
        )}
        {query.trim() &&
          !searchableActivities.some(
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
