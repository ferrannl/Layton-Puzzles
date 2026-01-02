const $ = (sel) => document.querySelector(sel);

const PAGE_SIZE = 10;

// pagerTop is optional; bottom is expected
const els = {
  q: $("#q"),
  status: $("#status"),
  list: $("#list"),
  toggleAllSolutions: $("#toggleAllSolutions"),
  pagerTop: $("#pagerTop"),       // may be null (you removed it)
  pagerBottom: $("#pagerBottom"), // exists
};

function pad3(n){ return String(n).padStart(3, "0"); }

function sanitizeTitle(t, pid) {
  if (!t) return `Puzzle ${pad3(pid)}`;

  let s = String(t).trim();

  // Remove "Puzzle 003", "Puzzle 003 -", etc.
  s = s.replace(/^\s*puzzle\s*\d{3}\s*[-:–—]?\s*/i, "");

  // Remove "003 -", "003 –", etc.
  s = s.replace(/^\s*\d{3}\s*[-:–—]\s*/i, "");

  // ✅ Remove plain "003 " (digits + space)
  s = s.replace(/^\s*\d{3}\s+/i, "");

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
  els.list.innerHTML = "";
  const openSol = els.toggleAllSolutions?.checked;

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

    const impossibleName = impossibleMap?.[p.id];
    if (impossibleName) {
      const imp = document.createElement("span");
      imp.className = "impossible";
      imp.title = impossibleName;
      imp.textContent = "Infeasible";
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

    // HINTS row (left->right) with sequential lock
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
      else h1i.appendChild(Object.assign(document.createElement("div"), { className:"textline", textContent:"(no images)" }));

      const { d: h2d, inner: h2i } = subDetails("Hint 2", false);
      if (hint2.length) h2i.appendChild(sectionGrid(hint2));
      else h2i.appendChild(Object.assign(document.createElement("div"), { className:"textline", textContent:"(no images)" }));

      const { d: h3d, inner: h3i } = subDetails("Hint 3", false);
      if (hint3.length) h3i.appendChild(sectionGrid(hint3));
      else h3i.appendChild(Object.assign(document.createElement("div"), { className:"textline", textContent:"(no images)" }));

      h2d.classList.add("locked");
      h3d.classList.add("locked");

      const unlock = (det) => det.classList.remove("locked");
      h1d.addEventListener("toggle", () => { if (h1d.open) unlock(h2d); });
      h2d.addEventListener("toggle", () => { if (h2d.open) unlock(h3d); });

      row.appendChild(h1d);
      row.appendChild(h2d);
      row.appendChild(h3d);
      section.appendChild(row);

      // ✅ <br> between hints and solution
      section.appendChild(document.createElement("br"));
    }

    // SOLUTION (all images already filtered by scraper)
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
    els.list.appendChild(d);
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

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function jumpToPuzzle(pid) {
  const el = document.querySelector(`details.puzzle[data-pid="${pid}"]`);
  if (!el) return false;
  el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

/* ---------- Pager ---------- */

function mkBtn(label, id) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pbtn";
  b.id = id;
  b.textContent = label;
  return b;
}

function mkNumBtn(n, active=false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pbtn pnum" + (active ? " pnumActive" : "");
  b.textContent = String(n);
  b.dataset.page = String(n);
  return b;
}

function mkDots() {
  const d = document.createElement("span");
  d.className = "pnumDots";
  d.textContent = "…";
  return d;
}

function updateProgress(container, page, total) {
  const trackEl = container.querySelector(".pagerTrack");
  const pillEl = container.querySelector(".pagerPill");
  const labelEl = container.querySelector(".pagerLabel");
  if (!trackEl || !pillEl || !labelEl) return;

  labelEl.textContent = `Page ${page} / ${total} • ${PAGE_SIZE} per page`;

  const frac = total <= 1 ? 0 : (page - 1) / (total - 1);

  // ✅ accurate: pixel translate within track bounds
  requestAnimationFrame(() => {
    const trackW = trackEl.clientWidth || 0;
    const pillW  = pillEl.clientWidth || 0;
    const maxX = Math.max(0, trackW - pillW);
    pillEl.style.transform = `translateX(${Math.round(maxX * frac)}px)`;
  });
}

function buildPager(container, state) {
  if (!container) return;

  container.innerHTML = "";

  const row1 = document.createElement("div");
  row1.className = "pagerRow";

  const prev = mkBtn("← Prev", container.id + "_prev");
  const rand = mkBtn("🎲 Random", container.id + "_rand");
  rand.classList.add("pbtnPrimary");
  const next = mkBtn("Next →", container.id + "_next");

  prev.disabled = state.page <= 1;
  next.disabled = state.page >= state.totalPages;

  row1.appendChild(prev);
  row1.appendChild(rand);
  row1.appendChild(next);

  const row2 = document.createElement("div");
  row2.className = "pagerNums";

  const total = state.totalPages;
  const page = state.page;

  const windowSize = 2;
  const start = clamp(page - windowSize, 1, total);
  const end   = clamp(page + windowSize, 1, total);

  row2.appendChild(mkNumBtn(1, page === 1));
  if (start > 2) row2.appendChild(mkDots());

  for (let p = Math.max(2, start); p <= Math.min(total - 1, end); p++) {
    row2.appendChild(mkNumBtn(p, p === page));
  }

  if (end < total - 1) row2.appendChild(mkDots());
  if (total > 1) row2.appendChild(mkNumBtn(total, page === total));

  const row3 = document.createElement("div");
  row3.className = "pagerProgress";
  row3.innerHTML = `
    <div class="pagerTrack" aria-hidden="true">
      <div class="pagerPill"></div>
    </div>
    <div class="pagerLabel"></div>
  `;

  container.appendChild(row1);
  container.appendChild(row2);
  container.appendChild(row3);

  updateProgress(container, page, total);

  // events
  prev.addEventListener("click", () => {
    if (state.page > 1) { state.page--; state.renderPage(); scrollToTop(); }
  });

  next.addEventListener("click", () => {
    if (state.page < state.totalPages) { state.page++; state.renderPage(); scrollToTop(); }
  });

  rand.addEventListener("click", () => {
    if (!state.filtered.length) return;

    const pick = state.filtered[Math.floor(Math.random() * state.filtered.length)];
    const idx = state.filtered.findIndex(p => p.id === pick.id);
    const targetPage = clamp(Math.floor(idx / PAGE_SIZE) + 1, 1, state.totalPages);

    state.page = targetPage;
    state.renderPage();
    jumpToPuzzle(pick.id);
  });

  container.querySelectorAll("button[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      const p = Number(btn.dataset.page);
      if (!Number.isFinite(p)) return;
      state.page = p;
      state.renderPage();
      scrollToTop();
    });
  });

  // ✅ if viewport resizes, recompute pill position
  const onResize = () => updateProgress(container, state.page, state.totalPages);
  window.addEventListener("resize", onResize, { passive: true });
}

