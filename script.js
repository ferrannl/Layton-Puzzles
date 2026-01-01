const $ = (sel) => document.querySelector(sel);

function pad3(n) {
  return String(n).padStart(3, "0");
}

function makeImg(src) {
  const img = document.createElement("img");
  img.className = "pimg";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.src = src;
  return img;
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
    p.reward_text || "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function renderList(puzzles) {
  const list = $("#list");
  list.innerHTML = "";

  const openSol = $("#toggleAllSolutions")?.checked;
  const openHints = $("#toggleAllHints")?.checked;

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

    const a = document.createElement("a");
    a.href = p.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Source";

    meta.appendChild(count);
    meta.appendChild(a);

    s.appendChild(badge);
    s.appendChild(title);
    s.appendChild(meta);

    const section = document.createElement("div");
    section.className = "section";

    if (p.images?.scene?.length) {
      const h = document.createElement("h3");
      h.textContent = "Scene";
      section.appendChild(h);
      section.appendChild(sectionGrid(p.images.scene));
    }

    const puzzleImgs = p.images?.puzzle || [];
    if (puzzleImgs.length) {
      const h = document.createElement("h3");
      h.textContent = "Puzzle";
      section.appendChild(h);
      section.appendChild(sectionGrid(puzzleImgs));
    }

    // Hints (grouped)
    const hasHints =
      (p.images?.hint1?.length || 0) +
        (p.images?.hint2?.length || 0) +
        (p.images?.hint3?.length || 0) >
      0;

    if (hasHints) {
      const { d: hd, inner } = subDetails("Hints", !!openHints);

      if (p.images?.hint1?.length) {
        const h = document.createElement("h3");
        h.textContent = "Hint 1";
        inner.appendChild(h);
        inner.appendChild(sectionGrid(p.images.hint1));
      }
      if (p.images?.hint2?.length) {
        const h = document.createElement("h3");
        h.textContent = "Hint 2";
        inner.appendChild(h);
        inner.appendChild(sectionGrid(p.images.hint2));
      }
      if (p.images?.hint3?.length) {
        const h = document.createElement("h3");
        h.textContent = "Hint 3";
        inner.appendChild(h);
        inner.appendChild(sectionGrid(p.images.hint3));
      }

      section.appendChild(hd);
    }

    // Solution
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

    // Progress / reward
    const progImgs = p.images?.progress || [];
    if (progImgs.length || p.reward_text) {
      const { d: pd, inner } = subDetails("Progress / Reward", false);

      if (p.reward_text) {
        const t = document.createElement("div");
        t.className = "textline";
        t.textContent = p.reward_text;
        inner.appendChild(t);
      }
      if (progImgs.length) inner.appendChild(sectionGrid(progImgs));

      section.appendChild(pd);
    }

    d.appendChild(s);
    d.appendChild(section);
    list.appendChild(d);
  }
}

async function main() {
  const status = $("#status");
  status.textContent = "Loading puzzles.json…";

  // Robust base path for GitHub Pages project sites:
  const BASE = new URL(".", window.location.href).href;
  const jsonUrl = BASE + "puzzles.json";

  let data;
  try {
    const res = await fetch(jsonUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${jsonUrl}`);
    data = await res.json();
  } catch (e) {
    status.textContent =
      "Failed to load puzzles.json. Check that puzzles.json exists in the repo root and is deployed by GitHub Pages.";
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
  $("#toggleAllHints")?.addEventListener("change", rerender);

  rerender();
}

main();
