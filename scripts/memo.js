/* ---------- Memo Drawing Module ---------- */

export function memoLoadAll(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : {};
  } catch {
    return {};
  }
}

export function memoSaveAll(key, map) {
  try { localStorage.setItem(key, JSON.stringify(map)); } catch {}
}

function setActiveTool(btns, tool) {
  btns.forEach(b => b.classList.toggle("active", b.dataset.tool === tool));
}

function fitCanvasToBox(canvas, box, keepImageDataURL) {
  let snapshot = null;
  if (keepImageDataURL) {
    try { snapshot = canvas.toDataURL("image/png"); } catch {}
  }

  const w = Math.max(1, Math.round(box.clientWidth));
  const h = Math.max(1, Math.round(box.clientHeight));

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

export function installMemoOnThumb(thumbEl, imgEl, src, memoMap, memoKey) {
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

  const resizeNow = (keep) => fitCanvasToBox(canvas, imgEl, keep);

  if (imgEl.complete) resizeNow(false);
  else imgEl.addEventListener("load", () => resizeNow(false), { once: true });

  const key = String(src || "");
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

  let tool = null;

  const applyToolUI = () => {
    setActiveTool([btnPen, btnErase], tool);
    if (!tool) {
      canvas.style.pointerEvents = "none";
      canvas.style.touchAction = "auto";
      canvas.style.cursor = "default";
    } else {
      canvas.style.pointerEvents = "auto";
      canvas.style.touchAction = "none";
      canvas.style.cursor = "crosshair";
    }
  };

  const toggleTool = (which) => {
    tool = (tool === which) ? null : which;
    applyToolUI();
  };

  btnPen.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleTool("pen"); });
  btnErase.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleTool("eraser"); });
  btnClear.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!tool) return;
    if (!confirm("Clear drawing on this image?")) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    delete memoMap[key];
    memoSaveAll(memoKey, memoMap);
  });

  applyToolUI();

  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let drawing = false;
  let lastX = 0, lastY = 0;

  const getPos = (evt) => {
    const r = canvas.getBoundingClientRect();
    const t = (evt.touches && evt.touches[0]) ? evt.touches[0] : evt;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };

  const start = (evt) => {
    if (!tool || (evt.target && evt.target.closest(".memoTools"))) return;
    drawing = true;
    const p = getPos(evt);
    lastX = p.x; lastY = p.y;
    evt.preventDefault();
  };

  const move = (evt) => {
    if (!drawing || !tool) return;
    const p = getPos(evt);
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 22;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
    }
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
    lastX = p.x; lastY = p.y;
    evt.preventDefault();
  };

  const end = () => {
    if (!drawing) return;
    drawing = false;
    try {
      memoMap[key] = canvas.toDataURL("image/png");
      memoSaveAll(memoKey, memoMap);
    } catch {}
  };

  canvas.addEventListener("mousedown", start);
  window.addEventListener("mousemove", move, { passive: false });
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);

  window.addEventListener("resize", () => resizeNow(true), { passive: true });
}
