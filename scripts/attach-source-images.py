#!/usr/bin/env python3
"""Attach the source page's diagram/table screenshots to reading questions.

Many practicepteonline pages embed the numbered diagram or table as one image
instead of text, which is why the importer produced "Refer to the passage or
diagram..." placeholders. This script finds those images in the cached page,
downloads them, and gives every question in the matching group an image plus a
prompt that says which number to answer.

Run with --dry to print the planned changes. Without it, rewrites test JSON.
"""
import html as H
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "content" / "tests"
CACHE = ROOT / "scripts" / ".cache"
IMG_DIR = ROOT / "public" / "assets" / "questions"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36"}
PLACEHOLDER = "Refer to the passage or diagram"
GROUP_WORDS = re.compile(r"\b(diagrams?|tables?|charts?|figures?|pictures?|maps?|label(?:led|s)?)\b", re.I)
DIAGRAM_TASK = re.compile(
    r"^(?:label|complete\s+(?:the\s+)?(?:diagrams?|tables?|charts?|notes)|"
    r"complete\s+the\s+table|the\s+diagram\s+below|match\s+the\s+pictures|"
    r"filling\s+the\s+blanks\s+in\s+diagram|look\s+at.*(?:map|diagram)|match\s+each\s+diagram)", re.I)
EXT = {"png", "jpg", "jpeg", "webp", "gif"}


def cache_path(tid):
    m = re.match(r"pte-(gt-)?reading-(\d+)$", tid)
    if not m:
        return None
    folder = "gt-reading" if m.group(1) else "reading"
    return CACHE / folder / f"test-{m.group(2)}.html"


def text_with_map(raw):
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
    # Do not unescape here: keeping the raw text makes (text index -> raw index)
    # exact even when entities are present. Display text is unescaped later.
    return "".join(out), pos


HEADER = re.compile(r"Questions?\s+(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2})", re.I)
SINGLE = re.compile(r"Question\s+(\d{1,2})(?!\s*[-\u2013])", re.I)


def groups(text):
    found = []
    for m in HEADER.finditer(text):
        found.append((m.start(), int(m.group(1)), int(m.group(2)), text[m.start():m.start() + 300]))
    for m in SINGLE.finditer(text):
        found.append((m.start(), int(m.group(1)), int(m.group(1)), text[m.start():m.start() + 300]))
    return sorted(found)


def clean(text):
    text = re.sub(r"<[^>]+>", " ", text)
    text = H.unescape(text).replace("\u2026", "...")
    return re.sub(r"\s+", " ", text).strip()


def instruction_for(snippet):
    """First sentence(s) of the group header, without the trailing question text."""
    body = H.unescape(re.sub(r"^Questions?\s+\d+(?:\s*[-\u2013\u2014]\s*\d+)?", "", snippet)).strip()
    body = re.split(r"\s+(?:Choose|Write|In boxes|Answer|Look)\b", body)[0]
    return body.strip(" .")


def pick_images(raw, start, end):
    found = []
    for m in re.finditer(r'<img\b[^>]*(?:data-src|src)="([^"]+)"', raw, re.I):
        url = m.group(1)
        if url.startswith("data:") or "/wp-content/uploads/" not in url:
            continue
        if start <= m.start() < end:
            found.append((m.start(), url))
    return found


def download(url, dest):
    url = url.strip()
    if url.startswith("//"):
        url = "https:" + url
    elif url.startswith("/"):
        url = "https://practicepteonline.com" + url
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers=UA)
    dest.write_bytes(urllib.request.urlopen(req, timeout=45).read())


