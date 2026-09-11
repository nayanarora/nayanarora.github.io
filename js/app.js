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
    $(".sheet .sheet__close")?.focus();
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

function hashScroll() {
  const raw = location.hash.replace("#", "");
  if (!raw || raw.startsWith("d-")) return;
  const el = document.getElementById(raw);
  el?.scrollIntoView({ behavior: "smooth" });
}

const scene = world();
appear();
sheets(scene);
window.addEventListener("load", hashScroll);
window.addEventListener("hashchange", hashScroll);
