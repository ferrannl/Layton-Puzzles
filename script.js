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

function matchesQuery(p, q) {
  if (!q) return true;
  q = q.toLowerCase().trim();
  const hay = [
    `#${pad3(p.id)}`,
    p.title || "",
    p.solution_text || "",
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

function renderList(puzzles) {
  const list = $("#list");
  list.innerHTML = "";

  const openSol = $("#toggleAllSolutions")?.checked;
  const autoHint1 = $("#toggleAutoHint1")?.checked;

  for (const p of puzzles) {
    const d = document.createElement("details");
    d.className = "puzzle";

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
      const { d: h1d, inner: h1i } = subDetails("Hint 1", !!autoHint1);
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

      // lock 2 and 3 initially
      h2d.classList.add("locked");
      h3d.classList.add("locked");

      // unlock chain
      const unlock = (det) => det.classList.remove("locked");
      h1d.addEventListener("toggle", () => {
        if (h1d.open) unlock(h2d);
      });
      h2d.addEventListener("toggle", () => {
        if (h2d.open) unlock(h3d);
      });

      // if auto-open hint1, unlock hint2 immediately (still not open)
      if (autoHint1) unlock(h2d);

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

async function main() {
  const status = $("#status");
  status.textContent = "Loading puzzles.json…";

  const BASE = new URL(".", window.location.href).href;
  const jsonUrl = BASE + "puzzles.json";

  let data;
  try {
    const res = await fetch(jsonUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${jsonUrl}`);
    data = await res.json();
  } catch (e) {
    status.textContent =
      "Failed to load puzzles.json. Ensure puzzles.json is in repo root and GitHub Pages is deploying from root.";
    console.error(e);
    return;
  }

  const puzzles = data.puzzles || [];
  status.textContent = `Loaded ${puzzles.length} puzzles.`;

  const q = $("#q");
  const rerender = () => {
    const query = (q?.value || "").trim();
    const filtered = puzzles.filter((p) => matchesQuery(p, query));
    status.textContent = `Showing ${filtered.length} / ${puzzles.length}`;
    renderList(filtered);
  };

  q?.addEventListener("input", rerender);
  $("#toggleAllSolutions")?.addEventListener("change", rerender);
  $("#toggleAutoHint1")?.addEventListener("change", rerender);

  rerender();
}

main();
