import { World } from "./scene.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function bootLoader() {
  const loader = $(".loader");
  const hide = () => loader?.classList.add("is-done");
  if (document.readyState === "complete") setTimeout(hide, 420);
  else window.addEventListener("load", () => setTimeout(hide, 420));
  setTimeout(hide, 2400);
}

function nav() {
  const toggle = $(".nav__toggle");
  const links = $$(".nav__links a");
  toggle?.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", document.body.classList.contains("nav-open"));
  });
  links.forEach((a) =>
    a.addEventListener("click", () => document.body.classList.remove("nav-open"))
  );
}

function smooth() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const LenisCtor = window.Lenis;
  if (!LenisCtor) return null;
  const lenis = new LenisCtor({
    duration: 1.15,
    smoothWheel: true,
    wheelMultiplier: 0.9
  });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on("scroll", ScrollTrigger.update);
  return lenis;
}

function progressBar() {
  const bar = $(".progress");
  if (!bar) return;
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      bar.style.width = `${self.progress * 100}%`;
    }
  });
}

function reveals() {
  $$("[data-reveal]").forEach((el) => {
    gsap.fromTo(
      el,
      { y: 36, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 86%",
          once: true
        }
      }
    );
  });
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
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: update
      });
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
  progressBar();
  reveals();
  world();
} else {
  world();
}