def main():
    dry = "--dry" in sys.argv
    changed_tests = changed_qs = 0
    for f in sorted(TESTS.glob("pte-*reading-*.json")):
        data = json.loads(f.read_text())
        questions = [q for s in data.get("sections", []) if s.get("skill") == "reading"
                     for q in s.get("questions", [])]
        if not any(str(q.get("prompt", "")).startswith(PLACEHOLDER) for q in questions):
            continue
        path = cache_path(data["id"])
        if not path or not path.exists():
            continue
        raw = path.read_text(errors="ignore")
        raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S | re.I)
        text, pos = text_with_map(raw)
        gs = groups(text)
        if not gs:
            continue
        plan = []  # (group_index, a, b, image_url, instruction)
        for gi, (start, a, b, snippet) in enumerate(gs):
            instr = instruction_for(snippet)
            if not (GROUP_WORDS.search(instr) and DIAGRAM_TASK.search(instr)):
                continue
            raw_start = pos[min(start, len(pos) - 1)]
            nxt = gs[gi + 1][0] if gi + 1 < len(gs) else len(text)
            raw_end = pos[min(nxt, len(pos) - 1)] if nxt < len(text) else len(raw)
            own = pick_images(raw, raw_start, raw_end)
            if own:
                if "<table" in raw[raw_start:raw_end].lower() and "diagram" not in instr.lower() and "picture" not in instr.lower():
                    continue  # a real text table; prompts can come from its cells
                plan.append((gi, a, b, own[-1][1], instr))
                continue
            # Composite screenshots often sit immediately before their header and
            # may cover this group too (e.g. a diagram plus the table beneath it).
            if "<table" in raw[raw_start:raw_end].lower():
                continue
            prev_imgs = pick_images(raw, max(0, raw_start - 6000), raw_start)
            if prev_imgs:
                plan.append((gi, a, b, prev_imgs[-1][1], instr))
        if not plan:
            continue
        affected = []
        for gi, a, b, url, instr in plan:
            group_qs = [q for q in questions
                        if re.search(r"q(\d+)$", q["id"]) and a <= int(re.search(r"q(\d+)$", q["id"]).group(1)) <= b]
            if group_qs:
                affected.append((a, b, url, instr, group_qs))
        if not affected:
            continue
        covered = {int(re.search(r"q(\d+)$", q["id"]).group(1))
                   for _, _, _, _, qs in affected for q in qs}
        overflow = []
        for q in questions:
            if q["id"] in covered or not str(q.get("prompt", "")).startswith(PLACEHOLDER):
                continue
            n = int(re.search(r"q(\d+)$", q["id"]).group(1))
            near = [p for p in affected if p[1] < n and n - p[1] <= 10]
            if near:
                overflow.append((q, max(near, key=lambda p: p[1])[2]))
        print(f"{data['id']}: " + "; ".join(f"{a}-{b} {len(qs)}q" for a, b, _, _, qs in affected)
              + (f" +{len(overflow)} overflow" if overflow else ""))
        if dry:
            for a, b, url, instr, qs in affected[:2]:
                print(f"   {a}-{b}: {instr[:70]!r} img={url.rsplit('/', 1)[-1]}")
            if overflow:
                print("   overflow:", ", ".join(q["id"] for q, _ in overflow))
            continue
        downloaded = {}
        for a, b, url, instr, qs in affected:
            if url not in downloaded:
                ext = re.sub(r"[?#].*$", "", url).split(".")[-1].lower()
                ext = ext if ext in EXT else "png"
                dest = IMG_DIR / f"{data['id']}-source-{len(downloaded) + 1}.{ext}"
                try:
                    download(url, dest)
                    downloaded[url] = f"/assets/questions/{dest.name}"
                except Exception as exc:
                    print(f"   ! download failed {url}: {exc}")
                    continue
            image = downloaded[url]
            label = "diagram" if re.search(r"diagram|map|label", instr, re.I) else "table"
            for q in qs:
                n = int(re.search(r"q(\d+)$", q["id"]).group(1))
                q["prompt"] = f"{instr or 'Questions ' + str(a) + '–' + str(b)} — {label} question {n} in the image."
                q["image"] = image
                if q.get("type") == "matching" and all(
                        re.fullmatch(r"Option [A-J]", o.get("text", "")) for o in q.get("options") or []):
                    q["type"] = "gap"
                    q.pop("options", None)
                changed_qs += 1
        for q, url in overflow:
            if url not in downloaded:
                continue
            n = int(re.search(r"q(\d+)$", q["id"]).group(1))
            q["prompt"] = f"Use the table or diagram in the image to answer question {n}."
            q["image"] = downloaded[url]
            changed_qs += 1
        f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        changed_tests += 1
    print(f"{'would change' if dry else 'changed'} {changed_qs} questions in {changed_tests} tests")


if __name__ == "__main__":
    main()
