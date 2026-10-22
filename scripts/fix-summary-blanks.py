#!/usr/bin/env python3
"""Fill placeholder summary/notes questions from the paragraph that holds them.

Finds the source block containing several numbered blanks, replaces each marker
with a token, splits on sentence boundaries, and gives every placeholder the
sentence that contains its own blank (other blanks are labelled). --dry prints
samples without writing.
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
PLACEHOLDER = "Refer to the passage or diagram"
MARK = re.compile(r"[.…_]{2,}\s*\(?\s*(\d{1,2})\s*\)?\s*[.…_]{2,}|\(\s*(\d{1,2})\s*\)\s*[.…_]{2,}")


def cache_path(tid):
    m = re.match(r"pte-(gt-)?reading-(\d+)$", tid)
    if not m:
        return None
    return CACHE / ("gt-reading" if m.group(1) else "reading") / f"test-{m.group(2)}.html"


def blocks(raw):
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S | re.I)
    out = []
    for m in re.finditer(r"<(p|li|td|h[1-6]|blockquote)\b[^>]*>(.*?)</\1>", raw, re.S | re.I):
        t = H.unescape(re.sub(r"<[^>]+>", " ", m.group(2))).replace("\u2026", "...")
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            out.append(t)
    return out


def sentence_for(block, n):
    def tok(m):
        k = m.group(1) or m.group(2)
        return f"[[B:{k}]]"
    text = MARK.sub(tok, block)
    sents = re.split(r"(?<=[.!?])\s+|(?<=\]\])\s+(?=[A-Z])", text)
    hit = [s for s in sents if f"[[B:{n}]]" in s]
    if not hit:
        return None
    s = hit[0]
    s = re.sub(r"\[\[B:(\d+)\]\]", lambda m: "______" if m.group(1) == str(n) else f"______ ({m.group(1)})", s)
    s = re.sub(r"\s+", " ", s).strip(" ,;:")
    if not (20 <= len(s) <= 600):
        return None
    if len(re.findall(r"[A-Za-z]{3,}", s)) < 5:
        return None
    return s


def main():
    dry = "--dry" in sys.argv
    fixed = missed = 0
    samples = []
    for f in sorted(TESTS.glob("pte-*reading-*.json")):
        data = json.loads(f.read_text())
        generic = [q for s in data.get("sections", []) if s.get("skill") == "reading"
                   for q in s.get("questions", []) if str(q.get("prompt", "")).startswith(PLACEHOLDER)]
        if not generic:
            continue
        path = cache_path(data["id"])
        if not path or not path.exists():
            missed += len(generic)
            continue
        bs = blocks(path.read_text(errors="ignore"))
        changed = 0
        for q in generic:
            n = int(re.search(r"q(\d+)$", q["id"]).group(1))
            best = None
            for b in bs:
                found = {int(a or c) for a, c in MARK.findall(b)}
                if n in found and len(found) >= 2:
                    prompt = sentence_for(b, n)
                    if prompt and (best is None or len(prompt) < len(best)):
                        best = prompt
            if not best:
                missed += 1
                continue
            fixed += 1
            changed += 1
            if len(samples) < 12:
                samples.append((data["id"], n, best[:130]))
            if not dry:
                q["prompt"] = best
        if changed and not dry:
            f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print({"fixed": fixed, "missed": missed, "dry": dry})
    for s in samples:
        print(" ", s)


if __name__ == "__main__":
    main()
