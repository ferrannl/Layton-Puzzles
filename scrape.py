import os
import json
import time
import requests
from bs4 import BeautifulSoup

GAMES_CONFIG = {
    "curious-village": {
        "base_url": "https://professorlaytonwalkthrough.blogspot.com/2007/11/puzzle{num}.html",
        "total_puzzles": 135,
        "filename": "data/curious-village.json"
    },
    "diabolical-box": {
        "base_url": "https://professorlayton2walkthrough.blogspot.com/2008/11/puzzle{num}.html",
        "total_puzzles": 153,
        "filename": "data/diabolical-box.json"
    },
    "unwound-future": {
        "base_url": "https://professorlayton3walkthrough.blogspot.com/2009/01/puzzle{num}.html",
        "total_puzzles": 165,
        "filename": "data/unwound-future.json"
    },
    "last-specter": {
        "base_url": "https://professorlayton4walkthrough.blogspot.com/2010/01/puzzle{num}.html",
        "total_puzzles": 170,
        "filename": "data/last-specter.json"
    },
    "miracle-mask": {
        "base_url": "https://professorlayton5walkthrough.blogspot.com/2012/09/puzzle{num}.html",
        "total_puzzles": 150,
        "filename": "data/miracle-mask.json"
    },
    "azran-legacy": {
        "base_url": "https://professorlayton6walkthrough.blogspot.com/2013/03/puzzle{num}.html",
        "total_puzzles": 165,
        "filename": "data/azran-legacy.json"
    }
}

def pad3(n):
    return str(n).zfill(3)

def clean_text(text):
    if not text: return ""
    return " ".join(text.strip().split())

def scrape_puzzle(base_url, pid):
    padded_id = pad3(pid)
    url = base_url.format(num=padded_id)
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LaytonArchive/2.0"}
    
    try:
        response = requests.get(url, headers=headers, timeout=12)
        if response.status_code == 404: 
            return None
        response.raise_for_status()
    except Exception as e:
        print(f"    ❌ Network error fetching puzzle #{padded_id}: {e}")
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    
    title_text = ""
    title_element = soup.find("h3", class_="post-title") or soup.find("h2", class_="date-header")
    if title_element:
        title_text = clean_text(title_element.get_text())
    if not title_text:
        title_text = f"Puzzle {padded_id}"

    post_body = soup.find("div", class_="post-body")
    found_images = []
    if post_body:
        for img in post_body.find_all("img"):
            src = img.get("src") or img.get("data-src")
            if src:
                if src.startswith("//"): src = "https:" + src
                if src not in found_images: found_images.append(src)

    puzzle_assets = found_images[0:2] if len(found_images) >= 2 else found_images[0:1]
    hint1 = [found_images[2]] if len(found_images) >= 3 else []
    hint2 = [found_images[3]] if len(found_images) >= 4 else []
    hint3 = [found_images[4]] if len(found_images) >= 5 else []
    solution = [found_images[-1]] if len(found_images) > len(puzzle_assets) else []

    solution_text = ""
    if post_body:
        body_text = post_body.get_text()
        for marker in ["Answer:", "Solution:", "Correct answer:", "Answer Written Out:"]:
            if marker in body_text:
                solution_text = clean_text(body_text.split(marker)[-1])
                break

    return {
        "id": pid,
        "title": title_text,
        "solution_text": solution_text,
        "images": {
            "puzzle": puzzle_assets,
            "hint1": hint1,
            "hint2": hint2,
            "hint3": hint3,
            "solution": solution
        }
    }

def main():
    os.makedirs("data", exist_ok=True)
    print("🎩 Professor Layton 6-Game Master Scraper Online!")
    
    for game_key, cfg in GAMES_CONFIG.items():
        print(f"\n📦 Fetching dataset mapping: [{game_key.upper()}]")
        puzzles_list = []
        
        for pid in range(1, cfg["total_puzzles"] + 1):
            print(f" -> Indexing puzzle #{pad3(pid)} / {cfg['total_puzzles']}", end="\r")
            data = scrape_puzzle(cfg["base_url"], pid)
            if data:
                puzzles_list.append(data)
            time.sleep(0.35) # Polite throttle delay to prevent IP bans
            
        with open(cfg["filename"], "w", encoding="utf-8") as f:
            json.dump({"puzzles": puzzles_list}, f, indent=2, ensure_ascii=False)
        print(f"\n✅ Dataset compiled successfully: {cfg['filename']}")

if __name__ == "__main__":
    main()
