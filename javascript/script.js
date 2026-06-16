import { memoLoadAll, installMemoOnThumb } from "./memo.js";
import { buildPager } from "./pager.js";

const PAGE_SIZE = 5;
const $ = (sel) => document.querySelector(sel);

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
  return s.trim() || `Puzzle ${pad3(pid)}`;
}

/* ---------- Solved/Theme Setup ---------- */
const GAME_ID_ATTR = document.body.dataset.gameId || "curious-village";
const SOLVED_KEY = `layton_solved_${GAME_ID_ATTR}_v1`;
const MEMO_KEY = `layton_memo_${GAME_ID_ATTR}_v1`;
const THEME_KEY = "layton_theme_v1";

function getTheme() { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; }
function setTheme(t) { document.documentElement.setAttribute("data-theme", t); localStorage.setItem(THEME_KEY, t); }

function installThemeToggle() {
  const controls = document.querySelector(".controls");
  if (!controls) return;
  const holder = document.createElement("div"); holder.className = "themeToggle";
  const moreBtn = document.createElement("button"); moreBtn.className = "morePuzzlesPill"; moreBtn.textContent = "More puzzles";
  const btn = document.createElement("button"); btn.className = "themePill";

  const refreshLabel = () => btn.innerHTML = `<span>Theme: ${getTheme() === "dark" ? "Dark" : "Light"}</span>`;
  btn.addEventListener("click", () => { setTheme(getTheme() === "dark" ? "light" : "dark"); refreshLabel(); });

  holder.appendChild(moreBtn); holder.appendChild(btn); controls.appendChild(holder);
  setTheme(getTheme()); refreshLabel();
  installMorePuzzlesModal(moreBtn);
}

function installMorePuzzlesModal(triggerBtn) {
  if (!triggerBtn || document.querySelector("#moreModal")) return;
  const modal = document.createElement("div"); modal.className = "moreModal"; modal.id = "moreModal"; modal.setAttribute("aria-hidden", "true");
  const links = [
    { name: "Curious Village", url: "curious-village.html" },
    { name: "Diabolical Box", url: "diabolical-box.html" },
    { name: "Unwound Future", url: "unwound-future.html" },
    { name: "Last Specter", url: "last-specter.html" },
    { name: "Miracle Mask", url: "miracle-mask.html" },
    { name: "Azran Legacy", url: "azran-legacy.html" },
  ];
  modal.innerHTML = `<div class="morePanel"><div class="moreTop"><h2>More Layton puzzles</h2><button class="moreClose" id="moreClose">✕</button></div><div class="moreList" id="moreList"></div></div>`;
  document.body.appendChild(modal);
  const list = modal.querySelector("#moreList");
  links.forEach(item => {
    const a = document.createElement("a"); a.className = "moreLink"; a.href = item.url;
    a.innerHTML = `<span>${item.name}</span><small>→</small>`;
    list.appendChild(a);
  });
  triggerBtn.addEventListener("click", () => { modal.classList.add("open"); document.body.style.overflow = "hidden"; });
  const close = () => { modal.classList.remove("open"); document.body.style.overflow = ""; };
  modal.querySelector("#moreClose").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}

function loadSolved() { try { return JSON.parse(localStorage.getItem(SOLVED_KEY)) || {}; } catch { return {}; } }
function setSolved(pid, val, solvedMap) { solvedMap[String(pid)] = !!val; localStorage.setItem(SOLVED_KEY, JSON.stringify(solvedMap)); }

/* ---------- Visual Framework Rendering ---------- */
function makeImg(src, memoMap, { cropTop=false, enableMemo=false } = {}) {
  const wrap = document.createElement("div"); wrap.className = "thumb" + (cropTop ? " cropTop" : "");
  const img = document.createElement("img"); img.className = "pimg"; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.src = src;
  wrap.appendChild(img);
  if (enableMemo) installMemoOnThumb(wrap, img, src, memoMap, MEMO_KEY);
  return wrap;
}

function sectionGrid(urls, memoMap, opts = {}) {
  const grid = document.createElement("div"); grid.className = "grid";
  (urls || []).forEach((u, idx) => {
    grid.appendChild(makeImg(u, memoMap, { cropTop: opts.cropIndex === idx, enableMemo: opts.memoIndex === idx }));
  });
  return grid;
}

function subDetails(title, className="", openByDefault=false) {
  const d = document.createElement("details"); d.className = "subdetails " + className; if (openByDefault) d.open = true;
  const s = document.createElement("summary"); s.textContent = title;
  const inner = document.createElement("div"); inner.className = "inner";
  d.appendChild(s); d.appendChild(inner);
  return { d, inner };
}

