import { World } from "./scene.js?v=neural3";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const SHEET_SECTION = {
  bcc: "work",
  spatial: "work",
  governed: "work",
  exemplary: "work",
  drones: "work",
  nus: "work",
  cubesat: "work",
  serra: "notes",
  apsrc: "notes"
};

function world() {
  const canvas = $("#stage");
  if (!canvas) return null;
  try {
    return new World(canvas);
  } catch (err) {
    console.warn("WebGL scene unavailable", err);
    canvas.remove();
    return null;
  }
}

function appear() {
  const tiles = $$(".tile");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!("IntersectionObserver" in window) || reduced) {
    tiles.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const tileIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-in", entry.isIntersecting);
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -6% 0px" }
  );
  tiles.forEach((el) => tileIo.observe(el));
}

function scrollableAncestor(node, limit) {
  let el = node instanceof Element ? node : node?.parentElement;
  while (el && el !== limit && el !== document.body) {
    const style = window.getComputedStyle(el);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function absorbs(node, dy, limit) {
  const box = scrollableAncestor(node, limit);
  if (!box) return false;
  if (dy > 0 && box.scrollTop + box.clientHeight < box.scrollHeight - 1) return true;
  if (dy < 0 && box.scrollTop > 1) return true;
  return false;
}

function sheets(scene, pager) {
  const dialog = $("#sheet");
  const body = $("#sheet-body");
  if (!dialog || !body) return;

  const overflows = () => body.scrollHeight > body.clientHeight + 1;

  const lockPage = () => {
    document.documentElement.classList.add("is-locked");
  };

  const unlockPage = () => {
    document.documentElement.classList.remove("is-locked");
  };

  const blockIfNeeded = (event, deltaY) => {
    if (!dialog.open) return;
    if (!dialog.contains(event.target) || !overflows()) {
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
      blockIfNeeded(event, event.deltaY);
    },
    { passive: false }
  );

  let touchY = 0;
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
      blockIfNeeded(event, touchY - y);
    },
    { passive: false }
  );

  const close = () => {
    if (dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    unlockPage();
    if (scene) scene.quiet = false;
    const section = pager?.id() || "";
    if (section) history.replaceState(null, "", `#${section}`);
    else history.replaceState(null, "", location.pathname);
  };

  const open = (id) => {
    const src = document.getElementById(`detail-${id}`);
    if (!src) return;
    const home = SHEET_SECTION[id];
    if (home && pager) pager.go(home, { instant: true, hash: false });
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

  return { open, close };
}

function modules(scene) {
  const track = $("#track");
  const panels = $$(".panel");
  const dots = $$(".rail [data-go]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!track || panels.length < 2) return null;

  let index = Math.max(0, panels.findIndex((p) => p.classList.contains("is-on")));
  let busy = false;
  let cool = 0;
  let clearBusy = 0;

  const locked = () => document.documentElement.classList.contains("is-locked");

  const paint = () => {
    track.style.transform = `translate3d(0, ${-index * 100}dvh, 0)`;
    panels.forEach((p, i) => p.classList.toggle("is-on", i === index));
    dots.forEach((dot) => {
      const on = dot.dataset.go === panels[index]?.id;
      dot.setAttribute("aria-current", on ? "true" : "false");
    });
    if (scene && panels.length > 1) {
      scene.setProgress(index / (panels.length - 1));
    }
  };

  const go = (target, { instant = false, hash = true } = {}) => {
    if (locked()) return;
    const next = typeof target === "string"
      ? panels.findIndex((p) => p.id === target)
      : target;
    if (next < 0 || next >= panels.length) return;
    if (next === index && !instant) return;

    index = next;
    const snap = reduced || instant;
    busy = !snap;
    track.classList.toggle("is-busy", busy);
    track.style.transition = snap
      ? "none"
      : "transform 0.58s cubic-bezier(0.22, 1, 0.36, 1)";
    paint();
    if (hash && panels[index].id) {
      history.replaceState(null, "", `#${panels[index].id}`);
    }
    window.clearTimeout(clearBusy);
    if (busy) {
      cool = Date.now() + 640;
      clearBusy = window.setTimeout(() => {
        busy = false;
        track.classList.remove("is-busy");
      }, 640);
    } else {
      cool = 0;
    }
  };

  track.addEventListener("transitionend", (event) => {
    if (event.target !== track || event.propertyName !== "transform") return;
    busy = false;
    track.classList.remove("is-busy");
    window.clearTimeout(clearBusy);
  });

  const step = (dir) => {
    if (busy || Date.now() < cool) return;
    go(index + dir);
  };

  if (!reduced) {
    let wheelAcc = 0;
    let wheelAt = 0;
    window.addEventListener(
      "wheel",
      (e) => {
        if (locked()) return;
        if (e.ctrlKey) return;
        if (absorbs(e.target, e.deltaY, track)) {
          wheelAcc = 0;
          return;
        }
        e.preventDefault();
        if (busy || Date.now() < cool) return;
        const now = Date.now();
        if (now - wheelAt > 280) wheelAcc = 0;
        wheelAt = now;
        wheelAcc += e.deltaY;
        if (wheelAcc > 40) {
          wheelAcc = 0;
          step(1);
        } else if (wheelAcc < -40) {
          wheelAcc = 0;
          step(-1);
        }
      },
      { passive: false }
    );

    let startY = 0;
    let startX = 0;
    let tracking = false;
    window.addEventListener(
      "touchstart",
      (e) => {
        startY = e.touches[0]?.clientY ?? 0;
        startX = e.touches[0]?.clientX ?? 0;
        tracking = true;
      },
      { passive: true }
    );
    window.addEventListener(
      "touchmove",
      (e) => {
        if (locked() || !tracking) return;
        const y = e.touches[0]?.clientY ?? 0;
        const x = e.touches[0]?.clientX ?? 0;
        const dy = startY - y;
        const dx = startX - x;
        if (Math.abs(dy) < 12 || Math.abs(dy) < Math.abs(dx)) return;
        if (absorbs(e.target, dy, track)) return;
        e.preventDefault();
      },
      { passive: false }
    );
    window.addEventListener(
      "touchend",
      (e) => {
        if (locked() || !tracking) return;
        tracking = false;
        if (busy || Date.now() < cool) return;
        const y = e.changedTouches[0]?.clientY ?? startY;
        const x = e.changedTouches[0]?.clientX ?? startX;
        const dy = startY - y;
        const dx = startX - x;
        if (Math.abs(dy) < 52 || Math.abs(dy) < Math.abs(dx) * 1.15) return;
        if (absorbs(e.target, dy, track)) return;
        step(dy > 0 ? 1 : -1);
      },
      { passive: true }
    );
  }

  window.addEventListener("keydown", (e) => {
    if (locked()) return;
    const keys = ["PageDown", "PageUp", "ArrowDown", "ArrowUp", " "];
    if (!keys.includes(e.key)) return;
    if (e.key === " " && /^(INPUT|TEXTAREA|BUTTON|A)$/.test(e.target.tagName)) return;
    e.preventDefault();
    step(e.key === "PageUp" || e.key === "ArrowUp" ? -1 : 1);
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => go(dot.dataset.go));
  });

  window.addEventListener("resize", () => {
    const prev = track.style.transition;
    track.style.transition = "none";
    paint();
    requestAnimationFrame(() => {
      track.style.transition = prev;
    });
  });

  paint();
  return {
    go,
    id: () => panels[index]?.id || "",
    index: () => index,
    panels
  };
}

function hashRoute(pager, sheetApi) {
  const raw = location.hash.replace("#", "");
  if (!raw) return;
  if (raw.startsWith("d-")) {
    sheetApi?.open(raw.slice(2));
    return;
  }
  pager?.go(raw, { instant: true });
}

const scene = world();
appear();
const pager = modules(scene);
const sheetApi = sheets(scene, pager);
hashRoute(pager, sheetApi);
window.addEventListener("hashchange", () => hashRoute(pager, sheetApi));
