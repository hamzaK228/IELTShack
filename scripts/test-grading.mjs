#!/usr/bin/env node
/**
 * Small regression suite for the pure grading helpers. Run: npm test
 */
import assert from "node:assert/strict";
import { acceptableAnswers, diagnoseAnswer, isCorrect } from "../src/lib/answers.ts";
import { bandForSkill, overallBand } from "../src/lib/bands.ts";
import { inlineSegments } from "../src/lib/prompt.ts";

// Bands: no floor for a blank sheet, monotonic across set sizes.
assert.equal(bandForSkill("reading", 0, 9), 0);
assert.equal(bandForSkill("reading", 0, 10), 0);
assert.equal(bandForSkill("reading", 4, 4), 8);
assert.equal(bandForSkill("reading", 9, 9), 8);
assert.equal(bandForSkill("reading", 10, 10), 8.5);
assert.equal(bandForSkill("reading", 40, 40), 9);
assert.ok(bandForSkill("reading", 5, 9) >= bandForSkill("reading", 4, 9));
assert.ok(bandForSkill("reading", 5, 10) >= bandForSkill("reading", 4, 10));
assert.equal(overallBand([0, 4.5]), 2.5);

// Answer matching: exact keys, word-bank text, spelling/format diagnosis.
assert.equal(isCorrect({ type: "gap", answer: "10 or more" }, "10 or more"), true);
assert.equal(isCorrect({ type: "gap", answer: "pneumonia and/or bronchitis" }, "pneumonia and bronchitis"), true);
assert.equal(
  isCorrect(
    { type: "gap", answer: "B", options: [{ id: "B", text: "Split infinitives" }] },
    "Split infinitives"
  ),
  true
);
assert.equal(diagnoseAnswer({ type: "gap", answer: "environment" }, "enviroment"), "spelling");
assert.equal(diagnoseAnswer({ type: "gap", answer: "bank" }, "banks"), "format");

// The blank without a (12) marker is the one this question owns.
const parts = inlineSegments(
  "The (11) ______ is real, but the ______ matters more, and (13) ______ is next."
);
const target = parts.find((part) => part.kind === "blank" && part.target);
assert.ok(target && target.kind === "blank" && target.number === null);

console.log("✓ grading tests passed");