function renderList(puzzlesPage, impossibleMap, solvedMap, memoMap) {
  els.list.innerHTML = "";
  const openSol = els.toggleAllSolutions?.checked;

  puzzlesPage.forEach(p => {
    const d = document.createElement("details"); d.className = "puzzle"; d.dataset.pid = String(p.id);
    d.addEventListener("toggle", () => {
      if (d.open) document.querySelectorAll("details.puzzle[open]").forEach(ot => { if(ot !== d) ot.open = false; });
    });

    const s = document.createElement("summary");
    s.innerHTML = `<span class="badge">#${pad3(p.id)}</span><span class="title">${sanitizeTitle(p.title, p.id)}</span>`;
    
    const meta = document.createElement("span"); meta.className = "meta";
    if (impossibleMap?.[p.id]) {
      meta.innerHTML += `<span class="impossible" title="${impossibleMap[p.id]}">Infeasible</span>`;
    }

    const sBtn = document.createElement("button"); sBtn.className = "solvedBtn";
    sBtn.innerHTML = `<span class="solvedDot"></span><span>Solved</span>`;
    sBtn.dataset.solved = solvedMap[String(p.id)] ? "true" : "false";
    sBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const now = !(sBtn.dataset.solved === "true");
      sBtn.dataset.solved = now ? "true" : "false";
      setSolved(p.id, now, solvedMap);
    });
    meta.appendChild(sBtn); s.appendChild(meta); d.appendChild(s);

    const sec = document.createElement("div"); sec.className = "section";
    if (p.images?.puzzle?.length) sec.appendChild(sectionGrid(p.images.puzzle, memoMap, { cropIndex: 0, memoIndex: 1 }));

    const h1 = p.images?.hint1 || [], h2 = p.images?.hint2 || [], h3 = p.images?.hint3 || [];
    if (h1.length || h2.length || h3.length) {
      const row = document.createElement("div"); row.className = "hintsRow";
      const { d: h1d, inner: h1i } = subDetails("Hint 1", "hint1"); h1i.appendChild(h1.length ? sectionGrid(h1, memoMap) : Object.assign(document.createElement("div"), {className:"textline", textContent:"(no images)"}));
      const { d: h2d, inner: h2i } = subDetails("Hint 2", "hint2"); h2i.appendChild(h2.length ? sectionGrid(h2, memoMap) : Object.assign(document.createElement("div"), {className:"textline", textContent:"(no images)"}));
      const { d: h3d, inner: h3i } = subDetails("Hint 3", "hint3"); h3i.appendChild(h3.length ? sectionGrid(h3, memoMap) : Object.assign(document.createElement("div"), {className:"textline", textContent:"(no images)"}));
      h2d.classList.add("locked"); h3d.classList.add("locked");
      h1d.addEventListener("toggle", () => { if (h1d.open) h2d.classList.remove("locked"); });
      h2d.addEventListener("toggle", () => { if (h2d.open) h3d.classList.remove("locked"); });
      row.appendChild(h1d); row.appendChild(h2d); row.appendChild(h3d); sec.appendChild(row);
    }

    if (p.images?.solution?.length || p.solution_text) {
      const { d: sd, inner: si } = subDetails("Solution", "solution", !!openSol);
      if (p.solution_text) si.appendChild(Object.assign(document.createElement("div"), {className:"textline", textContent: p.solution_text}));
      if (p.images?.solution?.length) si.appendChild(sectionGrid(p.images.solution, memoMap, { cropIndex: 1 }));
      sec.appendChild(sd);
    }
    d.appendChild(sec); els.list.appendChild(d);
  });
}

/* ---------- Setup/Execution Loop ---------- */
async function main() {
  installThemeToggle();
  if (els.status) els.status.style.display = "none";

  // ✅ CRITICAL BUGFIX: This ensures the app looks at your data folder, matching the dynamic layout attributes
  const BASE = new URL(".", window.location.href).href;
  const jsonPath = document.body.getAttribute("data-json-file") || "data/curious-village.json";
  const impPath = document.body.getAttribute("data-impossible-file") || "data/curious-village-impossible.json";

  const solvedMap = loadSolved();
  const memoMap = memoLoadAll(MEMO_KEY);

  let puzzles = [];
  try {
    const res = await fetch(BASE + jsonPath, { cache: "no-store" });
    const data = await res.json();
    puzzles = data.puzzles || [];
  } catch (e) {
    console.error("Failed loading layout data configuration:", e);
    if(els.list) els.list.innerHTML = `<div class="status">Error context: Unable to load ${jsonPath}. Verify file locations.</div>`;
    return;
  }

  let impMap = {};
  try {
    const res = await fetch(BASE + impPath, { cache: "no-store" });
    const raw = await res.json();
    Object.entries(raw || {}).forEach(([k, v]) => { if (Number.isFinite(Number(k))) impMap[Number(k)] = String(v); });
  } catch {}

  const state = { page: 1, totalPages: 1, filtered: [], renderPage: null };
  state.renderPage = () => {
    const q = (els.q?.value || "").toLowerCase().trim();
    state.filtered = puzzles.filter(p => !q || `#${pad3(p.id)} ${sanitizeTitle(p.title, p.id)} ${p.solution_text || ""}`.toLowerCase().includes(q));
    state.totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    
    const start = (state.page - 1) * PAGE_SIZE;
    renderList(state.filtered.slice(start, start + PAGE_SIZE), impMap, solvedMap, memoMap);
    buildPager(els.pagerBottom, state);
  };

  els.q?.addEventListener("input", () => { state.page = 1; state.renderPage(); });
  els.toggleAllSolutions?.addEventListener("change", () => state.renderPage());
  state.renderPage();
}

main();
