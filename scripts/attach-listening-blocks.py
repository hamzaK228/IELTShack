#!/usr/bin/env python3
"""Attach listening table/timetable/diagram images and improve their prompts."""
import html as H
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "content" / "tests"
CACHE = ROOT / "scripts" / ".cache" / "listening"
IMG_DIR = ROOT / "public" / "assets" / "questions"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36"}
HDR = re.compile(r"Questions?\s*(?:<[^>]*>\s*)*(\d{1,2})\s*(?:<[^>]*>\s*)*[-\u2013\u2014]\s*(?:<[^>]*>\s*)*(\d{1,2})", re.I)
IMG = re.compile(r'<img\b[^>]*(?:data-src|src)="([^"]+)"', re.I)
NEED = re.compile(r"table|timetable|diagram|map|chart|flow|label|box", re.I)


def clean(text):
    text = H.unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text).strip()


def main():
    dry = "--dry" in sys.argv
    changed = 0
    tests = 0
    for f in sorted(TESTS.glob("pte-listening-*.json")):
        data = json.loads(f.read_text())
        qs = [q for s in data.get("sections", []) for q in s.get("questions", [])]
        generic = [q for q in qs if q["prompt"].startswith("Listen to the recording")]
        opts_ph = [q for q in qs if q.get("options") and all(str(o.get("text", "")).startswith("Option ") for o in q["options"])]
        if not generic and not opts_ph:
            continue
        m = re.match(r"pte-listening-(\d+)", data["id"])
        path = CACHE / f"test-{m.group(1)}.html"
        if not path.exists():
            continue
        raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", path.read_text(errors="ignore"), flags=re.S | re.I)
        headers = [(h.start(), int(h.group(1)), int(h.group(2))) for h in HDR.finditer(raw)]
        changed_here = 0
        for i, (start, a, b) in enumerate(headers):
            stop = headers[i + 1][0] if i + 1 < len(headers) else len(raw)
            chunk = raw[start:stop]
            instr = clean(chunk)[:260]
            if not NEED.search(instr):
                continue
            images = [u.strip() for u in IMG.findall(chunk) if "/wp-content/uploads/" in u]
            if not images:
                images = [u.strip() for u in IMG.findall(raw[max(0, start - 3000):start]) if "/wp-content/uploads/" in u]
            if not images:
                continue
            url = images[-1]
            if url.startswith("/"):
                url = "https://practicepteonline.com" + url
            ext = re.sub(r"[?#].*$", "", url).split(".")[-1].lower()
            ext = ext if ext in {"png", "jpg", "jpeg", "webp", "gif"} else "png"
            dest = IMG_DIR / f"{data['id']}-block-{a}-{i}.{ext}"
            label = re.sub(r"^Questions?\s+\d+\s*[-\u2013\u2014]\s*\d+\s*", "", instr)
            label = label.split(". ")[0][:110].strip(" .")
            for q in generic + opts_ph:
                n = int(re.search(r"q(\d+)$", q["id"]).group(1))
                if not (a <= n <= b):
                    continue
                if not dry:
                    if not dest.exists():
                        IMG_DIR.mkdir(parents=True, exist_ok=True)
                        req = urllib.request.Request(url, headers=UA)
                        dest.write_bytes(urllib.request.urlopen(req, timeout=45).read())
                    q["image"] = f"/assets/questions/{dest.name}"
                if q in generic:
                    q["prompt"] = f"{label}. Question {n}."
                changed_here += 1
                changed += 1
        if changed_here:
            tests += 1
            print(f"{data['id']}: {changed_here}")
            if not dry:
                f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print({"changed": changed, "tests": tests, "dry": dry})


if __name__ == "__main__":
    main()
