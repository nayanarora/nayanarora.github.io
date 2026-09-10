import { World } from "./scene.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function bootLoader() {
  const loader = $(".loader");
  const hide = () => loader?.classList.add("is-done");
  if (document.readyState === "complete") setTimeout(hide, 280);
  else window.addEventListener("load", () => setTimeout(hide, 280));
  setTimeout(hide, 1800);
}

function nav() {
  const toggle = $(".hud__menu");
  toggle?.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", document.body.classList.contains("nav-open"));
  });
  $$(".hud nav a").forEach((a) =>
    a.addEventListener("click", () => document.body.classList.remove("nav-open"))
  );
}

function smooth() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const LenisCtor = window.Lenis;
  if (!LenisCtor) return null;
  const lenis = new LenisCtor({ duration: 1.05, smoothWheel: true, wheelMultiplier: 0.92 });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  if (window.ScrollTrigger) lenis.on("scroll", ScrollTrigger.update);
  return lenis;
}

function world() {
  const canvas = $("#stage");
  if (!canvas) return null;
  try {
    const w = new World(canvas);
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      w.setProgress(max > 0 ? window.scrollY / max : 0);
    };
    if (window.ScrollTrigger) {
      ScrollTrigger.create({ start: 0, end: "max", onUpdate: update });
    } else {
      window.addEventListener("scroll", update, { passive: true });
    }
    update();
    return w;
  } catch (err) {
    console.warn("WebGL scene unavailable", err);
    canvas.remove();
    return null;
  }
}

bootLoader();
nav();
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  smooth();
  world();
} else {
  world();
}
