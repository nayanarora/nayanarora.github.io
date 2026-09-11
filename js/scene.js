import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const PALETTES = [
  { a: new THREE.Color("#c4b6a8"), b: new THREE.Color("#c56a2c") },
  { a: new THREE.Color("#8d867c"), b: new THREE.Color("#a8521f") },
  { a: new THREE.Color("#d2c4b4"), b: new THREE.Color("#b8612e") },
  { a: new THREE.Color("#9a938a"), b: new THREE.Color("#8f4a24") },
  { a: new THREE.Color("#cfc6bc"), b: new THREE.Color("#d4783a") }
];

function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function neuralLayers(count) {
  const pts = new Float32Array(count * 3);
  const sizes = [10, 16, 22, 16, 10];
  const sum = sizes.reduce((a, b) => a + b, 0);
  let n = 0;
  for (let L = 0; L < sizes.length; L++) {
    const share = Math.floor((count * sizes[L]) / sum);
    const x = (L / (sizes.length - 1) - 0.5) * 5.4;
    const cols = Math.ceil(Math.sqrt(share));
    for (let i = 0; i < share && n < count; i++) {
      const gx = (i % cols) / Math.max(cols - 1, 1) - 0.5;
      const gy = Math.floor(i / cols) / Math.max(cols - 1, 1) - 0.5;
      const j = (hash(n) - 0.5) * 0.16;
      pts[n * 3] = x + j * 0.4;
      pts[n * 3 + 1] = gy * 3.1 + j;
      pts[n * 3 + 2] = gx * 3.1 - j * 0.5;
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

function robotArm(count) {
  const pts = new Float32Array(count * 3);
  const joints = [
    [0.0, -1.3, 0.0],
    [0.55, 0.15, 0.35],
    [1.45, 1.05, -0.15],
    [2.25, 0.35, 0.55],
    [2.55, -0.15, 0.9]
  ];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const x = t * (joints.length - 1);
    const s = Math.min(joints.length - 2, Math.floor(x));
    const f = x - s;
    const a = joints[s];
    const b = joints[s + 1];
    const j = (hash(i) - 0.5) * 0.28;
    const k = (hash(i + 11) - 0.5) * 0.28;
    pts[i * 3] = a[0] + (b[0] - a[0]) * f + j;
    pts[i * 3 + 1] = a[1] + (b[1] - a[1]) * f + k * 0.6;
    pts[i * 3 + 2] = a[2] + (b[2] - a[2]) * f + k;
  }
  return pts;
}

function featureMaps(count) {
  const pts = new Float32Array(count * 3);
  const depth = 5;
  const side = Math.ceil(Math.sqrt(count / depth));
  for (let i = 0; i < count; i++) {
    const z = Math.floor(i / (side * side));
    const rem = i % (side * side);
    const x = (rem % side) / side - 0.5;
    const y = Math.floor(rem / side) / side - 0.5;
    pts[i * 3] = x * 4.6;
    pts[i * 3 + 1] = (z / depth - 0.5) * 2.4;
    pts[i * 3 + 2] = y * 4.6;
  }
  return pts;
}

function recurrent(count) {
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const loop = i % 3;
    const t = (i / count) * Math.PI * 10;
    const r = 1.15 + loop * 0.55;
    const tilt = 0.55 + loop * 0.4;
    pts[i * 3] = Math.cos(t) * r;
    pts[i * 3 + 1] = Math.sin(t * (1.2 + loop * 0.35)) * 0.85;
    pts[i * 3 + 2] = Math.sin(t) * r * Math.cos(tilt) + Math.cos(t * 0.4) * 0.3;
  }
  return pts;
}

function attention(count) {
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const head = i % 4;
    const ang = (i / count) * Math.PI * 8 + head * 0.7;
    const rad = 0.55 + (hash(i) * 1.8);
    const ox = (head % 2 === 0 ? -1.3 : 1.3);
    const oy = (head < 2 ? 0.7 : -0.7);
    pts[i * 3] = ox + Math.cos(ang) * rad * 0.7;
    pts[i * 3 + 1] = oy + (hash(i + 5) - 0.5) * 1.4;
    pts[i * 3 + 2] = Math.sin(ang) * rad * 0.7;
  }
  return pts;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.mobile = window.matchMedia("(max-width: 900px)").matches;
    this.quiet = false;
    this.count = this.mobile ? 1400 : 3200;
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.2 : 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 80);
    this.camera.position.set(0.4, 0.15, 6.1);

    this.scene.add(new THREE.HemisphereLight(0x2a241e, 0x0c0a08, 0.85));
    const key = new THREE.DirectionalLight(0xe0b089, 0.7);
    key.position.set(3.2, 2.4, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x6a4a32, 0.28);
    fill.position.set(-4, -1.2, 1.5);
    this.scene.add(fill);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.neuronCount = this.mobile ? 26 : 52;
    const soma = new THREE.MeshStandardMaterial({
      color: 0xc56a2c,
      roughness: 0.9,
      metalness: 0.06
    });
    this.neurons = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.055, 10, 10),
      soma,
      this.neuronCount
    );
    this.neurons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.neurons);
    this._dummy = new THREE.Object3D();

    this.targets = [
      neuralLayers(count),
      robotArm(count),
      featureMaps(count),
      recurrent(count),
      attention(count)
    ];
    this.current = this.targets[0].slice(0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.current, 3));
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) sizes[i] = hash(i) * 1.15 + 0.35;
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    this.pointsMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color("#c56a2c") },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p += 0.018 * vec3(
            sin(uTime * 0.7 + position.y * 2.1),
            sin(uTime * 0.45 + position.x * 1.7),
            cos(uTime * 0.55 + position.z * 1.4)
          );
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (64.0 / -mv.z);
          vAlpha = clamp(1.7 / length(mv.xyz), 0.12, 0.72);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float matte = smoothstep(0.5, 0.18, d);
          gl_FragColor = vec4(uColor, matte * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.pointsMat);
    this.group.add(this.points);

    const lineCount = this.mobile ? 160 : 280;
    this.lineCount = lineCount;
    this.linePos = new Float32Array(lineCount * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(this.linePos, 3));
    this.lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: 0xb8612e,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      })
    );
    this.group.add(this.lines);

    const bloom = this.mobile || this.reduced ? 0.1 : 0.16;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloom,
      0.4,
      0.35
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
      const s = 0.75 + hash(i) * 0.7;
      this._dummy.scale.setScalar(s);
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
    this.lines.material.color.copy(this.colorB);
    this._placeNeurons();
  }

  _lines() {
    const src = this.current;
    const dst = this.linePos;
    const stride = Math.max(2, Math.floor(this.count / this.lineCount));
    for (let i = 0; i < this.lineCount; i++) {
      const a = Math.min(i * stride, this.count - 1);
      const b = Math.min(a + 1 + (i % 5), this.count - 1);
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
      this.bloomPass.strength = 0.06;
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

    const rot = this.reduced ? 0 : t * 0.045;
    this.group.rotation.y = rot + this.pointer.x * 0.16;
    this.group.rotation.x = this.pointer.y * 0.07 + Math.sin(t * 0.12) * 0.04;

    const z = 6.1 - p * 0.55;
    const y = 0.12 + Math.sin(p * Math.PI) * 0.14;
    this.camera.position.z += (z - this.camera.position.z) * 0.05;
    this.camera.position.y += (y - this.camera.position.y) * 0.05;
    this.camera.lookAt(0, 0, 0);

    this.bloomPass.strength = this.mobile || this.reduced ? 0.08 : 0.14;
    this.composer.render();
  };
}
