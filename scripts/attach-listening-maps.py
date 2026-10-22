#!/usr/bin/env python3
"""Attach map/diagram images to listening label questions."""
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


def main():
    dry = "--dry" in sys.argv
    changed = 0
    tests = 0
    for f in sorted(TESTS.glob("pte-listening-*.json")):
        data = json.loads(f.read_text())
        ph = [q for s in data.get("sections", []) for q in s.get("questions", [])
              if q.get("options") and all(str(o.get("text", "")).startswith("Option ") for o in q["options"])]
        if not ph:
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
            text = H.unescape(re.sub(r"<[^>]+>", " ", chunk)).lower()
            if not re.search(r"map|diagram|label", text):
                continue
            images = [u.strip() for u in IMG.findall(chunk) if "/wp-content/uploads/" in u]
            if not images:
                before = raw[max(0, start - 4000):start]
                images = [u.strip() for u in IMG.findall(before) if "/wp-content/uploads/" in u]
            if not images:
                continue
            url = images[-1]
            if url.startswith("/"):
                url = "https://practicepteonline.com" + url
            ext = re.sub(r"[?#].*$", "", url).split(".")[-1].lower()
            ext = ext if ext in {"png", "jpg", "jpeg", "webp", "gif"} else "png"
            dest = IMG_DIR / f"{data['id']}-map-{a}.{ext}"
            label = "diagram" if "diagram" in text else "map"
            for q in ph:
                n = int(re.search(r"q(\d+)$", q["id"]).group(1))
                if not (a <= n <= b):
                    continue
                if not dry:
                    if not dest.exists():
                        IMG_DIR.mkdir(parents=True, exist_ok=True)
                        req = urllib.request.Request(url, headers=UA)
                        dest.write_bytes(urllib.request.urlopen(req, timeout=45).read())
                    q["image"] = f"/assets/questions/{dest.name}"
                if q["prompt"].startswith("Listen to the recording"):
                    q["prompt"] = f"Label {n} on the {label}."
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
