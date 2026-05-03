(() => {
  "use strict";

  if (window.location.pathname.endsWith("/index.html")) {
    const normalizedPath = window.location.pathname.replace(/index\.html$/, "");
    const targetPath = normalizedPath || "/";
    window.history.replaceState({}, "", `${targetPath}${window.location.search}${window.location.hash}`);
  }

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const canvas = document.getElementById("fern-canvas");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    start: performance.now(),
    pointer: null,
    rachis: [],
    branches: []
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    state.width = Math.max(1, Math.floor(rect.width));
    state.height = Math.max(1, Math.floor(rect.height));
    state.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    buildMotif();
  };

  const buildMotif = () => {
    const w = state.width;
    const h = state.height;
    const baseX = w * 0.2;
    const baseY = h * 0.78;
    const topX = w * 0.66;
    const topY = h * 0.2;
    const curlCx = w * 0.63;
    const curlCy = h * 0.29;
    const curlR = Math.min(w, h) * 0.17;
    state.rachis = [];
    state.branches = [];

    for (let i = 0; i <= 120; i += 1) {
      const t = i / 120;
      const curve = Math.sin(t * Math.PI);
      const x = lerp(baseX, topX, t) - curve * w * 0.08;
      const y = lerp(baseY, topY, t) + curve * h * 0.07;
      state.rachis.push({ x, y, t });
    }

    for (let i = 0; i < 56; i += 1) {
      const t = i / 55;
      const angle = 0.35 + t * Math.PI * 1.75;
      const r = curlR * (1 - t * 0.72);
      state.rachis.push({
        x: curlCx + Math.cos(angle) * r,
        y: curlCy + Math.sin(angle) * r,
        t: 1 + t * 0.38
      });
    }

    const attachPoints = [0.18, 0.25, 0.32, 0.39, 0.46, 0.53, 0.6, 0.67, 0.74, 0.81];
    attachPoints.forEach((t, index) => {
      const rootIndex = Math.floor(t * 118);
      const root = state.rachis[rootIndex];
      const side = index % 2 === 0 ? -1 : 1;
      const reach = (0.2 + (1 - Math.abs(t - 0.5)) * 0.25) * w;
      const rise = (0.12 + t * 0.18) * h;
      const end = {
        x: root.x + side * reach,
        y: root.y - rise * (0.55 + Math.random() * 0.2)
      };
      const mid = {
        x: root.x + side * reach * 0.42,
        y: root.y - rise * 0.28
      };
      const children = [0.5, 0.72].map((branchT, childIndex) => {
        const childRoot = {
          x: lerp(root.x, end.x, branchT),
          y: lerp(root.y, end.y, branchT)
        };
        const childSide = childIndex === 0 ? side : -side * 0.35;
        return {
          root: childRoot,
          end: {
            x: childRoot.x + childSide * reach * (0.25 + childIndex * 0.05),
            y: childRoot.y - rise * (0.12 + childIndex * 0.05)
          },
          phase: index * 0.9 + childIndex
        };
      });

      state.branches.push({ root, mid, end, children, phase: index * 0.7, t });
    });
  };

  const pointWithMotion = (point, phase, amount, timestamp) => {
    const ambient = prefersReducedMotion ? 0 : Math.sin(timestamp / 2400 + phase) * amount;
    let pointerShiftX = 0;
    let pointerShiftY = 0;
    if (state.pointer) {
      const dx = point.x - state.pointer.x;
      const dy = point.y - state.pointer.y;
      const dist = Math.hypot(dx, dy);
      const influence = clamp(1 - dist / 150, 0, 1);
      pointerShiftX = (dx / Math.max(dist, 1)) * influence * 8;
      pointerShiftY = (dy / Math.max(dist, 1)) * influence * 5;
    }
    return {
      x: point.x + ambient + pointerShiftX,
      y: point.y + Math.sin(timestamp / 3100 + phase) * amount * 0.35 + pointerShiftY
    };
  };

  const drawPathSegment = (points, progress) => {
    const count = Math.floor(points.length * clamp(progress, 0, 1));
    if (count < 2) {
      return;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < count; i += 1) {
      const previous = points[i - 1];
      const current = points[i];
      ctx.quadraticCurveTo(previous.x, previous.y, (previous.x + current.x) / 2, (previous.y + current.y) / 2);
    }
    ctx.stroke();
  };

  const drawBranch = (branch, progress, timestamp) => {
    const localProgress = clamp((progress - branch.t * 0.55) / 0.32, 0, 1);
    if (localProgress <= 0) {
      return;
    }
    const root = branch.root;
    const mid = pointWithMotion(branch.mid, branch.phase, 4, timestamp);
    const end = pointWithMotion(branch.end, branch.phase + 1.2, 6, timestamp);

    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    const partialEnd = {
      x: lerp(root.x, end.x, localProgress),
      y: lerp(root.y, end.y, localProgress)
    };
    ctx.quadraticCurveTo(mid.x, mid.y, partialEnd.x, partialEnd.y);
    ctx.stroke();

    if (localProgress > 0.62) {
      branch.children.forEach((child) => {
        const childProgress = clamp((localProgress - 0.62) / 0.38, 0, 1);
        const childEnd = pointWithMotion(child.end, child.phase, 4, timestamp);
        ctx.beginPath();
        ctx.moveTo(child.root.x, child.root.y);
        ctx.lineTo(lerp(child.root.x, childEnd.x, childProgress), lerp(child.root.y, childEnd.y, childProgress));
        ctx.stroke();
      });
    }

    if (localProgress > 0.92) {
      const pulse = prefersReducedMotion ? 0.55 : 0.55 + Math.sin(timestamp / 1300 + branch.phase) * 0.18;
      ctx.globalAlpha = clamp(pulse, 0.25, 0.85);
      ctx.beginPath();
      ctx.arc(end.x, end.y, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  };

  const draw = (timestamp) => {
    const elapsed = timestamp - state.start;
    const progress = prefersReducedMotion ? 1 : clamp(elapsed / 3200, 0, 1);

    ctx.clearRect(0, 0, state.width, state.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#2f4a35";
    ctx.fillStyle = "#2f4a35";
    ctx.lineWidth = 2.1;

    drawPathSegment(state.rachis, progress);

    ctx.lineWidth = 1.45;
    state.branches.forEach((branch) => drawBranch(branch, progress, timestamp));

    if (!prefersReducedMotion) {
      requestAnimationFrame(draw);
    }
  };

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    state.pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  });

  canvas.addEventListener("pointerleave", () => {
    state.pointer = null;
  });

  window.addEventListener("resize", resize, { passive: true });
  resize();
  requestAnimationFrame(draw);
})();
