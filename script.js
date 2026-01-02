const $ = (sel) => document.querySelector(sel);

const PAGE_SIZE = 10;

function pad3(n) {
  return String(n).padStart(3, "0");
}

function sanitizeTitle(t, pid) {
  // Remove duplicate numbering like "Puzzle 006 - Light Weight" or "006 - Light Weight"
  if (!t) return `Puzzle ${pad3(pid)}`;

  let s = String(t).trim();

  // Remove "Puzzle 006" prefix variants
  s = s.replace(/^\s*puzzle\s*\d{1,3}\s*[-:–—]?\s*/i, "");

  // Remove "006" prefix variants
  s = s.replace(/^\s*\d{1,3}\s*[-:–—]\s*/i, "");

  // If it becomes empty, fall back
  s = s.trim();
  return s || `Puzzle ${pad3(pid)}`;
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
  const titleClean = sanitizeTitle(p.title, p.id);

  const hay = [
    `#${pad3(p.id)}`,
    titleClean,
    impossibleName,
    p.solution_text || "",
  ].join(" ").toLowerCase();

  return hay.includes(q);
}

function renderList(puzzlesPage, impossibleMap) {
  const list = $("#list");
  list.innerHTML = "";

  const openSol = $("#toggleAllSolutions")?.checked;

  for (const p of puzzlesPage) {
    const d = document.createElement("details");
    d.className = "puzzle";
    d.dataset.pid = String(p.id);

    const s = document.createElement("summary");

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `#${pad3(p.id)}`;

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = sanitizeTitle(p.title, p.id);

    const meta = document.createElement("span");
    meta.className = "meta";

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

    // PUZZLE
    const puzzleImgs = p.images?.puzzle || [];
    if (puzzleImgs.length) {
      const h = document.createElement("h3");
      h.textContent = "Puzzle";
      section.appendChild(h);
      section.appendChild(sectionGrid(puzzleImgs));
    }

    // HINTS (left-to-right row) + sequential unlock
    const hint1 = p.images?.hint1 || [];
    const hint2 = p.images?.hint2 || [];
    const hint3 = p.images?.hint3 || [];
    const hasAnyHints = hint1.length || hint2.length || hint3.length;

    if (hasAnyHints) {
      const rowTitle = document.createElement("h3");
      rowTitle.textContent = "Hints";
      section.appendChild(rowTitle);

      const row = document.createElement("div");
      row.className = "hintsRow";

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

      // Lock 2 + 3 until previous opened
      h2d.classList.add("locked");
      h3d.classList.add("locked");

      const unlock = (det) => det.classList.remove("locked");
      h1d.addEventListener("toggle", () => { if (h1d.open) unlock(h2d); });
      h2d.addEventListener("toggle", () => { if (h2d.open) unlock(h3d); });

      row.appendChild(h1d);
      row.appendChild(h2d);
      row.appendChild(h3d);
      section.appendChild(row);
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
  const oldOutline = el.style.outline;
  const oldOutlineOffset = el.style.outlineOffset;
  const oldTransition = el.style.transition;

  el.style.transition = "outline 120ms ease";
  el.style.outline = "3px solid rgba(234,158,68,.95)";
  el.style.outlineOffset = "4px";

  setTimeout(() => { el.style.outline = "3px solid rgba(234,158,68,.0)"; }, 220);
  setTimeout(() => {
    el.style.outline = oldOutline;
    el.style.outlineOffset = oldOutlineOffset;
    el.style.transition = oldTransition;
  }, 520);
}

function jumpToPuzzle(pid) {
  const el = document.querySelector(`details.puzzle[data-pid="${pid}"]`);
  if (!el) return false;
  el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  flashElement(el);
  return true;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function setPagerUI(page, totalPages) {
  const info = $("#pageInfo");
  const info2 = $("#pageInfo2");
  if (info) info.textContent = `Page ${page} / ${totalPages}`;
  if (info2) info2.textContent = `Page ${page} / ${totalPages}`;

  const prev = $("#prevPage");
  const next = $("#nextPage");
  const prev2 = $("#prevPage2");
  const next2 = $("#nextPage2");

  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  if (prev) prev.disabled = atStart;
  if (prev2) prev2.disabled = atStart;
  if (next) next.disabled = atEnd;
  if (next2) next2.disabled = atEnd;
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

  let currentFiltered = puzzles.slice();
  let currentPage = 1;

  const q = $("#q");

  const rerender = (resetPage = false) => {
    if (resetPage) currentPage = 1;

    const query = (q?.value || "").trim();
    currentFiltered = puzzles.filter((p) => matchesQuery(p, query, impossibleMap));

    const totalPages = Math.max(1, Math.ceil(currentFiltered.length / PAGE_SIZE));
    currentPage = clamp(currentPage, 1, totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = currentFiltered.slice(start, start + PAGE_SIZE);

    status.textContent = `Showing ${currentFiltered.length} results — ${PAGE_SIZE} per page`;
    setPagerUI(currentPage, totalPages);
    renderList(pageItems, impossibleMap);
  };

  q?.addEventListener("input", () => rerender(true));
  $("#toggleAllSolutions")?.addEventListener("change", () => rerender(false));

  const wirePager = (prevId, nextId, which) => {
    const prev = $(prevId);
    const next = $(nextId);

    prev?.addEventListener("click", () => {
      currentPage -= 1;
      rerender(false);
      // keep focus stable
    });
    next?.addEventListener("click", () => {
      currentPage += 1;
      rerender(false);
    });
  };

  // Top + bottom pager
  $("#prevPage")?.addEventListener("click", () => { currentPage--; rerender(false); });
  $("#nextPage")?.addEventListener("click", () => { currentPage++; rerender(false); });
  $("#prevPage2")?.addEventListener("click", () => { currentPage--; rerender(false); });
  $("#nextPage2")?.addEventListener("click", () => { currentPage++; rerender(false); });

  // Random puzzle: choose from filtered results, jump to correct page, then open puzzle
  $("#randomBtn")?.addEventListener("click", () => {
    if (!currentFiltered.length) return;

    const pick = currentFiltered[Math.floor(Math.random() * currentFiltered.length)];
    const idx = currentFiltered.findIndex(p => p.id === pick.id);

    const totalPages = Math.max(1, Math.ceil(currentFiltered.length / PAGE_SIZE));
    const targetPage = clamp(Math.floor(idx / PAGE_SIZE) + 1, 1, totalPages);

    currentPage = targetPage;
    rerender(false);

    // DOM updates immediately after renderList, so jump now
    jumpToPuzzle(pick.id);
  });

  rerender(true);
}

main();
