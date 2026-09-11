import { World } from "./scene.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function world() {
  const canvas = $("#stage");
  if (!canvas) return null;
  try {
    const w = new World(canvas);
    const update = () => {
      if (document.documentElement.classList.contains("is-locked")) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      w.setProgress(max > 0 ? window.scrollY / max : 0);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return w;
  } catch (err) {
    console.warn("WebGL scene unavailable", err);
    canvas.remove();
    return null;
  }
}

function appear() {
  const tiles = $$(".tile");
  const panels = $$(".panel");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!("IntersectionObserver" in window) || reduced) {
    tiles.forEach((el) => el.classList.add("is-in"));
    panels.forEach((el) => el.classList.add("is-on"));
    return;
  }

  const tileIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-in", entry.isIntersecting);
      });
    },
    { threshold: 0.28, rootMargin: "0px 0px -8% 0px" }
  );
  tiles.forEach((el) => tileIo.observe(el));

  const pickPanel = () => {
    const vh = window.innerHeight;
    let best = null;
    let bestR = 0;
    panels.forEach((p) => {
      const r = p.getBoundingClientRect();
      const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      const ratio = Math.max(0, visible) / vh;
      if (ratio > bestR) {
        bestR = ratio;
        best = p;
      }
    });
    panels.forEach((p) => p.classList.toggle("is-on", p === best));
  };

  const panelIo = new IntersectionObserver(pickPanel, {
    threshold: [0, 0.25, 0.5, 0.75, 1]
  });
  panels.forEach((el) => panelIo.observe(el));
  pickPanel();
}

function sheets(scene) {
  const dialog = $("#sheet");
  const body = $("#sheet-body");
  if (!dialog || !body) return;

  let lockedY = 0;
  let touchY = 0;

  const lockPage = () => {
    if (document.documentElement.classList.contains("is-locked")) return;
    lockedY = window.scrollY;
    document.documentElement.classList.add("is-locked");
    document.body.style.top = `-${lockedY}px`;
  };

  const unlockPage = () => {
    if (!document.documentElement.classList.contains("is-locked")) return;
    document.documentElement.classList.remove("is-locked");
    document.body.style.top = "";
    window.scrollTo(0, lockedY);
  };

  const overflows = () => body.scrollHeight > body.clientHeight + 1;

  const blockIfNeeded = (event, deltaY) => {
    if (!dialog.open) return;
    if (!overflows()) {
      event.preventDefault();
      return;
    }
    const atTop = body.scrollTop <= 0 && deltaY < 0;
    const atBottom =
      body.scrollTop + body.clientHeight >= body.scrollHeight - 1 && deltaY > 0;
    if (atTop || atBottom) event.preventDefault();
  };

  document.addEventListener(
    "wheel",
    (event) => {
      if (!dialog.open) return;
      if (!dialog.contains(event.target) || !overflows()) {
        event.preventDefault();
        return;
      }
      blockIfNeeded(event, event.deltaY);
    },
    { passive: false }
  );

  document.addEventListener(
    "touchstart",
    (event) => {
      touchY = event.touches[0]?.clientY ?? 0;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      if (!dialog.open) return;
      const y = event.touches[0]?.clientY ?? 0;
      const deltaY = touchY - y;
      if (!dialog.contains(event.target) || !overflows()) {
        event.preventDefault();
        return;
      }
      blockIfNeeded(event, deltaY);
    },
    { passive: false }
  );

  const close = () => {
    if (dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    unlockPage();
    if (scene) scene.quiet = false;
    const section = location.hash && !location.hash.startsWith("#d-")
      ? location.hash
      : "";
    if (section) history.replaceState(null, "", section);
    else history.replaceState(null, "", location.pathname);
  };

  const open = (id) => {
    const src = document.getElementById(`detail-${id}`);
    if (!src) return;
    body.replaceChildren(src.content.cloneNode(true));
    if (scene) scene.quiet = true;
    lockPage();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    body.scrollTop = 0;
    history.replaceState(null, "", `#d-${id}`);
    dialog.querySelector(".sheet__close")?.focus({ preventScroll: true });
  };

  $$("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => open(btn.dataset.open));
  });

  dialog.querySelector(".sheet__close")?.addEventListener("click", close);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });

  const bootHash = location.hash.replace("#", "");
  if (bootHash.startsWith("d-")) open(bootHash.slice(2));
}

