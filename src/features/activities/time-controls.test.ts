import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DurationPicker } from "./DurationPicker";
import { parseSpokenHalfHour } from "../../shared/accessibility/speech";
import { searchActivities, suggestionActivities, mainActivities } from "../../domain/activities/catalogue";
import { ActivityIcon } from "./ActivityIcon";

test("duration keeps only the time range above its shorter/longer controls", () => {
  const html = renderToStaticMarkup(createElement(DurationPicker, { startMinute: 540, value: 90, onChange: () => {} }));
  assert.ok(html.indexOf("9:00 AM") < html.indexOf("30 minutes shorter"));
  assert.match(html, /10:30 AM/);
  assert.match(html, /1 hour 30 minutes/);
  assert.equal((html.match(/<button/g) ?? []).length, 2);
  const minimum = renderToStaticMarkup(createElement(DurationPicker, { startMinute: 1410, value: 30, onChange: () => {} }));
  assert.equal((minimum.match(/disabled=""/g) ?? []).length, 2);
});

test("separate time dictation rounds half hours and rejects invalid end times", () => {
  assert.equal(parseSpokenHalfHour("four forty PM"), 990);
  assert.equal(parseSpokenHalfHour("four PM", 990, 1440), undefined);
  assert.equal(parseSpokenHalfHour("five PM", 990, 1440), 1020);
  assert.equal(parseSpokenHalfHour("twelve AM"), 0);
  assert.equal(parseSpokenHalfHour("twelve AM", 990, 1440), 1440);
  assert.equal(parseSpokenHalfHour("eleven fifty PM"), undefined);
  assert.equal(parseSpokenHalfHour("four thirty"), undefined);
});

test("suggestion-only activities are searchable and each added choice has specific outline artwork", () => {
  for (const [query, name, icon] of [
    ["filling bird feeder", "Fill a bird feeder", "bird"],
    ["play dominoes", "Play dominoes", "dices"],
    ["make memory book", "Make a memory book", "notebook-pen"],
    ["senior center", "Visit a senior center", "users-round"],
    ["read grandchild", "Read with a grandchild", "book-open"],
  ]) {
    assert.ok(suggestionActivities.some((choice) => choice.name === name));
    assert.ok(!mainActivities.some((choice) => choice.name === name));
    const choice = searchActivities(query).find((choice) => choice.name === name);
    assert.ok(choice, query);
    assert.match(renderToStaticMarkup(createElement(ActivityIcon, { id: choice.icon, name })), new RegExp(`lucide-${icon}`));
  }
});
