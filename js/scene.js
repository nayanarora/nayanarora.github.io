import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const PALETTES = [
  { a: new THREE.Color("#c8c8c8"), b: new THREE.Color("#e85d04") },
  { a: new THREE.Color("#8f8f8f"), b: new THREE.Color("#f97316") },
  { a: new THREE.Color("#d4d4d4"), b: new THREE.Color("#c2410c") },
  { a: new THREE.Color("#9a9a9a"), b: new THREE.Color("#ea580c") },
  { a: new THREE.Color("#b5b5b5"), b: new THREE.Color("#ff7a18") }
];

function fibonacciSphere(count, radius) {
  const pts = new Float32Array(count * 3);
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = g * i;
    pts[i * 3] = Math.cos(theta) * r * radius;
    pts[i * 3 + 1] = y * radius;
    pts[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return pts;
}

function cityGrid(count) {
  const pts = new Float32Array(count * 3);
  const cols = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    const x = (i % cols) / cols - 0.5;
    const z = Math.floor(i / cols) / cols - 0.5;
    const h = ((Math.sin(x * 18) * Math.cos(z * 14) + 1) * 0.5) ** 2;
    pts[i * 3] = x * 8.4;
    pts[i * 3 + 1] = h * 2.6 - 0.8;
    pts[i * 3 + 2] = z * 8.4;
  }
  return pts;
}

function rainField(count) {
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pts[i * 3] = (Math.random() - 0.5) * 9;
    pts[i * 3 + 1] = (Math.random() - 0.5) * 8;
    pts[i * 3 + 2] = (Math.random() - 0.5) * 9;
  }
  return pts;
}

function rings(count) {
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const ring = i % 4;
    const t = (i / count) * Math.PI * 18;
    const r = 1.4 + ring * 0.72;
    const tilt = ring * 0.4;
    pts[i * 3] = Math.cos(t) * r;
    pts[i * 3 + 1] = Math.sin(t * 0.5) * 0.35 + Math.sin(t) * tilt * 0.25;
    pts[i * 3 + 2] = Math.sin(t) * r;
  }
  return pts;
}

const coreVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  uniform float uTime;
  void main() {
    vec3 p = position;
    float n = sin(p.x * 3.2 + uTime) * sin(p.y * 2.7 - uTime * 0.8) * 0.045;
    p += normal * n;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const coreFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uMix;
  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.6);
    vec3 base = mix(uColorA, uColorB, uMix);
    vec3 col = mix(base * 0.16, vec3(1.0, 0.62, 0.28), fresnel);
    gl_FragColor = vec4(col, 0.92);
  }
`;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.mobile = window.matchMedia("(max-width: 900px)").matches;
    this.quiet = false;
    this.count = this.mobile ? 1600 : 4200;
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.25 : 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 80);
    this.camera.position.set(0, 0.1, 5.5);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: this.colorA },
        uColorB: { value: this.colorB },
        uMix: { value: 0 }
      },
      vertexShader: coreVert,
      fragmentShader: coreFrag,
      transparent: true
    });

    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 48), this.coreMat);
    this.group.add(this.core);

    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.22, 2),
      new THREE.MeshBasicMaterial({
        color: 0xb0b0b0,
        wireframe: true,
        transparent: true,
        opacity: 0.14
      })
    );
    this.wire = wire;
    this.group.add(wire);

    const ribbonGeo = new THREE.TorusKnotGeometry(1.85, 0.012, 420, 12, 2, 3);
    this.ribbon = new THREE.Mesh(
      ribbonGeo,
      new THREE.MeshBasicMaterial({ color: 0xe85d04, transparent: true, opacity: 0.42 })
    );
    this.group.add(this.ribbon);

    this.targets = [
      fibonacciSphere(count, 2.35),
      fibonacciSphere(count, 4.1),
      cityGrid(count),
      rainField(count),
      rings(count)
    ];
    this.current = this.targets[0].slice(0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.current, 3));
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) sizes[i] = Math.random() * 1.6 + 0.5;
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    this.pointsMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color("#e8e8e8") },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 0.35 + position.x * 0.6) * 0.04;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (88.0 / -mv.z);
          vAlpha = clamp(2.0 / length(mv.xyz), 0.1, 0.9);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor, glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(geo, this.pointsMat);
    this.group.add(this.points);

    const lineCount = this.mobile ? 140 : 360;
    const linePos = new Float32Array(lineCount * 6);
    this.linePos = linePos;
    this.lineCount = lineCount;
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
        this.lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: 0xe85d04,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.group.add(this.lines);

    const bloom = this.mobile || this.reduced ? 0.28 : 0.52;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloom,
      0.55,
      0.18
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

  setProgress(t) {
    this.progress = THREE.MathUtils.clamp(t, 0, 1);
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
    this.coreMat.uniforms.uMix.value = f;
    this.pointsMat.uniforms.uColor.value.lerpColors(this.colorA, this.colorB, 0.5);
    this.ribbon.material.color.copy(this.colorB);
    this.wire.material.color.copy(this.colorB);
  }

  _lines() {
    const src = this.current;
    const dst = this.linePos;
    const step = Math.floor(this.count / this.lineCount);
    for (let i = 0; i < this.lineCount; i++) {
      const a = i * step;
      const b = Math.min(a + 7, this.count - 1);
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
    const p = this.progress;

    this._morph(p);
    this._lines();

    this.coreMat.uniforms.uTime.value = t;
    this.pointsMat.uniforms.uTime.value = t;

    const rot = this.reduced ? 0 : t * 0.08;
    this.group.rotation.y = rot + this.pointer.x * 0.18;
    this.group.rotation.x = this.pointer.y * 0.08;
    this.ribbon.rotation.y = -rot * 1.4;
    this.ribbon.rotation.x = t * 0.12;
    this.core.rotation.y = rot * 0.6;

    const z = 5.5 - p * 0.7;
    const y = 0.08 + Math.sin(p * Math.PI) * 0.18;
    this.camera.position.z += (z - this.camera.position.z) * 0.06;
    this.camera.position.y += (y - this.camera.position.y) * 0.06;
    this.camera.lookAt(0, 0, 0);

    this.bloomPass.strength = this.quiet
      ? 0.12
      : this.mobile || this.reduced
        ? 0.22
        : 0.38 + p * 0.1;
    this.composer.render();
  };
}
