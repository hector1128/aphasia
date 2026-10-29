import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RatingSlider, ScaleInfo } from "./RatingSlider";
import { emptyData, readData } from "./model";

test("each scale describes its own 0, 5 and 10 anchors and exposes keyboard-accessible help", () => {
  for (const kind of ["Mood", "Enjoyment", "Importance"] as const) {
    const slider = renderToStaticMarkup(createElement(RatingSlider, { label: kind, value: 5, onChange: () => {} }));
    const help = renderToStaticMarkup(createElement(ScaleInfo, { kind }));
    for (const value of [0, 5, 10]) assert.ok(slider.includes(`${value}: </span>`));
    assert.match(slider, /aria-describedby=/);
    assert.ok(help.includes(`About the ${kind.toLowerCase()} scale`));
    assert.match(help, /popover="auto"/);
    assert.match(help, /popoverTargetAction="hide"/i);
    const expected = kind === "Mood" ? "Neutral" : kind === "Enjoyment" ? "Somewhat" : "Somewhat important";
    assert.ok(slider.includes(expected));
  }
});

test("automatic report preference is off for old accounts and persists without opting in malformed values", () => {
  assert.equal(emptyData().autoEmailReports, false);
  const { autoEmailReports: _preference, ...legacy } = emptyData();
  assert.equal(readData(JSON.stringify(legacy)).autoEmailReports, false);
  assert.equal(readData(JSON.stringify({ ...legacy, autoEmailReports: "true" })).autoEmailReports, false);
  assert.equal(readData(JSON.stringify({ ...legacy, autoEmailReports: true })).autoEmailReports, true);
  assert.equal(readData(JSON.stringify({ ...legacy, autoEmailReports: false })).autoEmailReports, false);
});
