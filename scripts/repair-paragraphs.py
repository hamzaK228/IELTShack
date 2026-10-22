#!/usr/bin/env python3
"""Restore real paragraph breaks in reading passages from the cached source page.

The importer joined a passage's <p> blocks into one string. This script finds
the matching run of paragraph blocks and rewrites passage.text with "\n\n"
between them, but only when the concatenation matches the stored text closely.
"""
import glob
import html as H
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "content" / "tests"
CACHE = ROOT / "scripts" / ".cache"


def cache_path(tid):
    m = re.match(r"pte-(gt-)?reading-(\d+)$", tid)
    if not m:
        return None
    return CACHE / ("gt-reading" if m.group(1) else "reading") / f"test-{m.group(2)}.html"


def squash(text):
    return re.sub(r"\s+", "", text)


def paragraphs(raw):
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S | re.I)
    out = []
    for m in re.finditer(r"<(p|h[2-6])\b[^>]*>(.*?)</\1>", raw, re.S | re.I):
        t = H.unescape(re.sub(r"<[^>]+>", " ", m.group(2))).replace("\u2026", "...")
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            out.append(t)
    return out


def main():
    fixed = skipped = 0
    for f in sorted(TESTS.glob("pte-*reading-*.json")):
        data = json.loads(f.read_text())
        path = cache_path(data["id"])
        if not path or not path.exists():
            continue
        ps = paragraphs(path.read_text(errors="ignore"))
        sq = [squash(p) for p in ps]
        changed = False
        for section in data.get("sections", []):
            if section.get("skill") != "reading":
                continue
            text = (section.get("passage") or {}).get("text", "")
            if "\n\n" in text or len(text) < 600:
                continue
            target = squash(text)
            # Align the source paragraph starts against the stored text within a
            # small window; pages are sometimes lightly edited inside a paragraph.
            start = None
            for i, first in enumerate(sq):
                if len(first) > 60 and target.startswith(first[:80]):
                    start = i
                    break
            if start is None:
                skipped += 1
                continue
            pos = len(sq[start])
            blocks = [ps[start]]
            for j in range(start + 1, len(ps)):
                if re.match(r"^(questions?|choose|write|answer|list of)", ps[j], re.I):
                    break
                head = sq[j][:60]
                found = target.find(head, max(0, pos - 200), min(len(target), pos + 500))
                if found == -1:
                    continue
                pos = found + len(sq[j])
                blocks.append(ps[j])
                if pos >= len(target) - 10:
                    break
            if len(blocks) < 2 or pos < len(target) * 0.95:
                skipped += 1
                continue
            section["passage"]["text"] = "\n\n".join(blocks)
            fixed += 1
            changed = True
        if changed:
            f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("passages paragraph-repaired:", fixed, "skipped:", skipped)


if __name__ == "__main__":
    main()
