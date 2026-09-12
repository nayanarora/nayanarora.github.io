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

function networkArt(count) {
  const pts = new Float32Array(count * 3);
  const layers = [10, 16, 22, 18, 12, 8];
  const hubs = [];
  let n = 0;
  const Lcount = layers.length;
  for (let L = 0; L < Lcount; L++) {
    const x = (L / (Lcount - 1) - 0.5) * 3.6;
    const share = layers[L];
    const cols = Math.ceil(Math.sqrt(share));
    const rows = Math.ceil(share / cols);
    for (let i = 0; i < share; i++) {
      const gx = (i % cols) / Math.max(cols - 1, 1) - 0.5;
      const gy = Math.floor(i / cols) / Math.max(rows - 1, 1) - 0.5;
      const j = (hash(n + L * 17) - 0.5) * 0.16;
      const p = [x + j * 0.3, gy * 2.55 + j, gx * 2.35 - j * 0.4];
      hubs.push(p);
      pts[n * 3] = p[0];
      pts[n * 3 + 1] = p[1];
      pts[n * 3 + 2] = p[2];
      n += 1;
    }
  }
  while (n < count) {
    const a = hubs[Math.floor(hash(n) * hubs.length)];
    const skip = hash(n + 2) < 0.22;
    const b = hubs[Math.min(hubs.length - 1, Math.floor(hash(n + 5) * hubs.length))];
    const t = hash(n + 11);
    const mt = 1 - t;
    const wob = Math.sin(t * 11 + n * 0.013) * (skip ? 0.12 : 0.06);
    pts[n * 3] = mt * a[0] + t * b[0] + wob * (hash(n) - 0.5);
    pts[n * 3 + 1] = mt * a[1] + t * b[1] + wob * (hash(n + 1) - 0.5);
    pts[n * 3 + 2] = mt * a[2] + t * b[2] + wob * (hash(n + 2) - 0.5);
    n += 1;
  }
  return { pts, hubs };
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.mobile = window.matchMedia("(max-width: 900px)").matches;
    this.quiet = false;
    this.count = this.mobile ? 1300 : 2800;
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
    this.camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.05, 40);
    this.camera.position.set(0.12, 0.04, 3.9);

    this.group = new THREE.Group();
    this.group.position.set(0.48, 0.02, 0);
    this.group.scale.setScalar(1.55);
    this.scene.add(this.group);

    const art = networkArt(count);
    this.current = art.pts;
    this.hubs = art.hubs;

    this.neuronCount = this.mobile ? 26 : 48;
    const soma = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.88
    });
    this.neurons = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.085, 12, 12),
      soma,
      this.neuronCount
    );
    this.neurons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.neurons);
    this._dummy = new THREE.Object3D();
    this._placeNeurons();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(art.pts, 3));
    const sizes = new Float32Array(count);
    const accents = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      sizes[i] = hash(i) * 1.15 + 0.42;
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
          p += 0.014 * vec3(
            sin(uTime * 0.22 + position.y * 1.1),
            sin(uTime * 0.16 + position.x * 0.9),
            cos(uTime * 0.18 + position.z * 0.8)
          );
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (78.0 / -mv.z);
          vAlpha = clamp(1.65 / length(mv.xyz), 0.16, 0.7);
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
          float matte = smoothstep(0.5, 0.18, d);
          vec3 col = mix(uColor, uAccent, vAccent);
          gl_FragColor = vec4(col, matte * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.pointsMat);
    this.group.add(this.points);

    const lineCount = this.mobile ? 320 : 580;
    this.lineCount = lineCount;
    this.linePos = new Float32Array(lineCount * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(this.linePos, 3));
    this.lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: LINE,
        transparent: true,
        opacity: 0.34,
        depthWrite: false
      })
    );
    this.group.add(this.lines);
    this._lines();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.09,
      0.45,
      0.72
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
    const hubs = this.hubs;
    const teal = NODE;
    const orange = ORANGE;
    const n = Math.min(this.neuronCount, hubs.length);
    for (let i = 0; i < n; i++) {
      const p = hubs[i];
      this._dummy.position.set(p[0], p[1], p[2]);
      this._dummy.scale.setScalar(0.85 + hash(i) * 0.7);
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
    const hubs = this.hubs;
    const hubLinks = Math.min(this.lineCount, Math.floor(hubs.length * 2.2));
    for (let i = 0; i < hubLinks; i++) {
      const a = hubs[i % hubs.length];
      const b = hubs[Math.min(hubs.length - 1, (i % hubs.length) + 1 + (i % 3))];
      const o = i * 6;
      dst[o] = a[0];
      dst[o + 1] = a[1];
      dst[o + 2] = a[2];
      dst[o + 3] = b[0];
      dst[o + 4] = b[1];
      dst[o + 5] = b[2];
    }
    for (let i = hubLinks; i < this.lineCount; i++) {
      const a = Math.min((i - hubLinks) * Math.floor(this.count / (this.lineCount - hubLinks + 1)), this.count - 2);
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
      this.bloomPass.strength = 0.04;
      this.composer.render();
      return;
    }

    const rot = this.reduced ? 0 : t * 0.022;
    this.group.rotation.y = rot + this.pointer.x * 0.08;
    this.group.rotation.x = this.pointer.y * 0.045 + Math.sin(t * 0.09) * 0.025;
    this.camera.lookAt(0.32, 0, 0);

    this.bloomPass.strength = this.mobile || this.reduced ? 0.07 : 0.1;
    this.composer.render();
  };
}
