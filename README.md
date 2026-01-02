<p align="center">
  <a href="./index.html">
    <img src="./logo.gif" alt="Professor Layton Puzzles" />
  </a>
</p>

# Professor Layton – Puzzle Archive

A lightweight, static web archive for **Professor Layton puzzles**, focused on **clarity, accuracy, and playability**.

This project contains puzzle pages (Puzzle 001 → 100+) and presents them in a clean interface where you can:

- View **Puzzle images**
- Reveal **Hints one-by-one** (Hint 2 unlocks after Hint 1, etc.)
- View the **Solution**
- Search puzzles by number or title
- Jump to a **Random Puzzle**
- Automatically flag **impossible / broken puzzles**

No accounts, no tracking, no backend — just static files.

---

## Features

- ✅ **Only relevant content**
  - Puzzle images
  - Hint 1 / Hint 2 / Hint 3
  - Solution  
  *(Progress / reward content is intentionally ignored)*

- 🧩 **Sequential hints**
  - Hints unlock in order, just like the games

- 🎲 **Random Puzzle**
  - Instantly jump to a random puzzle to play without browsing

- 🚫 **Impossible puzzles (auto-updating)**
  - The repo maintains an **auto-updating list** of puzzles that are known to be **broken, incorrect, or not realistically solvable** with the available assets.
  - The UI shows an **“Impossible”** badge when a puzzle is in that list.
  - The list is designed to scale (001 → 100+) and can be updated automatically (e.g., via a small script / workflow) without manual editing of the UI code.

---

## Project Structure

```text
/
├── index.html        # Main UI
├── style.css         # Layton-style theme
├── script.js         # Rendering, search, hint logic + random puzzle
├── scrape.py         # Puzzle scraper
├── puzzles.json      # Generated puzzle data
├── logo.gif          # Project logo (used in README + site)
└── README.md
````

---

## Scraping Logic (Important)

The scraper is intentionally strict.

It **only collects images that appear under**:

* `Puzzle xxx`
* `Hint 1`
* `Hint 2`
* `Hint 3`
* `Solution`

Anything **before** the puzzle header or **after the “Progress” section** is ignored.

This avoids:

* Scene fluff
* Progress/reward images
* UI junk not relevant to solving puzzles

---

## How to Run the Scraper

```bash
python scrape.py
```

This generates / updates:

```text
puzzles.json
```

You can adjust the limit in `scrape.py`:

```python
MAX_PUZZLES = 30
```

---

## Viewing the Site

Open locally:

```text
index.html
```

Or host it via **GitHub Pages** (static, no build step required).

```
```
