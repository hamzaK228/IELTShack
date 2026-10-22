#!/usr/bin/env python3
"""Fill missing reading questions that live in HTML tables or beside map images.

Reads the cached source page for an incomplete test, extracts table cells that
contain a numbered blank, builds a prompt from the table header/row context,
downloads any nearby image (maps/diagrams), and appends the question.
"""
import json
import re
import sys
import html as htmlmod
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "content" / "tests"
IMG_DIR = ROOT / "public" / "assets" / "questions"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36"}

LET = "ABCDEFGHIJ"
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]


def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = htmlmod.unescape(text).replace("\u2026", "...")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def cache_path(tid: str):
    m = re.match(r"pte-(gt-)?reading-(\d+)$", tid)
    if not m:
        return None
    folder = "gt-reading" if m.group(1) else "reading"
    return ROOT / "scripts" / ".cache" / folder / f"test-{m.group(2)}.html"


def key_map(lines):
    idx = [i for i, l in enumerate(lines) if re.match(r"^show\s+an\w*ers$", l, re.I)]
    if not idx:
        return {}
    block = lines[idx[-1] + 1:]
    block = [l for l in block if not re.match(r"^(copyright|privacy|disclaimer|terms|contact)", l, re.I)]
    pairs = re.findall(r"^(\d{1,2})\s*[\.\)]\s*(.+)$", "\n".join(block), re.M)
    if len(pairs) >= 20:
        return {int(n): a.strip() for n, a in pairs}
    vals = [l for l in block if len(l) < 80][:40]
    return {i + 1: v for i, v in enumerate(vals)}


def parse_tables(html):
    tables = []
    for tm in re.finditer(r"<table.*?</table>", html, re.S | re.I):
        rows = []
        for rm in re.finditer(r"<tr.*?</tr>", tm.group(0), re.S | re.I):
            cells = []
            for cm in re.finditer(r"<t([dh])\b[^>]*>(.*?)</t\1>", rm.group(0), re.S | re.I):
                cells.append({"header": cm.group(1).lower() == "d", "text": clean(cm.group(2))})
            if cells:
                rows.append(cells)
        if rows:
            tables.append({"start": tm.start(), "rows": rows})
    return tables


def find_image(html, pos):
    window = html[max(0, pos - 4000):pos]
    matches = list(re.finditer(r'<img\b[^>]*(?:data-src|src)="([^"]+)"', window, re.I))
    for m in reversed(matches):
        url = m.group(1)
        if url.startswith("data:"):
            continue
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            url = "https://practicepteonline.com" + url
        return url
    return None


def download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=30).read()
    dest.write_bytes(data)
    return dest


