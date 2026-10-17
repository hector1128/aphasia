import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BreathingGuide,
  VisualizationChoices,
  VisualizationGuide,
  visualizationThemes,
  RelaxationVideo,
} from "./Relaxation";
import { breathingMinutes } from "./speech";

test("visualization offers six distinct scenes with guidance", () => {
  const choices = renderToStaticMarkup(
    createElement(VisualizationChoices, { onChoose: () => {} }),
  );
  assert.equal(visualizationThemes.length, 6);
  for (const theme of visualizationThemes) {
    assert.ok(choices.includes(theme.title));
    const guide = renderToStaticMarkup(
      createElement(VisualizationGuide, { theme, onSession: () => {} }),
    );
    assert.ok(guide.includes(theme.description));
  }
});

test("breathing timer begins with the selected duration", () => {
  for (const minutes of [0.5, 1, 2.5, 3, 5]) {
    const markup = renderToStaticMarkup(
      createElement(BreathingGuide, { minutes, onSession: () => {} }),
    );
    assert.ok(markup.includes(`${minutes * 60} seconds left`));
  }
});

test("custom breathing minutes accept typed and dictated durations without confusing decimals", () => {
  for (const [text, minutes] of [["2.5", 2.5], ["2.5.", 2.5], ["2.05", 2.05], [".5", .5], ["seven minutes", 7], ["two and a half minutes", 2.5], ["15 min", 15]] as const)
    assert.equal(breathingMinutes(text), minutes, text);
  for (const text of ["", "0", "-2", "2..5", "later", "Infinity", "9999999999999999999999"])
    assert.equal(breathingMinutes(text), undefined, text);
});

test("stretching links to the selected replacement video with its own attribution", () => {
  const markup = renderToStaticMarkup(createElement(RelaxationVideo, { onSession: () => {} }));
  assert.match(markup, /48jIXvwXmeQ/);
  assert.match(markup, /Eleni Fit/);
  assert.doesNotMatch(markup, /Cambridge|GcPujVayIbI/);
});