/* ---------- Main ---------- */

async function main() {
  els.status.textContent = "Loading puzzles.json…";

  const BASE = new URL(".", window.location.href).href;
  const puzzlesUrl = BASE + "puzzles.json";
  const impossibleUrl = BASE + "impossible.json";

  let puzzlesData;
  try {
    puzzlesData = await fetchJson(puzzlesUrl);
  } catch (e) {
    els.status.textContent = "Failed to load puzzles.json (check GitHub Pages root deploy).";
    console.error(e);
    return;
  }

  let impossibleMap = {};
  try {
    const impRaw = await fetchJson(impossibleUrl);
    impossibleMap = normalizeImpossible(impRaw);
  } catch {
    impossibleMap = {};
  }

  const puzzles = puzzlesData.puzzles || [];
  els.status.textContent = `Loaded ${puzzles.length} puzzles.`;

  const state = {
    page: 1,
    totalPages: 1,
    filtered: puzzles.slice(),
    renderPage: () => {},
  };

  state.renderPage = () => {
    const query = (els.q?.value || "").trim();
    state.filtered = puzzles.filter(p => matchesQuery(p, query, impossibleMap));

    state.totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    state.page = clamp(state.page, 1, state.totalPages);

    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = state.filtered.slice(start, start + PAGE_SIZE);

    els.status.textContent = `Showing ${state.filtered.length} results — ${PAGE_SIZE} per page`;
    renderList(pageItems, impossibleMap);

    buildPager(els.pagerTop, state);     // ok if null
    buildPager(els.pagerBottom, state);  // bottom always
  };

  els.q?.addEventListener("input", () => { state.page = 1; state.renderPage(); });
  els.toggleAllSolutions?.addEventListener("change", () => state.renderPage());

  state.renderPage();
}

main();
