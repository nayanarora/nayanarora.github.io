import { World } from "./scene.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function world() {
  const canvas = $("#stage");
  if (!canvas) return null;
  try {
    const w = new World(canvas);
    const update = () => {
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

  const close = () => {
    if (dialog.open) dialog.close();
    else dialog.removeAttribute("open");
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
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (scene) scene.quiet = true;
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
