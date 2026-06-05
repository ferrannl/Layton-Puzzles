/* ---------- Interactive Pager Module ---------- */

const PAGE_SIZE = 5;
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

function updateProgress(container, page, total) {
  const trackEl = container.querySelector(".pagerTrack");
  const pillEl = container.querySelector(".pagerPill");
  const labelEl = container.querySelector(".pagerLabel");
  if (!trackEl || !pillEl || !labelEl) return;

  labelEl.textContent = `Page ${page} / ${total} • ${PAGE_SIZE} per page`;
  const frac = total <= 1 ? 0 : (page - 1) / (total - 1);

  requestAnimationFrame(() => {
    const maxX = Math.max(0, trackEl.clientWidth - pillEl.clientWidth);
    pillEl.style.transform = `translateX(${Math.round(maxX * frac)}px)`;
  });
}

export function buildPager(container, state) {
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

  row1.appendChild(prev); row1.appendChild(rand); row1.appendChild(next);

  const row2 = document.createElement("div");
  row2.className = "pagerNums";

  row2.appendChild(mkNumBtn(1, state.page === 1));
  const windowSize = 2;
  const start = clamp(state.page - windowSize, 1, state.totalPages);
  const end   = clamp(state.page + windowSize, 1, state.totalPages);

  if (start > 2) {
    row2.appendChild(Object.assign(document.createElement("span"), {className:"pnumDots", textContent:"…"}));
  }
  for (let p = Math.max(2, start); p <= Math.min(state.totalPages - 1, end); p++) {
    row2.appendChild(mkNumBtn(p, p === state.page));
  }
  if (end < state.totalPages - 1) {
    row2.appendChild(Object.assign(document.createElement("span"), {className:"pnumDots", textContent:"…"}));
  }
  if (state.totalPages > 1) row2.appendChild(mkNumBtn(state.totalPages, state.page === state.totalPages));

  const row3 = document.createElement("div");
  row3.className = "pagerProgress";
  row3.innerHTML = `<div class="pagerTrack" aria-hidden="true"><div class="pagerPill"></div></div><div class="pagerLabel"></div>`;

  container.appendChild(row1); container.appendChild(row2); container.appendChild(row3);
  updateProgress(container, state.page, state.totalPages);

  prev.addEventListener("click", () => { if (state.page > 1) { state.page--; state.renderPage(); scrollToTop(); } });
  next.addEventListener("click", () => { if (state.page < state.totalPages) { state.page++; state.renderPage(); scrollToTop(); } });
  
  rand.addEventListener("click", () => {
    if (!state.filtered.length) return;
    const pick = state.filtered[Math.floor(Math.random() * state.filtered.length)];
    const idx = state.filtered.findIndex(p => p.id === pick.id);
    state.page = clamp(Math.floor(idx / PAGE_SIZE) + 1, 1, state.totalPages);
    state.renderPage();
    jumpToPuzzle(pick.id);
  });

  container.querySelectorAll("button[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.page = Number(btn.dataset.page);
      state.renderPage();
      scrollToTop();
    });
  });

  window.addEventListener("resize", () => updateProgress(container, state.page, state.totalPages), { passive: true });
}
