const $ = (sel) => document.querySelector(sel);

function pad3(n) {
  return String(n).padStart(3, "0");
}

function makeImg(src) {
  const wrap = document.createElement("div");
  wrap.className = "thumb";

  const img = document.createElement("img");
  img.className = "pimg";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.src = src;

  wrap.appendChild(img);
  return wrap;
}

function sectionGrid(urls) {
  const grid = document.createElement("div");
  grid.className = "grid";
  (urls || []).forEach((u) => grid.appendChild(makeImg(u)));
  return grid;
}

function subDetails(title, openByDefault = false) {
  const d = document.createElement("details");
  d.className = "subdetails";
  if (openByDefault) d.open = true;

  const s = document.createElement("summary");
  s.textContent = title;

  const inner = document.createElement("div");
  inner.className = "inner";

  d.appendChild(s);
  d.appendChild(inner);
  return { d, inner };
}

function matchesQuery(p, q, impossibleMap) {
  if (!q) return true;
  q = q.toLowerCase().trim();

  const impossibleName = impossibleMap?.[p.id] || "";

  const hay = [
    `#${pad3(p.id)}`,
    p.title || "",
    impossibleName,
    p.solution_text || "",
  ].join(" ").toLowerCase();

  return hay.includes(q);
}

function renderList(puzzles, impossibleMap) {
  const list = $("#list");
  list.innerHTML = "";

  const openSol = $("#toggleAllSolutions")?.checked;

  for (const p of puzzles) {
    const d = document.createElement("details");
    d.className = "puzzle";
    d.dataset.pid = String(p.id); // ✅ used by random puzzle jump

    const s = document.createElement("summary");

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `#${pad3(p.id)}`;

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = p.title || `Puzzle ${pad3(p.id)}`;

    const meta = document.createElement("span");
    meta.className = "meta";

    const imgCount = Object.values(p.images || {}).reduce(
      (acc, arr) => acc + (arr?.length || 0),
      0
    );

    const count = document.createElement("span");
    count.textContent = `${imgCount} imgs`;
    meta.appendChild(count);

    // impossible marker (from impossible.json)
    const impossibleName = impossibleMap?.[p.id];
    if (impossibleName) {
      const imp = document.createElement("span");
      imp.className = "impossible";
      imp.title = impossibleName;
      imp.textContent = "Impossible";
      meta.appendChild(imp);
    }

    s.appendChild(badge);
    s.appendChild(title);
    s.appendChild(meta);

    const section = document.createElement("div");
    section.className = "section";

    // PUZZLE images
    const puzzleImgs = p.images?.puzzle || [];
    if (puzzleImgs.length) {
      const h = document.createElement("h3");
      h.textContent = "Puzzle";
      section.appendChild(h);
      section.appendChild(sectionGrid(puzzleImgs));
    }

    // HINTS (sequential unlocking)
    const hint1 = p.images?.hint1 || [];
    const hint2 = p.images?.hint2 || [];
    const hint3 = p.images?.hint3 || [];

    const hasAnyHints = hint1.length || hint2.length || hint3.length;
    if (hasAnyHints) {
      const { d: h1d, inner: h1i } = subDetails("Hint 1", false);
      if (hint1.length) h1i.appendChild(sectionGrid(hint1));
      else {
        const t = document.createElement("div");
        t.className = "textline";
        t.textContent = "(no images)";
        h1i.appendChild(t);
      }

      const { d: h2d, inner: h2i } = subDetails("Hint 2", false);
      if (hint2.length) h2i.appendChild(sectionGrid(hint2));
      else {
        const t = document.createElement("div");
        t.className = "textline";
        t.textContent = "(no images)";
        h2i.appendChild(t);
      }

      const { d: h3d, inner: h3i } = subDetails("Hint 3", false);
      if (hint3.length) h3i.appendChild(sectionGrid(hint3));
      else {
        const t = document.createElement("div");
        t.className = "textline";
        t.textContent = "(no images)";
        h3i.appendChild(t);
      }

      h2d.classList.add("locked");
      h3d.classList.add("locked");

      const unlock = (det) => det.classList.remove("locked");
      h1d.addEventListener("toggle", () => { if (h1d.open) unlock(h2d); });
      h2d.addEventListener("toggle", () => { if (h2d.open) unlock(h3d); });

      section.appendChild(h1d);
      section.appendChild(h2d);
      section.appendChild(h3d);
    }

    // SOLUTION
    const solImgs = p.images?.solution || [];
    if (solImgs.length || p.solution_text) {
      const { d: sd, inner } = subDetails("Solution", !!openSol);

      if (p.solution_text) {
        const t = document.createElement("div");
        t.className = "textline";
        t.textContent = p.solution_text;
        inner.appendChild(t);
      }
      if (solImgs.length) inner.appendChild(sectionGrid(solImgs));
      section.appendChild(sd);
    }

    d.appendChild(s);
    d.appendChild(section);
    list.appendChild(d);
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

function normalizeImpossible(raw) {
  const map = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const n = Number(k);
    if (Number.isFinite(n)) map[n] = String(v);
  }
  return map;
}

function flashElement(el) {
  // quick inline “highlight flash” without changing your CSS file
  const oldOutline = el.style.outline;
  const oldOutlineOffset = el.style.outlineOffset;
  const oldTransition = el.style.transition;

  el.style.transition = "outline 120ms ease";
  el.style.outline = "3px solid rgba(234,158,68,.95)";
  el.style.outlineOffset = "4px";

  setTimeout(() => {
    el.style.outline = "3px solid rgba(234,158,68,.0)";
  }, 220);

  setTimeout(() => {
    el.style.outline = oldOutline;
    el.style.outlineOffset = oldOutlineOffset;
    el.style.transition = oldTransition;
  }, 520);
}

function jumpToPuzzle(pid) {
  const el = document.querySelector(`details.puzzle[data-pid="${pid}"]`);
  if (!el) return false;

  // open puzzle
  el.open = true;

  // scroll + flash
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  flashElement(el);

  return true;
}

async function main() {
  const status = $("#status");
  status.textContent = "Loading puzzles.json…";

  const BASE = new URL(".", window.location.href).href;
  const puzzlesUrl = BASE + "puzzles.json";
  const impossibleUrl = BASE + "impossible.json";

  let puzzlesData;
  try {
    puzzlesData = await fetchJson(puzzlesUrl);
  } catch (e) {
    status.textContent =
      "Failed to load puzzles.json. Ensure puzzles.json is in repo root and GitHub Pages is deploying from root.";
    console.error(e);
    return;
  }

  // impossible.json is optional
  let impossibleMap = {};
  try {
    const impRaw = await fetchJson(impossibleUrl);
    impossibleMap = normalizeImpossible(impRaw);
  } catch (e) {
    console.warn("impossible.json not found or failed to load (optional).", e);
    impossibleMap = {};
  }

  const puzzles = puzzlesData.puzzles || [];
  status.textContent = `Loaded ${puzzles.length} puzzles.`;

  // We'll keep the currently displayed list here (for random)
  let currentFiltered = puzzles.slice();

  const q = $("#q");

  const rerender = () => {
    const query = (q?.value || "").trim();
    currentFiltered = puzzles.filter((p) => matchesQuery(p, query, impossibleMap));
    status.textContent = `Showing ${currentFiltered.length} / ${puzzles.length}`;
    renderList(currentFiltered, impossibleMap);
  };

  q?.addEventListener("input", rerender);
  $("#toggleAllSolutions")?.addEventListener("change", rerender);

  // 🎲 Random puzzle button
  const randomBtn = $("#randomBtn");
  randomBtn?.addEventListener("click", () => {
    if (!currentFiltered.length) return;

    const pick = currentFiltered[Math.floor(Math.random() * currentFiltered.length)];
    // After rerender, the DOM exists. We can jump immediately.
    // If the list is long, scroll will move you right to it.
    jumpToPuzzle(pick.id);
  });

  rerender();
}

main();
