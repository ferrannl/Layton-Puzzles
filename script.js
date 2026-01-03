const $ = (sel) => document.querySelector(sel);

const PAGE_SIZE = 5;

const els = {
  q: $("#q"),
  status: $("#status"),
  list: $("#list"),
  toggleAllSolutions: $("#toggleAllSolutions"),
  pagerBottom: $("#pagerBottom"),
};

function pad3(n){ return String(n).padStart(3, "0"); }

function sanitizeTitle(t, pid) {
  if (!t) return `Puzzle ${pad3(pid)}`;
  let s = String(t).trim();
  s = s.replace(/^\s*puzzle\s*\d{3}\s*[-:–—]?\s*/i, "");
  s = s.replace(/^\s*\d{3}\s*[-:–—]\s*/i, "");
  s = s.replace(/^\s*\d{3}\s+/i, "");
  s = s.trim();
  return s || `Puzzle ${pad3(pid)}`;
}

/* ---------- Theme ---------- */

const THEME_KEY = "layton_theme_v1";

function getTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return (saved === "light" || saved === "dark") ? saved : "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

function installThemeToggle() {
  const controls = document.querySelector(".controls");
  if (!controls) return;

  const holder = document.createElement("div");
  holder.className = "themeToggle";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "themePill";
  btn.id = "themeBtn";

  const refreshLabel = () => {
    const t = getTheme();
    btn.innerHTML = `<span>Theme: ${t === "dark" ? "Dark" : "Light"}</span>`;
  };

  btn.addEventListener("click", () => {
    const next = getTheme() === "dark" ? "light" : "dark";
    setTheme(next);
    refreshLabel();
  });

  holder.appendChild(btn);
  controls.appendChild(holder);

  setTheme(getTheme());
  refreshLabel();
}

/* ---------- Solved State ---------- */

const SOLVED_KEY = "layton_solved_v1";

function loadSolved() {
  try {
    const raw = localStorage.getItem(SOLVED_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : {};
  } catch {
    return {};
  }
}

function saveSolved(map) {
  try { localStorage.setItem(SOLVED_KEY, JSON.stringify(map)); } catch {}
}

function isSolved(pid, solvedMap) {
  return !!solvedMap[String(pid)];
}

function setSolved(pid, val, solvedMap) {
  solvedMap[String(pid)] = !!val;
  saveSolved(solvedMap);
}

/* ---------- Memo Drawing (very simple) ---------- */

const MEMO_KEY = "layton_memo_v1";

function memoLoadAll() {
  try {
    const raw = localStorage.getItem(MEMO_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : {};
  } catch {
    return {};
  }
}

function memoSaveAll(map) {
  try { localStorage.setItem(MEMO_KEY, JSON.stringify(map)); } catch {}
}

function memoIdFor(src) {
  // stable-ish key per image url
  return String(src || "");
}

function setActiveTool(btns, tool) {
  btns.forEach(b => b.classList.toggle("active", b.dataset.tool === tool));
}

function fitCanvasToBox(canvas, box, keepImageDataURL) {
  // Preserve existing drawing by snapshotting first
  let snapshot = null;
  if (keepImageDataURL) {
    try { snapshot = canvas.toDataURL("image/png"); } catch {}
  }

  const w = Math.max(1, Math.round(box.clientWidth));
  const h = Math.max(1, Math.round(box.clientHeight));

  // Only resize if needed (resizing clears!)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  if (snapshot) {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = snapshot;
  }
}

function installMemoOnThumb(thumbEl, imgEl, src, memoMap) {
  const canvas = document.createElement("canvas");
  canvas.className = "memoCanvas";
  canvas.setAttribute("aria-label", "Memo drawing canvas");

  const tools = document.createElement("div");
  tools.className = "memoTools";

  const mkTool = (emoji, tool, label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "memoBtn";
    b.dataset.tool = tool;
    b.textContent = emoji;
    b.setAttribute("aria-label", label);
    b.title = label;
    return b;
  };

  const btnPen   = mkTool("✏️", "pen", "Pen");
  const btnErase = mkTool("🧽", "eraser", "Eraser");
  const btnClear = mkTool("🗑️", "clear", "Clear");

  tools.appendChild(btnPen);
  tools.appendChild(btnErase);
  tools.appendChild(btnClear);

  thumbEl.appendChild(canvas);
  thumbEl.appendChild(tools);

  // make canvas match the visible image area (inside thumb padding)
  const resizeNow = (keep) => fitCanvasToBox(canvas, imgEl, keep);

  // once image loads, size canvas to it
  const ensureSized = () => resizeNow(false);
  if (imgEl.complete) ensureSized();
  else imgEl.addEventListener("load", ensureSized, { once: true });

  // restore saved drawing
  const key = memoIdFor(src);
  const saved = memoMap[key];
  if (saved) {
    const img = new Image();
    img.onload = () => {
      resizeNow(false);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = saved;
  }

  // tools + state
  let tool = "pen";
  setActiveTool([btnPen, btnErase], tool);

  btnPen.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    tool = "pen";
    setActiveTool([btnPen, btnErase], tool);
  });

  btnErase.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    tool = "eraser";
    setActiveTool([btnPen, btnErase], tool);
  });

  btnClear.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Clear drawing on this image?")) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    delete memoMap[key];
    memoSaveAll(memoMap);
  });

  // drawing
  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let drawing = false;
  let lastX = 0, lastY = 0;

  const getPos = (evt) => {
    const r = canvas.getBoundingClientRect();
    const t = (evt.touches && evt.touches[0]) ? evt.touches[0] : evt;
    return {
      x: (t.clientX - r.left),
      y: (t.clientY - r.top),
    };
  };

  const start = (evt) => {
    // don't start drawing when clicking tool buttons
    if (evt.target && evt.target.closest && evt.target.closest(".memoTools")) return;

    drawing = true;
    const p = getPos(evt);
    lastX = p.x; lastY = p.y;
    evt.preventDefault();
  };

  const move = (evt) => {
    if (!drawing) return;
    const p = getPos(evt);

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 22;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
    }

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    lastX = p.x; lastY = p.y;
    evt.preventDefault();
  };

  const end = () => {
    if (!drawing) return;
    drawing = false;

    // save snapshot
    try {
      memoMap[key] = canvas.toDataURL("image/png");
      memoSaveAll(memoMap);
    } catch {}
  };

  // pointer events
  canvas.addEventListener("mousedown", start);
  window.addEventListener("mousemove", move, { passive:false });
  window.addEventListener("mouseup", end);

  canvas.addEventListener("touchstart", start, { passive:false });
  canvas.addEventListener("touchmove", move, { passive:false });
  canvas.addEventListener("touchend", end);

  // keep drawings aligned on resize (scale old drawing)
  const onResize = () => resizeNow(true);
  window.addEventListener("resize", onResize, { passive:true });
}

