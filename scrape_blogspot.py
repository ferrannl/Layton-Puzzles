#!/usr/bin/env python3
import json
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup, Tag

BASE = "https://professorlaytonwalkthrough.blogspot.com/2008/02"
OUT_JSON = Path("puzzles.json")  # <-- ROOT output

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LaytonScraper/1.0; +local-script)",
    "Accept-Language": "en-US,en;q=0.9",
}

SLEEP_SECONDS = 0.8
TIMEOUT = 20
MAX_CONSECUTIVE_MISSES = 8
PUZZLE_URL_FMT = BASE + "/puzzle{num:03d}.html"

SECTION_KEYS = ["scene", "puzzle", "hint1", "hint2", "hint3", "solution", "progress"]


@dataclass
class Puzzle:
    id: int
    title: str
    url: str
    solution_text: str
    reward_text: str
    images: Dict[str, List[str]]


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def is_main_image_url(src: str) -> bool:
    if not src:
        return False
    return ("blogger.googleusercontent.com" in src) or ("bp.blogspot.com" in src)


def find_post_container(soup: BeautifulSoup) -> Tag:
    selectors = [
        "div.post-body.entry-content",
        "div.post-body",
        "article",
        "div.main",
        "div#main",
        "body",
    ]
    for sel in selectors:
        el = soup.select_one(sel)
        if isinstance(el, Tag):
            return el
    return soup.body or soup


def extract_title(soup: BeautifulSoup) -> str:
    # Often the visible title is in h3/h2
    h = soup.find(["h3", "h2", "h1"])
    if h:
        t = clean_text(h.get_text(" ", strip=True))
        if t:
            return t
    if soup.title:
        t = clean_text(soup.title.get_text(" ", strip=True))
        if t:
            return t
    return "Untitled"


def detect_section_from_text(text: str) -> Optional[str]:
    t = clean_text(text).lower()
    if not t:
        return None
    if "watch the scene" in t:
        return "scene"
    if t.startswith("puzzle "):
        return "puzzle"
    if t.startswith("hint 1"):
        return "hint1"
    if t.startswith("hint 2"):
        return "hint2"
    if t.startswith("hint 3"):
        return "hint3"
    if t.startswith("solution"):
        return "solution"
    if t.startswith("progress"):
        return "progress"
    return None


def iter_blocks(container: Tag):
    for el in container.find_all(["h1", "h2", "h3", "p", "div", "span", "img"], recursive=True):
        yield el


def scrape_one(url: str, pid: int, session: requests.Session) -> Optional[Puzzle]:
    r = session.get(url, headers=HEADERS, timeout=TIMEOUT)
    if r.status_code != 200 or not r.text:
        return None

    soup = BeautifulSoup(r.text, "html.parser")
    container = find_post_container(soup)
    title = extract_title(soup)

    images: Dict[str, List[str]] = {k: [] for k in SECTION_KEYS}
    current_section: Optional[str] = None

    solution_text = ""
    reward_text = ""
    in_solution = False
    in_progress = False

    for el in iter_blocks(container):
        if el.name in ["h1", "h2", "h3", "p", "span", "div"]:
            txt = clean_text(el.get_text(" ", strip=True))
            sec = detect_section_from_text(txt)
            if sec:
                current_section = sec
                in_solution = (sec == "solution")
                in_progress = (sec == "progress")
                continue

            # Grab the first reasonable text after Solution / Progress label
            if in_solution and not solution_text and txt and txt.lower() != "solution":
                if len(txt) <= 200 and not txt.lower().startswith("hint"):
                    solution_text = txt

            if in_progress and not reward_text and txt and txt.lower() != "progress":
                if len(txt) <= 220 and any(k in txt.lower() for k in ["picar", "hint", "coin"]):
                    reward_text = txt

        if el.name == "img":
            src = el.get("src") or ""
            if not is_main_image_url(src):
                continue
            if not current_section:
                current_section = "puzzle"
            if src not in images[current_section]:
                images[current_section].append(src)

    return Puzzle(
        id=pid,
        title=title,
        url=url,
        solution_text=solution_text,
        reward_text=reward_text,
        images=images,
    )


def scrape_range(start: int = 1, end: int = 300) -> List[Puzzle]:
    puzzles: List[Puzzle] = []
    misses = 0

    with requests.Session() as session:
        for pid in range(start, end + 1):
            url = PUZZLE_URL_FMT.format(num=pid)
            print(f"[{pid:03d}] {url}")

            try:
                p = scrape_one(url, pid, session)
            except requests.RequestException as e:
                print(f"  ! request error: {e}")
                p = None

            if p is None:
                misses += 1
                print(f"  - missing ({misses}/{MAX_CONSECUTIVE_MISSES})")
                if misses >= MAX_CONSECUTIVE_MISSES:
                    print("Stopping (too many consecutive misses).")
                    break
            else:
                misses = 0
                puzzles.append(p)
                img_count = sum(len(v) for v in p.images.values())
                print(f"  + scraped: {p.title} | imgs={img_count} | sol_text={'yes' if p.solution_text else 'no'}")

            time.sleep(SLEEP_SECONDS)

    return puzzles


def main():
    puzzles = scrape_range(start=1, end=300)

    payload = {
        "source": "professorlaytonwalkthrough.blogspot.com",
        "generated_at_unix": int(time.time()),
        "count": len(puzzles),
        "puzzles": [asdict(p) for p in puzzles],
    }

    print("Writing:", OUT_JSON.resolve())
    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(puzzles)} puzzles to {OUT_JSON}")


if __name__ == "__main__":
    main()
