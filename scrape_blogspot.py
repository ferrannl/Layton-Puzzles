#!/usr/bin/env python3
import json
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import requests
from bs4 import BeautifulSoup, Tag

# Output in repo root
OUT_JSON = Path("puzzles.json")
DEBUG_DIR = Path("_debug_html")
DEBUG_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LaytonScraper/1.1; +github-actions)",
    "Accept-Language": "en-US,en;q=0.9",
}

TIMEOUT = 25
SLEEP_SECONDS = 1.2  # be polite
MAX_PAGES = 500  # just a safety cap

# Seed pages to discover puzzle links from:
SEEDS = [
    "https://professorlaytonwalkthrough.blogspot.com/2008/02/puzzle001.html",
    "https://professorlaytonwalkthrough.blogspot.com/",
]

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


def is_image_url(src: str) -> bool:
    return bool(src) and ("blogger.googleusercontent.com" in src or "bp.blogspot.com" in src)


def detect_section(text: str) -> Optional[str]:
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


def find_post_container(soup: BeautifulSoup) -> Tag:
    # Try common Blogger containers
    selectors = [
        "div.post-body.entry-content",
        "div.post-body",
        "div.post",
        "article",
        "div#main",
        "div.main",
        "body",
    ]
    for sel in selectors:
        el = soup.select_one(sel)
        if isinstance(el, Tag):
            return el
    return soup.body or soup


def extract_title(soup: BeautifulSoup) -> str:
    # Prefer header-like titles first
    for tag in ["h3", "h2", "h1"]:
        h = soup.find(tag)
        if h:
            t = clean_text(h.get_text(" ", strip=True))
            if t:
                return t
    if soup.title:
        t = clean_text(soup.title.get_text(" ", strip=True))
        if t:
            return t
    return "Untitled"


def extract_puzzle_id_from_title_or_url(title: str, url: str) -> Optional[int]:
    # Title usually starts with "001 ..."
    m = re.search(r"\b(\d{3})\b", title)
    if m:
        return int(m.group(1))
    m = re.search(r"puzzle(\d{3})\.html", url)
    if m:
        return int(m.group(1))
    return None


def save_debug(name: str, html: str):
    p = DEBUG_DIR / name
    p.write_text(html, encoding="utf-8")


def fetch(session: requests.Session, url: str) -> Tuple[int, str]:
    r = session.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
    return r.status_code, r.text or ""


def discover_puzzle_urls(session: requests.Session) -> List[str]:
    """
    Find all links matching .../puzzleNNN.html from seed pages.
    """
    found: Set[str] = set()

    for seed in SEEDS:
        code, html = fetch(session, seed)
        print(f"[seed] {seed} -> {code}")
        if code != 200 or not html:
            save_debug(f"seed_fail_{re.sub(r'[^a-zA-Z0-9]+','_',seed)[:60]}.html", html or f"STATUS={code}")
            continue

        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "professorlaytonwalkthrough.blogspot.com" not in href:
                continue
            if re.search(r"/puzzle\d{3}\.html$", href):
                found.add(href)

    urls = sorted(found)
    print(f"Discovered {len(urls)} puzzle links from seeds.")
    return urls[:MAX_PAGES]


def scrape_one(session: requests.Session, url: str) -> Optional[Puzzle]:
    code, html = fetch(session, url)
    print(f"[get] {url} -> {code}")

    if code != 200 or not html:
        save_debug(f"page_fail_{re.sub(r'[^0-9]', '', url)[-3:] or 'unknown'}.html", html or f"STATUS={code}")
        return None

    soup = BeautifulSoup(html, "html.parser")
    title = extract_title(soup)
    pid = extract_puzzle_id_from_title_or_url(title, url)
    if pid is None:
        # Save for inspection
        save_debug("no_pid.html", html)
        return None

    container = find_post_container(soup)

    images: Dict[str, List[str]] = {k: [] for k in SECTION_KEYS}
    current_section: Optional[str] = None
    in_solution = False
    in_progress = False
    solution_text = ""
    reward_text = ""

    for el in container.find_all(["h1", "h2", "h3", "p", "div", "span", "img"], recursive=True):
        if el.name in ["h1", "h2", "h3", "p", "span", "div"]:
            txt = clean_text(el.get_text(" ", strip=True))
            sec = detect_section(txt)
            if sec:
                current_section = sec
                in_solution = (sec == "solution")
                in_progress = (sec == "progress")
                continue

            # Capture the first meaningful line after Solution / Progress labels
            if in_solution and not solution_text and txt and txt.lower() != "solution":
                if len(txt) <= 220 and not txt.lower().startswith("hint"):
                    solution_text = txt

            if in_progress and not reward_text and txt and txt.lower() != "progress":
                if len(txt) <= 260 and any(k in txt.lower() for k in ["picar", "hint", "coin"]):
                    reward_text = txt

        if el.name == "img":
            src = el.get("src") or ""
            if not is_image_url(src):
                continue
            if not current_section:
                current_section = "puzzle"
            if src not in images[current_section]:
                images[current_section].append(src)

    # If we somehow got zero images, save the HTML to debug selector issues
    img_count = sum(len(v) for v in images.values())
    if img_count == 0:
        save_debug(f"no_images_{pid:03d}.html", html)

    return Puzzle(
        id=pid,
        title=title,
        url=url,
        solution_text=solution_text,
        reward_text=reward_text,
        images=images,
    )


def main():
    with requests.Session() as session:
        urls = discover_puzzle_urls(session)

        # Fallback: if discovery fails, try sequential as a backup
        if not urls:
            print("No puzzle links discovered from seeds. Falling back to sequential 001..200")
            urls = [f"https://professorlaytonwalkthrough.blogspot.com/2008/02/puzzle{n:03d}.html" for n in range(1, 201)]

        puzzles: List[Puzzle] = []
        for i, url in enumerate(urls, 1):
            p = scrape_one(session, url)
            if p:
                puzzles.append(p)
                print(f"  + OK #{p.id:03d} imgs={sum(len(v) for v in p.images.values())}")
            time.sleep(SLEEP_SECONDS)

    payload = {
        "source": "professorlaytonwalkthrough.blogspot.com",
        "generated_at_unix": int(time.time()),
        "count": len(puzzles),
        "puzzles": [asdict(p) for p in sorted(puzzles, key=lambda x: x.id)],
    }

    print("Writing:", OUT_JSON.resolve())
    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(puzzles)} puzzles to {OUT_JSON}")


if __name__ == "__main__":
    main()
