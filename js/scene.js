import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const PALETTES = [
  { a: new THREE.Color("#163a5c"), b: new THREE.Color("#3d7ea3") },
  { a: new THREE.Color("#1c2a38"), b: new THREE.Color("#8a9aaa") },
  { a: new THREE.Color("#12324a"), b: new THREE.Color("#4aa3c7") },
  { a: new THREE.Color("#1a2836"), b: new THREE.Color("#c4a86a") },
  { a: new THREE.Color("#14283c"), b: new THREE.Color("#2f6f93") }
];

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

function connectome(count) {
  const pts = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const j = (hash(i) - 0.5) * 0.08;
    pts[i * 3] = Math.cos(theta) * r * 2.25 + j;
    pts[i * 3 + 1] = y * 1.5 + j * 0.4;
    pts[i * 3 + 2] = Math.sin(theta) * r * 1.85 + j;
  }
  return pts;
}

function hubNetwork(count) {
  const pts = new Float32Array(count * 3);
  const hubs = [
    [0.0, 0.15, 0.0],
    [1.6, 0.55, 0.35],
    [-1.35, 0.7, -0.2],
    [1.15, -0.75, 0.55],
    [-1.05, -0.65, 0.4],
    [0.35, 1.15, -0.7],
    [-0.15, -1.2, -0.45],
    [2.05, 0.05, -0.55],
    [-1.85, 0.1, 0.65]
  ];
  for (let i = 0; i < count; i++) {
    const a = hubs[i % hubs.length];
    const b = hubs[(i + 3) % hubs.length];
    const t = hash(i);
    const mt = 1 - t;
    const bow = Math.sin(t * Math.PI) * (0.35 + hash(i + 6) * 0.5);
    pts[i * 3] = mt * a[0] + t * b[0] + bow * (hash(i + 2) - 0.5);
    pts[i * 3 + 1] = mt * a[1] + t * b[1] + bow * (hash(i + 4) - 0.5);
    pts[i * 3 + 2] = mt * a[2] + t * b[2] + bow * (hash(i + 8) - 0.5);
  }
  return pts;
}

function circuitBrain(count) {
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const lobe = i % 2 === 0 ? -1 : 1;
    const u = hash(i);
    const v = hash(i + 13);
    const [x, y, z] = ellipsoid(u, v, 1.15, 1.45, 1.2);
    const gx = Math.round(x * 5) / 5;
    const gy = Math.round(y * 5) / 5;
    const gz = Math.round(z * 4) / 4;
    const mix = 0.72;
    pts[i * 3] = (gx * mix + x * (1 - mix)) + lobe * 1.05;
    pts[i * 3 + 1] = gy * mix + y * (1 - mix);
    pts[i * 3 + 2] = gz * mix + z * (1 - mix);
  }
  return pts;
}

