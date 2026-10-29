import assert from "node:assert/strict";
import { test } from "node:test";
import { searchActivities } from "./activity-catalogue";

test("activity search understands phrases, aliases, partial words and word order", () => {
  for (const [query, expected] of [
    ["eating breakfast", "Breakfast"], ["breakfast eating", "Breakfast"],
    ["I'm eating breakfas", "Breakfast"], ["I had lunch", "Lunch"],
    ["riding a bike", "Biking"], ["jogging", "Running"],
    ["speech practice", "Speech practice"], ["Dr Blackett", "See Dr. Blackett"],
    ["aphasia house", "Aphasia House"], ["walk dog", "Pet care"],
  ]) {
    const matches = searchActivities(query);
    assert.equal(matches[0]?.name, expected, query);
    assert.equal(new Set(matches.map((choice) => choice.name)).size, matches.length);
  }
  assert.deepEqual(searchActivities("zzznotfound"), []);
  assert.ok(searchActivities("playing piano").some((choice) => choice.name === "Playing piano"));
  assert.ok(searchActivities("iano").some((choice) => choice.name === "Playing piano"));
  assert.ok(!searchActivities("speech practice").some((choice) => choice.name === "Speech therapy"));
});
