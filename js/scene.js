import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const LINE = new THREE.Color("#2f6f93");
const NODE = new THREE.Color("#4aa3c7");
const ORANGE = new THREE.Color("#c56a2c");

function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function ellipsoid(u, v, rx, ry, rz) {
  const theta = u * Math.PI * 2;
  const phi = Math.acos(2 * v - 1);
  return [
    rx * Math.sin(phi) * Math.cos(theta),
    ry * Math.cos(phi),
    rz * Math.sin(phi) * Math.sin(theta)
  ];
}

function brainTracts(count) {
  const pts = new Float32Array(count * 3);
  const fibers = 56;
  const per = Math.floor(count / fibers);
  let n = 0;
  for (let f = 0; f < fibers; f++) {
    const a = ellipsoid(hash(f), hash(f + 19), 2.35, 1.55, 1.9);
    const c = ellipsoid(hash(f + 7), hash(f + 29), 2.35, 1.55, 1.9);
    const hx = (hash(f + 3) - 0.5) * 0.55;
    const hy = (hash(f + 5) - 0.5) * 0.35;
    const hz = (hash(f + 11) - 0.5) * 0.45;
    for (let i = 0; i < per && n < count; i++) {
      const t = i / Math.max(per - 1, 1);
      const mt = 1 - t;
      const wob = Math.sin(t * 14 + f) * 0.07;
      pts[n * 3] = mt * mt * a[0] + 2 * mt * t * hx + t * t * c[0] + wob * (hash(n) - 0.5);
      pts[n * 3 + 1] = mt * mt * a[1] + 2 * mt * t * hy + t * t * c[1] + wob * (hash(n + 1) - 0.5);
      pts[n * 3 + 2] = mt * mt * a[2] + 2 * mt * t * hz + t * t * c[2] + wob * (hash(n + 2) - 0.5);
      n += 1;
    }
  }
  while (n < count) {
    pts[n * 3] = (hash(n) - 0.5) * 7;
    pts[n * 3 + 1] = (hash(n + 4) - 0.5) * 5;
    pts[n * 3 + 2] = (hash(n + 8) - 0.5) * 6;
    n += 1;
  }
  return pts;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.mobile = window.matchMedia("(max-width: 900px)").matches;
    this.quiet = false;
    this.count = this.mobile ? 1100 : 2400;
    this.pointer = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this._init();
  }

  _init() {
    const { canvas, count } = this;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.2 : 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 80);
    this.camera.position.set(0.2, 0.06, 5.85);

    this.group = new THREE.Group();
    this.group.position.set(0.7, 0.04, 0);
    this.scene.add(this.group);

    const pts = brainTracts(count);
    this.current = pts;

    this.neuronCount = this.mobile ? 16 : 24;
    const soma = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.62
    });
    this.neurons = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.038, 8, 8),
      soma,
      this.neuronCount
    );
    this.neurons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.neurons);
    this._dummy = new THREE.Object3D();
    this._placeNeurons();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const sizes = new Float32Array(count);
    const accents = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      sizes[i] = hash(i) * 0.55 + 0.22;
      accents[i] = hash(i + 21) < 0.7 ? 1 : 0;
    }
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aAccent", new THREE.BufferAttribute(accents, 1));

    this.pointsMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: NODE.clone() },
        uAccent: { value: ORANGE.clone() },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAccent;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vAccent;
        void main() {
          vec3 p = position;
          p += 0.012 * vec3(
            sin(uTime * 0.22 + position.y * 1.1),
            sin(uTime * 0.16 + position.x * 0.9),
            cos(uTime * 0.18 + position.z * 0.8)
          );
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (32.0 / -mv.z);
          vAlpha = clamp(1.15 / length(mv.xyz), 0.1, 0.42);
          vAccent = aAccent;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uAccent;
        varying float vAlpha;
        varying float vAccent;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float matte = smoothstep(0.5, 0.2, d);
          vec3 col = mix(uColor, uAccent, vAccent);
          gl_FragColor = vec4(col, matte * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.pointsMat);
    this.group.add(this.points);

    const lineCount = this.mobile ? 220 : 420;
    this.lineCount = lineCount;
    this.linePos = new Float32Array(lineCount * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(this.linePos, 3));
    this.lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: LINE,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      })
    );
    this.group.add(this.lines);
    this._lines();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.04,
      0.5,
      0.8
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    window.addEventListener("resize", () => this.resize());
    window.addEventListener("pointermove", (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    });

    this._running = true;
    document.addEventListener("visibilitychange", () => {
      this._running = document.visibilityState === "visible";
    });

    this.tick();
  }

  setProgress() {}

  _placeNeurons() {
    const src = this.current;
    const step = Math.max(1, Math.floor(this.count / this.neuronCount));
    const teal = NODE;
    const orange = ORANGE;
    for (let i = 0; i < this.neuronCount; i++) {
      const idx = Math.min(i * step, this.count - 1);
      this._dummy.position.set(src[idx * 3], src[idx * 3 + 1], src[idx * 3 + 2]);
      this._dummy.scale.setScalar(0.6 + hash(i) * 0.5);
      this._dummy.updateMatrix();
      this.neurons.setMatrixAt(i, this._dummy.matrix);
      this.neurons.setColorAt(i, hash(i + 9) < 0.7 ? orange : teal);
    }
    this.neurons.instanceMatrix.needsUpdate = true;
    if (this.neurons.instanceColor) this.neurons.instanceColor.needsUpdate = true;
  }

  _lines() {
    const src = this.current;
    const dst = this.linePos;
    for (let i = 0; i < this.lineCount; i++) {
      const a = Math.min(i * Math.floor(this.count / this.lineCount), this.count - 2);
      const b = Math.min(a + 1, this.count - 1);
      const o = i * 6;
      dst[o] = src[a * 3];
      dst[o + 1] = src[a * 3 + 1];
      dst[o + 2] = src[a * 3 + 2];
      dst[o + 3] = src[b * 3];
      dst[o + 4] = src[b * 3 + 1];
      dst[o + 5] = src[b * 3 + 2];
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
    this.pointsMat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  }

  tick = () => {
    requestAnimationFrame(this.tick);
    if (!this._running) return;
    const t = this.clock.getElapsedTime();
    this.pointsMat.uniforms.uTime.value = t;

    if (this.quiet) {
      this.bloomPass.strength = 0.02;
      this.composer.render();
      return;
    }

    const rot = this.reduced ? 0 : t * 0.028;
    this.group.rotation.y = rot + this.pointer.x * 0.1;
    this.group.rotation.x = this.pointer.y * 0.05 + Math.sin(t * 0.09) * 0.03;
    this.camera.lookAt(0.4, 0, 0);

    this.bloomPass.strength = 0.04;
    this.composer.render();
  };
}
