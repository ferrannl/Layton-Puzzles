<p align="center">
  <a href="https://ferrannl.github.io/Layton-Puzzles/">
    <img src="./logo.gif" alt="Professor Layton Puzzles" />
  </a>
</p>

<h1 align="center">🧠 Professor Layton – Puzzle Archive</h1>

<p align="center">
  <strong>A clean, faithful archive of Professor Layton puzzles.</strong><br>
  Focused on logic, clarity, and actually solving the puzzles.
</p>

<p align="center">
  <a href="https://ferrannl.github.io/Layton-Puzzles/">🌍 Live Demo</a>
</p>

---

## ✨ What is this?

**Professor Layton – Puzzle Archive** is a lightweight, static web archive containing  
the puzzles from the *Professor Layton* series — presented in a way that is:

- Clear
- Accurate
- Free from fluff
- Actually playable with the provided assets

Each puzzle page focuses **only on what matters**:
the puzzle itself, its hints, and its solution.

No accounts.  
No ads.  
No backend.  

Just puzzles.

Made with ❤️ by **Ferran**

---

## 🧩 What you can do

- 🖼️ View the **original puzzle images**
- 🔓 Reveal **hints one-by-one**, in the intended order
- ✅ View the **solution** (images and/or text)
- 🔍 **Search** by puzzle number, title, or content
- 🎲 Jump to a **Random Puzzle**
- 🚫 Instantly see which puzzles are **impossible / broken**

Everything runs client-side using static files.

---

## 🚀 Features

### ✅ Only relevant content
- Puzzle images
- Hint 1 / Hint 2 / Hint 3
- Solution  

*(Progress scenes, rewards, and story fluff are intentionally excluded)*

### 🧩 Sequential hints
Hints unlock in order —  
**Hint 2 only becomes available after Hint 1**, just like in the games.

### 🎲 Random Puzzle
Instantly jump to a random puzzle without browsing pages.

Perfect for:
- “Give me one to solve”
- Casual replay
- Testing logic skills

### 🔍 Search & navigation
- Search by puzzle number (`#025`)
- Search by title or text
- Clean pagination with progress indicator

### 🚫 Impossible puzzles (auto-updating)
Some puzzles **cannot be solved correctly** with the available assets alone  
(e.g. they require physical interaction, motion, or missing context).

These are automatically flagged:

- Marked visually in the UI
- Explained via tooltip
- Maintained in a central list
- Updated without touching UI code

---

## 🚫 Impossible / Infeasible puzzles

<!-- IMPOSSIBLE:START -->

Known broken / unsolvable puzzles are flagged in the UI:

- 006 — *Light Weight*
- 009 — *One Poor Pooch*
- 019 — *Parking Lot Gridlock (US) / Car Park Gridlock (UK)*
- 025 — *Equilateral Triangle*
- 135 — *Royal Escape (US) / Queen's Escape (UK)*

<!-- IMPOSSIBLE:END -->

---

## 🗂️ Project Structure

```text
/
├── index.html        # Main UI
├── style.css         # Layton-style theme
├── scrape_blogspot.py # Puzzle scraper (Blogspot → JSON)
├── puzzles.json      # Generated puzzle data
├── impossible.json   # Map of broken / infeasible puzzles
├── data/             # Per-game puzzle data files
├── javascript/
│   └── script.js     # Rendering, search, hint logic, pagination, random jump

## 🧠 Scraping Logic (Important)

The scraper is intentionally **strict and conservative**.

It **only collects images that appear under**:

* `Puzzle xxx`
* `Hint 1`
* `Hint 2`
* `Hint 3`
* `Solution`

Anything **before the puzzle header** or
**after the “Progress” section** is ignored.

This avoids:

* Scene/story fluff
* Reward screens
* UI junk not relevant to solving puzzles

The goal is **accuracy over completeness**.

---

## ▶️ How to run the scraper

```bash
python scrape_blogspot.py --all
```

This generates or updates:

```text
puzzles.json
```

You can limit how many puzzles are scraped by editing:

```python
MAX_PUZZLES = 30
```

---

## 🌍 Viewing the site

### Local

Just open:

```text
index.html
```

(No build step required)

### GitHub Pages

This project is designed to work perfectly as a **static GitHub Pages site**.

Once pushed, it’s live immediately.

### GitHub Actions

You can also run the scraper from the repository workflow:

- `.github/workflows/scrape.yml`
- trigger it manually with `workflow_dispatch`
- pass `games=all` or a comma-separated list like `diabolical-box,last-specter`

---

## 🧠 Design philosophy

* Static-first
* No JavaScript frameworks
* No server dependencies
* Minimal UI chrome
* Respect the original puzzle flow

If a puzzle **cannot be solved fairly**, it is marked — not hidden.

---

## 🧑‍💻 Credits & notes

* Puzzle content © Level-5
* This project is **non-commercial** and purely archival / educational
* Built with vanilla **HTML, CSS & JS**

---

## 🔗 Links

* 🌍 Live demo: [https://ferrannl.github.io/Layton-Puzzles/](https://ferrannl.github.io/Layton-Puzzles/)
* 🧠 Source code: [https://github.com/ferrannl/Layton-Puzzles](https://github.com/ferrannl/Layton-Puzzles)

---

🧩 Enjoy solving — and remember: A true gentleman leaves no puzzle unsolved!
