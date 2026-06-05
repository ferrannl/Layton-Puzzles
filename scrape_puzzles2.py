import os
import json
import time
import requests
from bs4 import BeautifulSoup

# Configuration
BASE_URL = "https://professorlayton2walkthrough.blogspot.com/2008/11/puzzle{num}.html"
OUTPUT_FILE = "puzzles2.json"
TOTAL_PUZZLES = 153  # Standard puzzle count for Diabolical Box base game

def pad3(n):
    return str(n).zfill(3)

def clean_text(text):
    if not text:
        return ""
    return " ".join(text.strip().split())

def scrape_puzzle(pid):
    padded_id = pad3(pid)
    url = BASE_URL.format(num=padded_id)
    print(f"Scraping Puzzle #{padded_id} from {url}...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 404:
            print(f"⚠️ Puzzle #{padded_id} returned a 404. Skipping.")
            return None
        response.raise_for_status()
    except Exception as e:
        print(f"❌ Failed to download Puzzle #{padded_id}: {e}")
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    
    # 1. Title Extraction
    title_text = ""
    title_element = soup.find("h3", class_="post-title") or soup.find("h2", class_="date-header")
    if title_element:
        title_text = clean_text(title_element.get_text())
    
    if not title_text:
        title_text = f"Puzzle {padded_id}"

    # 2. Extract Images inside the main post body
    post_body = soup.find("div", class_="post-body")
    found_images = []
    if post_body:
        img_tags = post_body.find_all("img")
        for img in img_tags:
            src = img.get("src") or img.get("data-src")
            if src and src not in found_images:
                # Convert thumbnail or protocol-relative blogger URLs to standard high-res URLs
                if src.startswith("//"):
                    src = "https:" + src
                found_images.append(src)

    # 3. Separate image assets using the template's structured indexing rules
    # Game layouts: Index 0 = Problem view, Index 1 = Interactive/Canvas Area
    puzzle_assets = found_images[0:2] if len(found_images) >= 2 else found_images[0:1]
    
    # Fallback placeholders if image elements are missing on the host post
    hint1_assets = [found_images[2]] if len(found_images) >= 3 else []
    hint2_assets = [found_images[3]] if len(found_images) >= 4 else []
    hint3_assets = [found_images[4]] if len(found_images) >= 5 else []
    
    # Solutions usually sit at the end of the image sequence
    solution_assets = [found_images[-1]] if len(found_images) > len(puzzle_assets) else []

    # 4. Extract Answer Text
    solution_text = ""
    if post_body:
        # Find explicit text markers frequently used in the walkthrough text
        body_text = post_body.get_text()
        if "Answer:" in body_text:
            parts = body_text.split("Answer:")
            solution_text = clean_text(parts[-1])
        elif "Solution:" in body_text:
            parts = body_text.split("Solution:")
            solution_text = clean_text(parts[-1])

    # Construct the data structure matching your frontend application requirements
    puzzle_entry = {
        "id": pid,
        "title": title_text,
        "solution_text": solution_text,
        "images": {
            "puzzle": puzzle_assets,
            "hint1": hint1_assets,
            "hint2": hint2_assets,
            "hint3": hint3_assets,
            "solution": solution_assets
        }
    }
    
    return puzzle_entry

def main():
    puzzles_list = []
    
    print("🚀 Starting Diabolical Box Walkthrough Scraper...")
    for pid in range(1, TOTAL_PUZZLES + 1):
        # Specific patch for edge cases like your explicit request for #079
        data = scrape_puzzle(pid)
        if data:
            puzzles_list.append(data)
        
        # Polite spacing delay to prevent hitting Blogspot rate limits
        time.sleep(1.0)
        
    output_data = {"puzzles": puzzles_list}
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
        
    print(f"\n✅ Done! Saved {len(puzzles_list)} scraped puzzles to '{OUTPUT_FILE}'.")

if __name__ == "__main__":
    # Make sure dependency modules are available before executing
    # Pip dependencies: pip install requests beautifulsoup4
    main()