function modules() {
  const panels = $$(".panel");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (panels.length < 2) return;

  const current = () => {
    const vh = window.innerHeight;
    let best = 0;
    let bestR = -1;
    panels.forEach((p, i) => {
      const r = p.getBoundingClientRect();
      const vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (vis > bestR) {
        bestR = vis;
        best = i;
      }
    });
    return best;
  };

  let busy = false;

  const go = (i, smooth = true) => {
    if (document.documentElement.classList.contains("is-locked")) return;
    const next = Math.max(0, Math.min(panels.length - 1, i));
    const panel = panels[next];
    if (!panel) return;
    busy = true;
    panel.scrollIntoView({ behavior: reduced || !smooth ? "auto" : "smooth", block: "start" });
    if (panel.id) history.replaceState(null, "", `#${panel.id}`);
    window.setTimeout(() => {
      busy = false;
    }, 720);
  };

  if (!reduced) {
    let wheelAcc = 0;
    let wheelAt = 0;
    window.addEventListener(
      "wheel",
      (e) => {
        if (document.documentElement.classList.contains("is-locked")) return;
        if (e.ctrlKey) return;
        e.preventDefault();
        const now = Date.now();
        if (now - wheelAt > 420) wheelAcc = 0;
        wheelAt = now;
        wheelAcc += e.deltaY;
        if (busy) return;
        if (wheelAcc > 36) {
          go(current() + 1);
          wheelAcc = 0;
        } else if (wheelAcc < -36) {
          go(current() - 1);
          wheelAcc = 0;
        }
      },
      { passive: false }
    );

    let startY = 0;
    window.addEventListener(
      "touchstart",
      (e) => {
        startY = e.touches[0]?.clientY ?? 0;
      },
      { passive: true }
    );
    window.addEventListener(
      "touchmove",
      (e) => {
        if (document.documentElement.classList.contains("is-locked")) return;
        const y = e.touches[0]?.clientY ?? 0;
        if (Math.abs(startY - y) < 10) return;
        e.preventDefault();
      },
      { passive: false }
    );
    window.addEventListener(
      "touchend",
      (e) => {
        if (document.documentElement.classList.contains("is-locked")) return;
        if (busy) return;
        const y = e.changedTouches[0]?.clientY ?? startY;
        const dy = startY - y;
        if (Math.abs(dy) < 48) return;
        go(current() + (dy > 0 ? 1 : -1));
      },
      { passive: true }
    );
  }

  window.addEventListener("keydown", (e) => {
    if (document.documentElement.classList.contains("is-locked")) return;
    const keys = ["PageDown", "PageUp", "ArrowDown", "ArrowUp", " "];
    if (!keys.includes(e.key)) return;
    if (e.key === " " && /^(INPUT|TEXTAREA|BUTTON|A)$/.test(e.target.tagName)) return;
    e.preventDefault();
    go(current() + (e.key === "PageUp" || e.key === "ArrowUp" ? -1 : 1));
  });

  return { go, current, panels };
}

function hashScroll(pager) {
  const raw = location.hash.replace("#", "");
  if (!raw || raw.startsWith("d-")) return;
  const el = document.getElementById(raw);
  if (!el) return;
  if (pager) {
    const i = pager.panels.indexOf(el);
    if (i >= 0) pager.go(i, false);
    else el.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

const scene = world();
appear();
sheets(scene);
const pager = modules();
window.addEventListener("load", () => hashScroll(pager));
window.addEventListener("hashchange", () => hashScroll(pager));