/* ---------- Images ---------- */

function makeImg(src, memoMap, { cropTop=false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "thumb" + (cropTop ? " cropTop" : "");

  const img = document.createElement("img");
  img.className = "pimg";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.src = src;

  wrap.appendChild(img);

  // install memo overlay
  installMemoOnThumb(wrap, img, src, memoMap);

  return wrap;
}

function sectionGrid(urls, memoMap, { cropIndex=null } = {}) {
  const grid = document.createElement("div");
  grid.className = "grid";

  (urls || []).forEach((u, idx) => {
    grid.appendChild(makeImg(u, memoMap, { cropTop: cropIndex === idx }));
  });

  return grid;
}

/* ---------- Subdetails ---------- */

function subDetails(title, className="", openByDefault=false) {
  const d = document.createElement("details");
  d.className = "subdetails" + (className ? ` ${className}` : "");
  if (openByDefault) d.open = true;

  const s = document.createElement("summary");
  s.textContent = title;

  const inner = document.createElement("div");
  inner.className = "inner";

  d.appendChild(s);
  d.appendChild(inner);
  return { d, inner };
}

/* ---------- Search ---------- */

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

/* ---------- Close other puzzles when one opens ---------- */

function closeOtherPuzzles(current) {
  document.querySelectorAll("details.puzzle[open]").forEach((det) => {
    if (det !== current) det.open = false;
  });
}

/* ---------- Render ---------- */

function renderList(puzzlesPage, impossibleMap, solvedMap, memoMap) {
  els.list.innerHTML = "";
  const openSol = els.toggleAllSolutions?.checked;

  for (const p of puzzlesPage) {
    const d = document.createElement("details");
    d.className = "puzzle";
    d.dataset.pid = String(p.id);

    d.addEventListener("toggle", () => {
      if (d.open) closeOtherPuzzles(d);
    });

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

    const solvedBtn = document.createElement("button");
    solvedBtn.type = "button";
    solvedBtn.className = "solvedBtn";
    solvedBtn.innerHTML = `<span class="solvedDot" aria-hidden="true"></span><span>Solved</span>`;
    solvedBtn.dataset.solved = isSolved(p.id, solvedMap) ? "true" : "false";
    solvedBtn.setAttribute("aria-pressed", solvedBtn.dataset.solved === "true" ? "true" : "false");

    solvedBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const now = !(solvedBtn.dataset.solved === "true");
      solvedBtn.dataset.solved = now ? "true" : "false";
      solvedBtn.setAttribute("aria-pressed", now ? "true" : "false");
      setSolved(p.id, now, solvedMap);
    });

    meta.appendChild(solvedBtn);

    s.appendChild(badge);
    s.appendChild(title);
    s.appendChild(meta);

    const section = document.createElement("div");
    section.className = "section";

    // Puzzle images: crop FIRST image
    const puzzleImgs = p.images?.puzzle || [];
    if (puzzleImgs.length) {
      section.appendChild(sectionGrid(puzzleImgs, memoMap, { cropIndex: 0 }));
    }

    // Hints
    const hint1 = p.images?.hint1 || [];
    const hint2 = p.images?.hint2 || [];
    const hint3 = p.images?.hint3 || [];
    const hasAnyHints = hint1.length || hint2.length || hint3.length;

    if (hasAnyHints) {
      const row = document.createElement("div");
      row.className = "hintsRow";

      const { d: h1d, inner: h1i } = subDetails("Hint 1", "hint1", false);
      if (hint1.length) h1i.appendChild(sectionGrid(hint1, memoMap));
      else h1i.appendChild(Object.assign(document.createElement("div"), { className:"textline", textContent:"(no images)" }));

      const { d: h2d, inner: h2i } = subDetails("Hint 2", "hint2", false);
      if (hint2.length) h2i.appendChild(sectionGrid(hint2, memoMap));
      else h2i.appendChild(Object.assign(document.createElement("div"), { className:"textline", textContent:"(no images)" }));

      const { d: h3d, inner: h3i } = subDetails("Hint 3", "hint3", false);
      if (hint3.length) h3i.appendChild(sectionGrid(hint3, memoMap));
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

      section.appendChild(document.createElement("br"));
    }

    // Solution: crop SECOND image
    const solImgs = p.images?.solution || [];
    if (solImgs.length || p.solution_text) {
      const { d: sd, inner } = subDetails("Solution", "solution", !!openSol);

      if (p.solution_text) {
        const t = document.createElement("div");
        t.className = "textline";
        t.textContent = p.solution_text;
        inner.appendChild(t);
      }
      if (solImgs.length) inner.appendChild(sectionGrid(solImgs, memoMap, { cropIndex: 1 }));
      section.appendChild(sd);
    }

    d.appendChild(s);
    d.appendChild(section);
    els.list.appendChild(d);
  }
}

