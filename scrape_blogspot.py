#!/usr/bin/env python3
import json
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import requests
from bs4 import BeautifulSoup, Tag

OUT_JSON = Path("puzzles.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LaytonScraper/2.0; +github-actions)",
    "Accept-Language": "en-US,en;q=0.9",
}

TIMEOUT = 30
SLEEP_SECONDS = 1.2
MAX_PAGES = 800

# Seed pages to discover puzzle links (sidebar/nav)
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


def extract_puzzle_id(title: str, url: str) -> Optional[int]:
    m = re.search(r"\b(\d{3})\b", title)
    if m:
        return int(m.group(1))
    m = re.search(r"puzzle(\d{3})\.html", url)
    if m:
        return int(m.group(1))
    return None


def looks_blocked_or_empty(html: str) -> bool:
    """
    Heuristics: Blogger sometimes returns consent/blocked pages to CI.
    If the HTML is tiny or lacks key markers, treat as blocked/empty.
    """
    if not html or len(html) < 4000:
        return True
    low = html.lower()
    # Common consent/blocked markers (not exhaustive)
    if "consent" in low and "google" in low and "privacy" in low:
        return True
    if "unusual traffic" in low:
        return True
    # For this blog, puzzle pages normally contain "Puzzle 0xx" somewhere.
    if "puzzle 0" not in low and "puzzle&nbsp;0" not in low and "puzzle&nbsp;00" not in low:
        # Could still be okay (homepage), but for puzzle pages it’s a strong hint.
        return True
    return False


def fetch_with_fallback(session: requests.Session, url: str) -> Tuple[int, str, str]:
    """
    Try direct fetch; if it looks blocked/empty, fall back to r.jina.ai proxy.
    Returns (status_code, html, mode) where mode is "direct" or "proxy".
    """
    # 1) direct
    try:
        r = session.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
        html = r.text or ""
        if r.status_code == 200 and not looks_blocked_or_empty(html):
            return r.status_code, html, "direct"
        # If non-200 or looks blocked, try proxy
    except requests.RequestException:
        pass

    # 2) proxy fallback (often works when CI IPs get served “special” pages)
    proxy_url = "https://r.jina.ai/" + url
    try:
        r2 = session.get(proxy_url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
        return r2.status_code, (r2.text or ""), "proxy"
    except requests.RequestException as e:
        return 0, f"ERROR: {e}", "error"


def discover_puzzle_urls(session: requests.Session) -> List[str]:
    found: Set[str] = set()

    for seed in SEEDS:
        code, html, mode = fetch_with_fallback(session, seed)
        print(f"[seed] {seed} -> {code} ({mode})")

        if code != 200 or not html:
            continue

        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "professorlaytonwalkthrough.blogspot.com" not in href:
                continue
            if re.search(r"/puzzle\d{3}\.html$", href):
                found.add(href)

        time.sleep(0.3)

    urls = sorted(found)
    print(f"Discovered {len(urls)} puzzle links.")
    return urls[:MAX_PAGES]


def scrape_one(session: requests.Session, url: str) -> Optional[Puzzle]:
    code, html, mode = fetch_with_fallback(session, url)
    print(f"[get] {url} -> {code} ({mode})")

    if code != 200 or not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    title = extract_title(soup)
    pid = extract_puzzle_id(title, url)
    if pid is None:
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

            if in_solution and not solution_text and txt and txt.lower() != "solution":
                if len(txt) <= 240 and not txt.lower().startswith("hint"):
                    solution_text = txt

            if in_progress and not reward_text and txt and txt.lower() != "progress":
                if len(txt) <= 280 and any(k in txt.lower() for k in ["picar", "hint", "coin"]):
                    reward_text = txt

        if el.name == "img":
            src = el.get("src") or ""
            if not is_image_url(src):
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


def main():
    with requests.Session() as session:
        urls = discover_puzzle_urls(session)

        # Fallback if discovery finds nothing
        if not urls:
            print("No links discovered; fallback sequential 001..200")
            urls = [
                f"https://professorlaytonwalkthrough.blogspot.com/2008/02/puzzle{n:03d}.html"
                for n in range(1, 201)
            ]

        puzzles: List[Puzzle] = []
        for url in urls:
            p = scrape_one(session, url)
            if p:
                puzzles.append(p)
                img_count = sum(len(v) for v in p.images.values())
                print(f"  + OK #{p.id:03d} imgs={img_count}")
            time.sleep(SLEEP_SECONDS)

    puzzles = sorted(puzzles, key=lambda x: x.id)

    payload = {
        "source": "professorlaytonwalkthrough.blogspot.com",
        "generated_at_unix": int(time.time()),
        "count": len(puzzles),
        "puzzles": [asdict(p) for p in puzzles],
    }

    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {len(puzzles)} puzzles to {OUT_JSON}")

    if len(puzzles) == 0:
        print("WARNING: Still 0 puzzles scraped. This indicates network/HTML blocking even via proxy.")


if __name__ == "__main__":
    main()
