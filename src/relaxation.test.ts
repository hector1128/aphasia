import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BreathingGuide,
  VisualizationChoices,
  VisualizationGuide,
  visualizationThemes,
} from "./Relaxation";

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
  for (const minutes of [1, 3, 5]) {
    const markup = renderToStaticMarkup(
      createElement(BreathingGuide, { minutes, onSession: () => {} }),
    );
    assert.ok(markup.includes(`${minutes * 60} seconds left`));
  }
});