/* ---------- Fetch ---------- */

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

/* ---------- Pager ---------- */

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
function scrollToTop() { window.scrollTo({ top: 0, behavior: "smooth" }); }

function jumpToPuzzle(pid) {
  const el = document.querySelector(`details.puzzle[data-pid="${pid}"]`);
  if (!el) return false;
  el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

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

  const prev = mkBtn("← Prev", "pager_prev");
  const rand = mkBtn("🎲 Random", "pager_rand");
  rand.classList.add("pbtnPrimary");
  const next = mkBtn("Next →", "pager_next");

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

  const onResize = () => updateProgress(container, state.page, state.totalPages);
  window.addEventListener("resize", onResize, { passive: true });
}

/* ---------- Main ---------- */

async function main() {
  installThemeToggle();

  if (els.status) els.status.style.display = "none";

  const BASE = new URL(".", window.location.href).href;
  const puzzlesUrl = BASE + "puzzles.json";
  const impossibleUrl = BASE + "impossible.json";

  const solvedMap = loadSolved();
  const memoMap = memoLoadAll();

  let puzzlesData;
  try {
    puzzlesData = await fetchJson(puzzlesUrl);
  } catch (e) {
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

    renderList(pageItems, impossibleMap, solvedMap, memoMap);
    buildPager(els.pagerBottom, state);
  };

  els.q?.addEventListener("input", () => { state.page = 1; state.renderPage(); });
  els.toggleAllSolutions?.addEventListener("change", () => state.renderPage());

  state.renderPage();
}

main();
