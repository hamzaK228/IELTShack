#!/usr/bin/env python3
"""Recover listening MCQ stems and option lists from the cached source page.

Groups such as "Choose THREE answers ... Which THREE features ...? A ... B ..."
were imported with a generic prompt and "Option A/B/C" placeholders. This script
finds the group, extracts the question stem and the inline A–J list, and fills
both. --dry reports coverage and samples.
"""
import glob
import html as H
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "content" / "tests"
CACHE = ROOT / "scripts" / ".cache" / "listening"
HEADER = re.compile(r"Questions?\s+(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2})", re.I)
PLACEHOLDER = "Listen to the recording and answer question"
OPT = re.compile(r"(?<![\w(])([A-J])\s+([^A-J]{2,90}?)(?=\s+[A-J]\s+|\s+\(\s*\d+\s*\)|\s+Questions?\s|\s+Part\s|$)")


def cache_path(tid):
    m = re.match(r"pte-listening-(\d+)$", tid)
    return CACHE / f"test-{m.group(1)}.html" if m else None


def body(raw):
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S | re.I)
    text = H.unescape(re.sub(r"<[^>]+>", " ", raw)).replace("\u2026", "...")
    return re.sub(r"\s+", " ", text)


def groups(text):
    out = [(m.start(), int(m.group(1)), int(m.group(2))) for m in HEADER.finditer(text)]
    return out


def clean_option(text):
    text = re.split(r"\s+\(\s*\d+\s*\)|\s+\d{1,2}[.)]\s|\s+Questions?\s|\s+Part\s", text)[0]
    return text.strip(" .;:,•")


def stem_for(group_text, cut=None):
    text = HEADER.sub("", group_text, count=1).strip()
    if cut is not None:
        text = text[:cut]
    candidates = re.findall(r"(?:Which|What|Why|How|Who|When|Where|Choose|Identify)[^?]*\?", text)
    if candidates:
        return candidates[-1].strip()
    sentences = re.split(r"(?<=[.!?])\s+", text)
    for sentence in sentences:
        if re.match(r"(which|what|why|how|who|when|where)\b", sentence.strip(), re.I):
            return sentence.strip()
    return ""


def option_run(chunk):
    raw = []
    for m in OPT.finditer(chunk):
        value = clean_option(m.group(2))
        if len(value) < 3:
            continue
        if re.match(r"(for each answer|write|choose|complete|questions?|part)\b", value, re.I):
            continue
        raw.append((m.group(1), value, m.start()))
    best = []
    for i, (letter, _, _) in enumerate(raw):
        if letter != "A":
            continue
        run = []
        expected = ord("A")
        for later_letter, value, at in raw[i:]:
            if ord(later_letter) != expected:
                break
            run.append({"id": later_letter, "text": value})
            expected += 1
        if len(run) > len(best):
            best = run
    return best[:10]


def main():
    dry = "--dry" in sys.argv
    fixed_p = fixed_o = missed = 0
    samples = []
    for f in sorted(TESTS.glob("pte-listening-*.json")):
        data = json.loads(f.read_text())
        questions = [q for s in data.get("sections", []) for q in s.get("questions", [])]
        generic = [q for q in questions if str(q.get("prompt", "")).startswith(PLACEHOLDER)]
        placeholders = [q for q in questions
                        if q.get("options") and all(str(o.get("text", "")).startswith("Option ") for o in q["options"])]
        if not generic and not placeholders:
            continue
        path = cache_path(data["id"])
        if not path or not path.exists():
            missed += len(generic) + len(placeholders)
            continue
        text = body(path.read_text(errors="ignore"))
        gs = groups(text)
        changed = 0
        for i, (start, a, b) in enumerate(gs):
            stop = gs[i + 1][0] if i + 1 < len(gs) else text.find("Show Answers")
            if stop < 0:
                stop = min(len(text), start + 6000)
            chunk = text[start:stop]
            opts = option_run(chunk)
            first_opt = OPT.search(chunk)
            stem = stem_for(chunk, first_opt.start() if first_opt else None)
            in_group = [q for q in questions
                        if re.search(r"q(\d+)$", q["id"]) and a <= int(re.search(r"q(\d+)$", q["id"]).group(1)) <= b]
            if len(opts) < 3:
                continue
            for q in in_group:
                n = int(re.search(r"q(\d+)$", q["id"]).group(1))
                if q in generic and stem:
                    label = f" (answer {n - a + 1} of {len(in_group)})" if len(in_group) > 1 else ""
                    q["prompt"] = stem + label
                    fixed_p += 1
                if q in placeholders:
                    ans = q.get("answer")
                    letters = ans if isinstance(ans, list) else [ans]
                    if all(str(x).strip().upper() in {o["id"] for o in opts} for x in letters if str(x).strip()):
                        q["options"] = opts
                        fixed_o += 1
                changed += 1
                if len(samples) < 8 and (q in generic or q in placeholders):
                    samples.append((data["id"], q["id"], stem[:70], [o["text"][:30] for o in opts[:3]]))
        if changed and not dry:
            f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print({"generic_prompts": fixed_p, "option_sets": fixed_o, "missed": missed, "dry": dry})
    for s in samples:
        print(" ", s)


if __name__ == "__main__":
    main()
