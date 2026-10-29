import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ActivityIcon } from "./ActivityIcon";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RatingSlider, ScaleInfo } from "./RatingSlider";
import { emptyData, readData } from "./model";

test("each scale describes its own 0, 5 and 10 anchors and exposes keyboard-accessible help", () => {
  for (const kind of ["Mood", "Enjoyment", "Importance"] as const) {
    const slider = renderToStaticMarkup(createElement(RatingSlider, { label: kind, value: 5, onChange: () => {} }));
    const help = renderToStaticMarkup(createElement(ScaleInfo, { kind }));
    for (let value = 0; value <= 10; value++) {
      assert.ok(slider.includes(`/ratings/${kind.toLowerCase()}/${value}.png`));
    }
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

test("new accounts get the tutorial, existing accounts are not interrupted, and dismissal survives reload", () => {
  assert.equal(emptyData().tutorialSeen, false);
  const { tutorialSeen: _seen, ...legacy } = emptyData();
  assert.equal(readData(JSON.stringify(legacy)).tutorialSeen, true);
  for (const tutorialSeen of [false, true]) {
    assert.equal(readData(JSON.stringify({ ...legacy, tutorialSeen })).tutorialSeen, tutorialSeen);
  }
});

test("rating artwork exists as individual images and six uses the portrait replacement crop", () => {
  for (const kind of ["mood", "enjoyment", "importance"]) {
    for (let score = 0; score <= 10; score++) {
      const image = readFileSync(new URL(`../public/ratings/${kind}/${score}.png`, import.meta.url));
      assert.equal(image.subarray(1, 4).toString(), "PNG");
      assert.ok(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
      if (kind === "importance" && score === 6) {
        assert.equal(image.readUInt32BE(20), 280);
        assert.ok(Math.abs(image.readUInt32BE(16) / 280 - 814 / 1116) < 0.01);
      }
    }
  }
});

test("mindfulness choices have distinct, matching outline icons", () => {
  for (const [id, icon] of [["breathing", "wind"], ["visualization", "image"], ["stretching", "stretching"]]) {
    const html = renderToStaticMarkup(createElement(ActivityIcon, { id, size: 48 }));
    assert.ok(html.includes(`lucide-${icon}`));
    assert.match(html, /stroke-width="1.7"/);
    assert.doesNotMatch(html, /lucide-brain|lucide-heart-pulse/);
  }
});
