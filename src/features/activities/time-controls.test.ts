import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DurationPicker } from "./DurationPicker";
import { parseSpokenHalfHour } from "../../shared/accessibility/speech";
import { searchActivities, suggestionActivities, mainActivities } from "../../domain/activities/catalogue";
import { ActivityIcon } from "./ActivityIcon";

test("logged end times use the scheduling list in half-hour blocks and stop at midnight", () => {
  const render = (startMinute: number, value?: number) => renderToStaticMarkup(createElement(DurationPicker, { startMinute, value, onChange: () => {} }));
  const html = render(990, 60);
  assert.match(html, /4:30 PM – 5:30 PM/);
  assert.match(html, /role="listbox"/);
  assert.match(html, /aria-selected="true" tabindex="0">5:30 PM/);
  assert.match(html, /role="option"[^>]*>5:00 PM/);
  assert.match(html, /role="option"[^>]*>12:00 AM \(midnight\)/);
  assert.doesNotMatch(html, /role="option"[^>]*>(4:30 PM|4:45 PM|5:15 PM|12:30 AM)/);
  assert.equal((render(1410, 30).match(/role="option"/g) ?? []).length, 1);
  assert.match(render(1425), /11:45 PM – 12:00 AM/);
  assert.doesNotMatch(render(1425), /role="option"/);
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
