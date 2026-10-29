import { useState } from "react";
import { SpeechField } from "./SpeechField";
import { X, ArrowLeft, ChevronRight } from "lucide-react";
import { ActivityIcon } from "./ActivityIcon";
import type { ActivityChoice } from "./model";
import { activityCategories, searchableActivities, catalogueActivity, searchActivities } from "./activity-catalogue";

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
  const [category, setCategory] = useState<(typeof activityCategories)[number] | null>(null);
  const choices = category?.activities ?? [];
  const matches = query.trim() ? searchActivities(query) : choices;
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
      <span className="area-icon"><ActivityIcon id={choice.icon} name={choice.name} /></span>
      <span>{choice.name}</span>
    </button>
  );
  return (
    <>
      <div className="activity-search">
        <label className="sr-only" htmlFor="activity-search">
          Enter the activity
        </label>
        <SpeechField
          id="activity-search"
          placeholder="Enter the activity"
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
          <span className="area-icon"><ActivityIcon id={value.icon} name={value.name} /></span>
          <span>{value.name}</span>
        </div>
      </div> : <div
        className="activity-library"
        role="region"
        aria-label="Activity choices"
        key={category?.name ?? "all"}
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
                {activityCategories.map((group) => (
                  <button type="button" className="activity-choice" key={group.name} onClick={() => setCategory(group)}>
                    <span className="area-icon"><ActivityIcon id={group.icon} /></span>
                    <span>{group.name}</span><ChevronRight />
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section>
            {!query.trim() && <button type="button" className="back" onClick={() => setCategory(null)}><ArrowLeft />All activities</button>}
            <h2>{query.trim() ? "Matching activities" : category?.name}</h2>
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
