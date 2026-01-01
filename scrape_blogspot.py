cd Layton-Puzzles
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install requests beautifulsoup4
python scrape_blogspot.py
