import { useState } from "react";
import { SpeechField } from "./SpeechField";
import { X, ArrowLeft, ChevronRight } from "lucide-react";
import { filterActivities } from "./activities";
import { ActivityIcon } from "./ActivityIcon";
import { lifeAreas, type ActivityChoice, type LifeArea } from "./model";
import { mainActivities, searchableActivities, catalogueActivity } from "./activity-catalogue";
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
  const seen = new Set<string>();
  const uniqueChoices = (choices: ActivityChoice[]) => choices.filter((choice) => {
    const key = catalogueActivity(choice.name)?.name ?? choice.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const recentChoices = uniqueChoices(recent.slice(0, 5));
  const suggestionChoices = uniqueChoices(suggestions);
  const selectChoice = (choice: ActivityChoice) => {
    setQuery("");
    onChange({ name: choice.name, icon: choice.icon });
    document.getElementById("activity-search")?.focus();
  };
  const editQuery = (text: string) => {
    setQuery(text);
    onChange({ name: "", icon: "custom" });
  };
  const renderChoice = (choice: ActivityChoice) => (
    <button
      type="button"
      className="activity-choice"
      key={choice.name}
      onClick={() => selectChoice(choice)}
    >
      <ActivityIcon id={choice.icon} name={choice.name} />
      <span>{choice.name}</span>
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
          value={query || value.name}
          maxLength={100}
          onValueChange={editQuery}
        />
        {(query || value.name) && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => editQuery("")}
          >
            <X />
          </button>
        )}
      </div>
      {value.name ? <div className="activity-selection view-transition" key={value.name}>
        <div className="activity-choice" role="status" aria-label="Selected activity">
          <ActivityIcon id={value.icon} name={value.name} />
          <span>{value.name}</span>
        </div>
      </div> : <div
        className="activity-library"
        role="region"
        aria-label="Activity choices"
        key={category ?? "all"}
      >
        {!query.trim() && !category ? (
          <>
            {recentChoices.length > 0 && <section>
              <h2>Most recent</h2>
              <div className="activity-options">{recentChoices.map(renderChoice)}</div>
            </section>}
            {suggestionChoices.length > 0 && <section>
              <h2>Suggestions</h2>
              <div className="activity-options">{suggestionChoices.map(renderChoice)}</div>
            </section>}
            <section>
              <h2>Activities</h2>
              <div className="activity-options">
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
              onClick={() => selectChoice({ name: query.trim(), icon: "custom" })}
            >
              Use “{query.trim()}”
            </button>
          )}
      </div>}
    </>
  );
}
