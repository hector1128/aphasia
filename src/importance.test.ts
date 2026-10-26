import assert from "node:assert/strict";
import { test } from "node:test";
import { cachedImportance, rememberImportance } from "./importance";
import { emptyData, readData, saveActivity } from "./model";

test("importance survives storage and expires exactly 14 days after the rating", () => {
  const ratedAt = new Date("2026-10-21T15:32:00Z");
  const data = readData(JSON.stringify(rememberImportance(emptyData(), "Read", 0, ratedAt)));
  assert.equal(cachedImportance(data, "Reading", ratedAt), 0);
  assert.equal(cachedImportance(data, "  READ  ", new Date("2026-11-04T15:31:59.999Z")), 0);
  assert.equal(cachedImportance(data, "Read", new Date("2026-11-04T15:32:00Z")), undefined);
  assert.equal(cachedImportance(data, "Read", new Date("2026-10-21T15:31:59Z")), undefined);
  assert.equal(cachedImportance(data, "Cook", ratedAt), undefined);
  assert.equal(cachedImportance(emptyData(), "Read", ratedAt), undefined);
});

test("reusing importance does not extend its lifetime; explicitly rating again does", () => {
  const ratedAt = new Date("2026-10-21T15:32:00Z");
  let data = rememberImportance(emptyData(), "My activity", 8, ratedAt);
  data = saveActivity(data, { id: "a", name: "My activity", icon: "custom", source: "logged",
    status: "done", date: "2026-10-30", startMinute: 600, mood: 5, rating: 7, importance: 8 });
  const expiry = new Date("2026-11-04T15:32:00Z");
  assert.equal(cachedImportance(data, "my activity", expiry), undefined);
  data = rememberImportance(data, "MY ACTIVITY", 4, expiry);
  assert.equal(cachedImportance(data, "My activity", expiry), 4);
});

test("renamed activities reuse existing cache entries while distinct new choices stay separate", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const data = emptyData();
  data.importanceRatings = {
    read: { rating: 8, ratedAt: now.toISOString() },
    "call | on the phone": { rating: 6, ratedAt: now.toISOString() },
    "eat a meal": { rating: 7, ratedAt: now.toISOString() },
  };
  assert.equal(cachedImportance(data, "Reading", now), 8);
  assert.equal(cachedImportance(data, "Phone call", now), 6);
  assert.equal(cachedImportance(data, "Breakfast", now), undefined);
  const updated = rememberImportance(data, "Breakfast", 4, now);
  assert.equal(cachedImportance(updated, "Breakfast", now), 4);
  assert.equal(cachedImportance(updated, "Lunch", now), undefined);
  assert.equal(cachedImportance(updated, "Dinner", now), undefined);
  assert.equal(cachedImportance(updated, "Reading", new Date("2026-11-08T12:00:00Z")), undefined);
});

test("old accounts get an empty cache and malformed cached ratings are discarded", () => {
  const original = emptyData();
  const { importanceRatings: _cache, ...legacy } = original;
  assert.deepEqual(readData(JSON.stringify(legacy)), original);
  const data = readData(JSON.stringify({ ...original, importanceRatings: {
    valid: { rating: 10, ratedAt: "2026-10-21T15:32:00Z" },
    wrongRating: { rating: 11, ratedAt: "2026-10-21T15:32:00Z" },
    wrongDate: { rating: 4, ratedAt: "invalid" },
    missing: { rating: 4 },
    text: "invalid",
  } }));
  assert.deepEqual(Object.keys(data.importanceRatings), ["valid"]);
});
