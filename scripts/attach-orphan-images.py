#!/usr/bin/env python3
"""Attach a source-page image to placeholder questions that have no question block.

Some pages put an entire "Questions 6-12" block (instructions, word box, diagrams
and numbered blanks) inside one image. Those numbers have no header in the HTML,
so the importer left placeholders. When a page has exactly one content image,
that image is the missing block: attach it and label each question.
"""
import glob
import html as H
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "content" / "tests"
CACHE = ROOT / "scripts" / ".cache"
IMG_DIR = ROOT / "public" / "assets" / "questions"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36"}
EXT = {"png", "jpg", "jpeg", "webp", "gif"}


def cache_path(tid):
    m = re.match(r"pte-(gt-)?reading-(\d+)$", tid)
    if not m:
        return None
    return CACHE / ("gt-reading" if m.group(1) else "reading") / f"test-{m.group(2)}.html"


def main():
    changed = 0
    for f in sorted(TESTS.glob("pte-*reading-*.json")):
        data = json.loads(f.read_text())
        questions = [q for s in data.get("sections", []) if s.get("skill") == "reading"
                     for q in s.get("questions", [])]
        generic = [q for q in questions if str(q.get("prompt", "")).startswith("Refer to the passage or diagram")]
        if not generic:
            continue
        path = cache_path(data["id"])
        if not path or not path.exists():
            continue
        raw = path.read_text(errors="ignore")
        text = H.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S | re.I)))
        text = re.sub(r"\s+", " ", text)
        headers = [(int(a), int(b)) for a, b in re.findall(r"Questions?\s+(\d{1,2})\s*[-\u2013]\s*(\d{1,2})", text)]
        orphans = [q for q in generic
                   if not any(a <= int(re.search(r"q(\d+)$", q["id"]).group(1)) <= b for a, b in headers)]
        if not orphans:
            continue
        images = list(dict.fromkeys(
            u for u in re.findall(r'<img\b[^>]*(?:data-src|src)="([^"]+)"', raw, re.I)
            if "/wp-content/uploads/" in u))
        if len(images) != 1:
            continue
        url = images[0].strip()
        if url.startswith("/"):
            url = "https://practicepteonline.com" + url
        ext = re.sub(r"[?#].*$", "", url).split(".")[-1].lower()
        ext = ext if ext in EXT else "png"
        dest = IMG_DIR / f"{data['id']}-source-block.{ext}"
        try:
            IMG_DIR.mkdir(parents=True, exist_ok=True)
            req = urllib.request.Request(url, headers=UA)
            dest.write_bytes(urllib.request.urlopen(req, timeout=45).read())
        except Exception as exc:
            print(f"{data['id']}: download failed {exc}")
            continue
        image = f"/assets/questions/{dest.name}"
        for q in orphans:
            n = int(re.search(r"q(\d+)$", q["id"]).group(1))
            q["prompt"] = f"Use the table or diagram in the image to answer question {n}."
            q["image"] = image
            if q.get("type") == "matching" and all(
                    re.fullmatch(r"Option [A-J]", o.get("text", "")) for o in q.get("options") or []):
                q["type"] = "gap"
                q.pop("options", None)
            changed += 1
        f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        print(f"{data['id']}: attached to {len(orphans)} questions")
    print("changed", changed)


if __name__ == "__main__":
    main()
