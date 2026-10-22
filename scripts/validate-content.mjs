#!/usr/bin/env node
/**
 * Validates every test JSON in content/tests.
 * Run: npm run validate:content
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "content", "tests");
const SKILLS = new Set(["listening", "reading", "writing", "speaking"]);
const TYPES = new Set(["mcq", "multi", "gap", "tfng", "matching", "short", "writing", "speaking"]);
const errors = [];
const seenTest = new Set();
const seenQuestion = new Set();

function fail(where, message) {
  errors.push(`${where}: ${message}`);
}

if (!existsSync(DIR)) {
  console.error("Missing content/tests directory");
  process.exit(1);
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
if (!files.length) {
  console.error("No test files found in content/tests");
  process.exit(1);
}

for (const file of files) {
  const where = `content/tests/${file}`;
  let test;
  try {
    test = JSON.parse(readFileSync(path.join(DIR, file), "utf8"));
  } catch (error) {
    fail(where, `invalid JSON — ${error.message}`);
    continue;
  }

  if (!test.id) fail(where, "missing id");
  else if (seenTest.has(test.id)) fail(where, `duplicate test id "${test.id}"`);
  else seenTest.add(test.id);

  if (!test.title) fail(where, "missing title");
  if (!["diagnostic", "practice", "mock"].includes(test.kind)) {
    fail(where, `kind must be diagnostic | practice | mock (got ${test.kind})`);
  }
  if (!Number.isFinite(test.durationMinutes)) fail(where, "durationMinutes must be a number");
  if (!Array.isArray(test.sections) || test.sections.length === 0) {
    fail(where, "sections must be a non-empty array");
    continue;
  }

  for (const [si, section] of test.sections.entries()) {
    const sWhere = `${where} › ${section.id ?? `section ${si}`}`;
    if (!section.id) fail(sWhere, "missing section id");
    if (!SKILLS.has(section.skill)) fail(sWhere, `invalid skill "${section.skill}"`);
    if (!section.title) fail(sWhere, "missing section title");
    if (!Array.isArray(section.questions) || !section.questions.length) {
      fail(sWhere, "section needs questions");
      continue;
    }
    if (section.audio && !/^(\/|https?:\/\/)/.test(section.audio)) {
      fail(sWhere, "audio must be a root-relative path under /assets/audio or an absolute URL");
    }

    for (const [qi, question] of section.questions.entries()) {
      const qWhere = `${sWhere} › ${question.id ?? `question ${qi}`}`;
      if (!question.id) fail(qWhere, "missing question id");
      else if (seenQuestion.has(question.id)) fail(qWhere, `duplicate question id "${question.id}"`);
      else seenQuestion.add(question.id);

      if (!TYPES.has(question.type)) fail(qWhere, `invalid type "${question.type}"`);
      if (question.skill !== section.skill) {
        fail(qWhere, `skill "${question.skill}" does not match section skill "${section.skill}"`);
      }
      if (!question.prompt) fail(qWhere, "missing prompt");

      const needsOptions = ["mcq", "tfng", "matching"].includes(question.type);
      if (needsOptions) {
        if (!Array.isArray(question.options) || question.options.length < 2) {
          fail(qWhere, `${question.type} needs at least two options`);
        } else {
          const ids = new Set(question.options.map((o) => o.id));
          if (ids.size !== question.options.length) fail(qWhere, "duplicate option ids");
          const expected = Array.isArray(question.answer) ? question.answer : [question.answer];
          for (const answer of expected) {
            if (!ids.has(String(answer))) fail(qWhere, `answer "${answer}" is not an option id`);
          }
          for (const option of question.options) {
            if (!option.id || !option.text) fail(qWhere, "every option needs id and text");
          }
        }
      }

      if (question.graded !== false) {
        const empty =
          question.answer == null ||
          (Array.isArray(question.answer) && question.answer.length === 0) ||
          (typeof question.answer === "string" && !question.answer.trim());
        if (empty) fail(qWhere, "graded question needs an answer");
      }

      if (["gap", "short"].includes(question.type) && Array.isArray(question.answer)) {
        fail(qWhere, "gap/short answers must be a single string");
      }
      if (question.type === "multi" && !Array.isArray(question.answer)) {
        fail(qWhere, "multi answers must be an array of option ids");
      }
      if (question.difficulty != null && ![1, 2, 3].includes(question.difficulty)) {
        fail(qWhere, "difficulty must be 1, 2 or 3");
      }
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem${errors.length === 1 ? "" : "s"} found:\n`);
  for (const error of errors) console.error("  • " + error);
  process.exit(1);
}

console.log(`✓ ${files.length} test file${files.length === 1 ? "" : "s"}, ${seenQuestion.size} questions — all valid.`);
