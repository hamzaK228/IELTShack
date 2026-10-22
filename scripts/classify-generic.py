#!/usr/bin/env python3
"""Classify placeholder reading questions by the source block they belong to.

For every question whose prompt is the generic "Refer to the passage or
diagram..." placeholder, find its question group in the cached source page and
report whether that group is a diagram (image available), a table, or inline
text. Read-only: prints a JSON/TSV summary, changes nothing.
"""
import glob
import html as H
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "content" / "tests"
CACHE = ROOT / "scripts" / ".cache"
PLACEHOLDER = "Refer to the passage or diagram"


def cache_path(tid: str):
    m = re.match(r"pte-(gt-)?reading-(\d+)$", tid)
    if not m:
        return None
    folder = "gt-reading" if m.group(1) else "reading"
    return CACHE / folder / f"test-{m.group(2)}.html"


def text_with_map(raw: str):
    """Strip tags but keep a raw index for every output character."""
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
    text = H.unescape("".join(out))
    # unescape can change length; rebuild a best-effort map by proportion
    if len(text) != len(pos):
        scale = len(pos) / max(len(text), 1)
        pos = [pos[min(int(k * scale), len(pos) - 1)] for k in range(len(text))]
    return text, pos


HEADER = re.compile(r"Questions?\s+(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2})", re.I)
SINGLE = re.compile(r"Question\s+(\d{1,2})(?!\s*[-\u2013])", re.I)


def groups(text):
    found = []
    for m in HEADER.finditer(text):
        found.append((m.start(), int(m.group(1)), int(m.group(2)), text[m.start():m.start() + 260]))
    for m in SINGLE.finditer(text):
        found.append((m.start(), int(m.group(1)), int(m.group(1)), text[m.start():m.start() + 260]))
    return sorted(found)


def main():
    counts = Counter()
    report = []
    for f in sorted(TESTS.glob("pte-*reading-*.json")):
        data = json.loads(f.read_text())
        generic = [
            q for s in data.get("sections", []) if s.get("skill") == "reading"
            for q in s.get("questions", [])
            if str(q.get("prompt", "")).startswith(PLACEHOLDER)
        ]
        if not generic:
            continue
        path = cache_path(data["id"])
        if not path or not path.exists():
            counts["no-cache"] += len(generic)
            continue
        raw = path.read_text(errors="ignore")
        raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S | re.I)
        text, pos = text_with_map(raw)
        gs = groups(text)
        images = [(m.start(), m.group(0)) for m in re.finditer(r'<img\b[^>]*(?:data-src|src)="([^"]+)"[^>]*>', raw, re.I)
                  if not m.group(1).startswith("data:")]
        tables = [m.start() for m in re.finditer(r"<table\b", raw, re.I)]
        for q in generic:
            n = int(re.search(r"q(\d+)$", q["id"]).group(1))
            group = None
            for start, a, b, snippet in gs:
                if a <= n <= b:
                    group = (start, a, b, snippet)
            if not group:
                prev = [g for g in gs if g[1] <= n]
                group = prev[-1] if prev else None
            kind = "unknown"
            if group:
                start, a, b, snippet = group
                raw_start = pos[min(start, len(pos) - 1)]
                nxt = [g for g in gs if g[0] > start]
                raw_end = pos[min(nxt[0][0], len(pos) - 1)] if nxt else len(raw)
                low = snippet[:200].lower()
                group_images = [src for s2, src in images if raw_start <= s2 < raw_end]
                group_tables = [t for t in tables if raw_start <= t < raw_end]
                if "diagram" in low or "map" in low or "label" in low:
                    kind = "diagram-image" if group_images else "diagram-no-image"
                elif group_tables:
                    kind = "table"
                else:
                    kind = "inline"
            counts[kind] += 1
            report.append({"test": data["id"], "q": q["id"], "n": n, "kind": kind,
                           "group": group[3][:120] if group else ""})
    print(json.dumps(dict(counts), indent=2))
    out = ROOT / "scripts" / ".cache" / "generic-classification.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print("wrote", out, len(report))


if __name__ == "__main__":
    main()