def main():
    targets = sys.argv[1:] or [
        f.stem for f in TESTS.glob("pte-*reading-*.json")
    ]
    total_added = 0
    for tid in targets:
        path = TESTS / f"{tid}.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        reading = [s for s in data["sections"] if s.get("skill") == "reading"]
        if not reading:
            continue
        have = {
            int(re.search(r"q(\d+)$", q["id"]).group(1))
            for s in reading
            for q in s["questions"]
            if re.search(r"q(\d+)$", q["id"])
        }
        missing = [n for n in range(1, 41) if n not in have]
        if not missing:
            continue

        cache = cache_path(tid)
        if not cache or not cache.exists():
            continue
        html = cache.read_text(errors="ignore")
        text = re.sub(r"<script.*?</script>|<style.*?</style>", "", html, flags=re.S)
        text = htmlmod.unescape(re.sub(r"<[^>]+>", "\n", text))
        lines = [re.sub(r"\s+", " ", l).strip() for l in text.split("\n") if l.strip()]
        keys = key_map(lines)
        tables = parse_tables(html)

        def numbers_of(section):
            return sorted(
                int(re.search(r"q(\d+)$", q["id"]).group(1))
                for q in section["questions"]
                if re.search(r"q(\d+)$", q["id"])
            )

        added = 0
        for n in missing:
            answer = keys.get(n)
            if not answer:
                continue
            cell = None
            for table in tables:
                for r, row in enumerate(table["rows"]):
                    for c, item in enumerate(row):
                        if re.search(rf"\(\s*{n}\s*\)\s*[.…_·•]{{2,}}", item["text"]):
                            cell = (table, r, c)
                            break
                    if cell:
                        break
                if cell:
                    break
            if not cell:
                # Bare inline marker, e.g. a table cell flattened to "(20)……".
                line_at = next(
                    (
                        i for i, line in enumerate(lines)
                        if re.search(rf"\(\s*{n}\s*\)\s*[.…_·•]{{2,}}", line)
                    ),
                    None,
                )
                if line_at is None:
                    continue
                context = [
                    l for l in lines[max(0, line_at - 3):line_at]
                    if l and not re.search(r"\(\s*\d+\s*\)\s*[.…_·•]", l)
                ][-2:]
                prompt = " · ".join(context) or f"Question {n}"
                prompt = f"{prompt} ______"
                image_url = find_image(html, html.find(f"({n})") if f"({n})" in html else 0)
                image = None
                if image_url and re.search(r"map|diagram|figure|below", html[max(0, html.find(f"({n})") - 4000):html.find(f"({n})")], re.I):
                    ext = re.sub(r"[?#].*$", "", image_url).split(".")[-1].lower()
                    ext = ext if ext in {"png", "jpg", "jpeg", "webp", "gif"} else "png"
                    dest = IMG_DIR / f"{tid}-{n}.{ext}"
                    try:
                        download(image_url, dest)
                        image = f"/assets/questions/{dest.name}"
                    except Exception:
                        image = None
                ans = str(answer).strip()
                q = {
                    "id": f"{tid}-q{n}", "skill": "reading",
                    "type": "gap", "prompt": prompt, "answer": ans, "difficulty": 2,
                }
                if re.fullmatch(r"[A-J]", ans, re.I):
                    last = LET.index(ans.upper())
                    q["type"] = "matching"
                    q["options"] = [{"id": c2, "text": f"Option {c2}"} for c2 in LET[: max(last, 1) + 1]]
                if image:
                    q["image"] = image
                target = None
                for section in reading:
                    nums = numbers_of(section)
                    if nums and nums[0] <= n <= nums[-1]:
                        target = section
                        break
                if target is None:
                    for section in reversed(reading):
                        nums = numbers_of(section)
                        if nums and nums[-1] < n:
                            target = section
                            break
                target = target or reading[0]
                target["questions"].append(q)
                target["questions"].sort(key=lambda item: int(re.search(r"q(\d+)$", item["id"]).group(1)))
                added += 1
                continue
            table, r, c = cell
            row = table["rows"][r]
            headers = [x["text"] for x in table["rows"][0]] if all(x["header"] for x in table["rows"][0]) else []
            row_label = row[0]["text"] if c > 0 and row[0]["text"] and not re.search(r"\(\s*\d+\s*\)", row[0]["text"]) else ""
            col_label = headers[c] if c < len(headers) else ""
            siblings = [
                x["text"] for j, x in enumerate(row)
                if j != c and x["text"] and not re.search(r"\(\s*\d+\s*\)", x["text"])
            ]
            parts = []
            if col_label:
                parts.append(f"{col_label}: {', '.join(siblings)}" if siblings else col_label)
            elif row_label:
                parts.append(row_label)
            if not parts and siblings:
                parts.append(", ".join(siblings))
            prompt = " · ".join(parts) or f"Table item {n}"
            prompt = f"{prompt} ______"

            image_url = find_image(html, table["start"])
            image = None
            if image_url and re.search(r"map|diagram|figure|below", html[max(0, table["start"] - 3000):table["start"]], re.I):
                ext = re.sub(r"[?#].*$", "", image_url).split(".")[-1].lower()
                ext = ext if ext in {"png", "jpg", "jpeg", "webp", "gif"} else "png"
                dest = IMG_DIR / f"{tid}-{n}.{ext}"
                try:
                    download(image_url, dest)
                    image = f"/assets/questions/{dest.name}"
                except Exception:
                    image = None

            ans = str(answer).strip()
            q = {
                "id": f"{tid}-q{n}",
                "skill": "reading",
                "type": "gap",
                "prompt": prompt,
                "answer": ans,
                "difficulty": 2,
            }
            if re.fullmatch(r"[A-J]", ans, re.I):
                last = LET.index(ans.upper())
                q["type"] = "matching"
                q["options"] = [{"id": c2, "text": f"Option {c2}"} for c2 in LET[: max(last, 1) + 1]]
            elif re.fullmatch(r"[ivx]+", ans, re.I) and ans.upper() in ROMAN:
                last = ROMAN.index(ans.upper())
                q["type"] = "matching"
                q["options"] = [{"id": c2, "text": f"Paragraph {c2}"} for c2 in ROMAN[: max(last, 1) + 1]]
            elif ans.lower() in {"true", "false", "not given", "yes", "no", "ng"}:
                yes = ans.lower() in {"yes", "no"}
                q["type"] = "tfng"
                q["options"] = [
                    {"id": "Yes" if yes else "True", "text": "Yes" if yes else "True"},
                    {"id": "No" if yes else "False", "text": "No" if yes else "False"},
                    {"id": "Not Given", "text": "Not Given"},
                ]
            if image:
                q["image"] = image

            target = None
            for section in reading:
                nums = numbers_of(section)
                if nums and nums[0] <= n <= nums[-1]:
                    target = section
                    break
            if target is None:
                for section in reversed(reading):
                    nums = numbers_of(section)
                    if nums and nums[-1] < n:
                        target = section
                        break
            target = target or reading[0]
            target["questions"].append(q)
            target["questions"].sort(
                key=lambda item: int(re.search(r"q(\d+)$", item["id"]).group(1))
            )
            added += 1

        if added:
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
            total_added += added
            print(f"{tid}: +{added} (now {len(have) + added}/40)")
    print("added", total_added)


if __name__ == "__main__":
    main()