function layeredNet(count) {
  const pts = new Float32Array(count * 3);
  const sizes = [8, 14, 20, 14, 8];
  const sum = sizes.reduce((a, b) => a + b, 0);
  let n = 0;
  for (let L = 0; L < sizes.length; L++) {
    const share = Math.floor((count * sizes[L]) / sum);
    const x = (L / (sizes.length - 1) - 0.5) * 4.6;
    const cols = Math.ceil(Math.sqrt(share));
    for (let i = 0; i < share && n < count; i++) {
      const gx = (i % cols) / Math.max(cols - 1, 1) - 0.5;
      const gy = Math.floor(i / cols) / Math.max(cols - 1, 1) - 0.5;
      const j = (hash(n) - 0.5) * 0.12;
      pts[n * 3] = x + j * 0.3;
      pts[n * 3 + 1] = gy * 2.6 + j;
      pts[n * 3 + 2] = gx * 2.6 - j * 0.4;
      n += 1;
    }
  }
  while (n < count) {
    pts[n * 3] = (hash(n) - 0.5) * 5;
    pts[n * 3 + 1] = (hash(n + 3) - 0.5) * 3;
    pts[n * 3 + 2] = (hash(n + 7) - 0.5) * 3;
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
    this.progress = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this.colorA = PALETTES[0].a.clone();
    this.colorB = PALETTES[0].b.clone();
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
    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 80);
    this.camera.position.set(0.15, 0.08, 7.2);

    this.group = new THREE.Group();
    this.group.position.set(1.15, 0.05, 0);
    this.scene.add(this.group);

    this.neuronCount = this.mobile ? 14 : 22;
    const soma = new THREE.MeshBasicMaterial({
      color: 0xc4a86a,
      transparent: true,
      opacity: 0.55
    });
    this.neurons = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.032, 8, 8),
      soma,
      this.neuronCount
    );
    this.neurons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.neurons);
    this._dummy = new THREE.Object3D();

    this.targets = [
      brainTracts(count),
      connectome(count),
      hubNetwork(count),
      circuitBrain(count),
      layeredNet(count)
    ];
    this.current = this.targets[0].slice(0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.current, 3));
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) sizes[i] = hash(i) * 0.55 + 0.22;
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    this.pointsMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color("#3d7ea3") },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p += 0.012 * vec3(
            sin(uTime * 0.22 + position.y * 1.1),
            sin(uTime * 0.16 + position.x * 0.9),
            cos(uTime * 0.18 + position.z * 0.8)
          );
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (26.0 / -mv.z);
          vAlpha = clamp(1.15 / length(mv.xyz), 0.08, 0.38);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float matte = smoothstep(0.5, 0.2, d);
          gl_FragColor = vec4(uColor, matte * vAlpha);
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
        color: 0x2f6f93,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
      })
    );
    this.group.add(this.lines);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.035,
      0.5,
      0.82
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this._morph(0);
    this._lastP = 0;

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

  setProgress(t) {
    if (this.quiet) return;
    this.progress = THREE.MathUtils.clamp(t, 0, 1);
  }

  _placeNeurons() {
    const src = this.current;
    const step = Math.max(1, Math.floor(this.count / this.neuronCount));
    for (let i = 0; i < this.neuronCount; i++) {
      const idx = Math.min(i * step, this.count - 1);
      this._dummy.position.set(src[idx * 3], src[idx * 3 + 1], src[idx * 3 + 2]);
      this._dummy.scale.setScalar(0.55 + hash(i) * 0.45);
      this._dummy.updateMatrix();
      this.neurons.setMatrixAt(i, this._dummy.matrix);
    }
    this.neurons.instanceMatrix.needsUpdate = true;
  }

  _morph(t) {
    const segs = this.targets.length - 1;
    const x = t * segs;
    const i = Math.min(Math.floor(x), segs - 1);
    const f = x - i;
    const a = this.targets[i];
    const b = this.targets[i + 1];
    const out = this.current;
    for (let n = 0; n < out.length; n++) {
      out[n] = a[n] + (b[n] - a[n]) * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;

    const palA = PALETTES[i];
    const palB = PALETTES[i + 1];
    this.colorA.lerpColors(palA.a, palB.a, f);
    this.colorB.lerpColors(palA.b, palB.b, f);
    this.pointsMat.uniforms.uColor.value.copy(this.colorB);
    this.neurons.material.color.copy(this.colorB);
    this.lines.material.color.copy(this.colorA);
    this._placeNeurons();
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

    const p = this.progress;
    const moved = Math.abs(p - (this._lastP ?? -1)) > 0.0008;
    if (moved) {
      this._morph(p);
      this._lastP = p;
    }
    this._lines();

    const rot = this.reduced ? 0 : t * 0.028;
    this.group.rotation.y = rot + this.pointer.x * 0.1;
    this.group.rotation.x = this.pointer.y * 0.05 + Math.sin(t * 0.09) * 0.03;

    const z = 7.2 - p * 0.4;
    this.camera.position.z += (z - this.camera.position.z) * 0.04;
    this.camera.lookAt(0.55, 0, 0);

    this.bloomPass.strength = 0.03;
    this.composer.render();
  };
}
