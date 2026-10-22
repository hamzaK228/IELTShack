#!/usr/bin/env python3
"""Replace generic "Option A/B/C" text with the real option list from the source page.

Only changes an option set when the page contains a consecutive A–M list near the
question that includes the recorded answer letter. --dry reports coverage.
"""
import glob
import html as H
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "content" / "tests"
CACHE = ROOT / "scripts" / ".cache"
LET = "ABCDEFGHIJKLM"
OPT_LINE = re.compile(r"^([A-M])[.)]?\s+(.{1,180})$")


def cache_path(tid):
    m = re.match(r"pte-(gt-)?reading-(\d+)$", tid)
    if not m:
        return None
    return CACHE / ("gt-reading" if m.group(1) else "reading") / f"test-{m.group(2)}.html"


def text_with_pos(raw):
    out, pos = [], []
    i = 0
    while i < len(raw):
        if raw[i] == "<":
            j = raw.find(">", i)
            if j == -1:
                break
            out.append(" ")
            pos.append(i)
            i = j + 1
        else:
            out.append(raw[i])
            pos.append(i)
            i += 1
    text = H.unescape("".join(out)).replace("\u2026", "...")
    text = re.sub(r"\s+", " ", text)
    # position map no longer exact after collapsing; find prompts by text search instead
    return text


def option_sets(raw):
    found = []
    for m in re.finditer(r"<p\b[^>]*>(.*?)</p>", raw, re.S | re.I):
        inner = re.sub(r"<br\s*/?>", "\n", m.group(1), flags=re.I)
        inner = re.sub(r"<[^>]+>", " ", inner)
        lines = [re.sub(r"\s+", " ", l).strip() for l in H.unescape(inner).split("\n")]
        opts = {}
        for line in lines:
            mm = OPT_LINE.match(line)
            if not mm:
                continue
            letter, text = mm.group(1), mm.group(2).strip(" .;:-")
            if letter not in opts and len(text) >= 2:
                opts[letter] = text
        # keep only consecutive runs starting at A with at least three entries
        keys = sorted(opts)
        run = []
        for letter in LET:
            if letter in opts:
                run.append(letter)
            else:
                break
        if len(run) >= 3:
            found.append({"pos": m.start(), "opts": {k: opts[k] for k in run}})
    return found


def is_placeholder(options):
    return bool(options) and all(re.fullmatch(r"Option [A-J]", o.get("text", "")) for o in options)


def main():
    dry = "--dry" in sys.argv
    fixed = missed = 0
    tests_changed = 0
    samples = []
    for f in sorted(TESTS.glob("pte-*reading-*.json")):
        data = json.loads(f.read_text())
        targets = [q for s in data.get("sections", []) if s.get("skill") == "reading"
                   for q in s.get("questions", []) if is_placeholder(q.get("options"))]
        if not targets:
            continue
        path = cache_path(data["id"])
        if not path or not path.exists():
            missed += len(targets)
            continue
        raw = path.read_text(errors="ignore")
        text = text_with_pos(raw)
        sets = option_sets(raw)
        if not sets:
            missed += len(targets)
            continue
        changed = 0
        for q in targets:
            answer = q.get("answer")
            letters = answer if isinstance(answer, list) else [answer]
            letters = [str(x).strip().upper() for x in letters if str(x).strip()]
            probe = re.sub(r"[_—]+", "", q.get("prompt", ""))[:60].strip()
            probe = re.sub(r"\s+", " ", probe)
            at = text.find(probe) if probe else -1
            if at < 0:
                n = int(re.search(r"q(\d+)$", q["id"]).group(1))
                match = re.search(rf"(?<![\w.]){n}\s*[.)]\s", text)
                at = match.start() if match else -1
            if at < 0:
                missed += 1
                continue
            best = None
            for candidate in sets:
                if not all(l in candidate["opts"] for l in letters):
                    continue
                dist = abs(candidate["pos"] - at)
                if best is None or dist < best[0]:
                    best = (dist, candidate)
            if not best or best[0] > 25000:
                missed += 1
                continue
            opts = best[1]["opts"]
            q["options"] = [{"id": k, "text": v} for k, v in opts.items()]
            fixed += 1
            changed += 1
            if len(samples) < 10:
                samples.append((data["id"], q["id"], [f"{k}: {v[:40]}" for k, v in list(opts.items())[:4]]))
        if changed:
            tests_changed += 1
            if not dry:
                f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print({"fixed": fixed, "missed": missed, "tests": tests_changed, "dry": dry})
    for s in samples:
        print(" ", s)


if __name__ == "__main__":
    main()
