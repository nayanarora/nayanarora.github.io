import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const LINE = new THREE.Color("#3a7fa3");
const NODE = new THREE.Color("#4aa3c7");
const ORANGE = new THREE.Color("#c56a2c");

function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function mlp() {
  const widths = [8, 14, 18, 14, 8];
  const layerGap = 1.08;
  const nodeGap = 0.185;
  const hubs = [];
  const layers = [];

  for (let L = 0; L < widths.length; L++) {
    const layer = [];
    const x = (L - (widths.length - 1) / 2) * layerGap;
    const n = widths[L];
    for (let i = 0; i < n; i++) {
      const y = (i - (n - 1) / 2) * nodeGap;
      const z = (hash(L * 31 + i) - 0.5) * 0.22;
      const p = [x, y, z];
      hubs.push(p);
      layer.push(p);
    }
    layers.push(layer);
  }

  const edges = [];
  for (let L = 0; L < layers.length - 1; L++) {
    const a = layers[L];
    const b = layers[L + 1];
    const density = L === 0 || L === layers.length - 2 ? 0.62 : 0.4;
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        if (hash(L * 97 + i * 13 + j * 7) < density) {
          edges.push([a[i], b[j]]);
        }
      }
    }
  }

  const perEdge = 3;
  const count = edges.length * perEdge + hubs.length;
  const pts = new Float32Array(count * 3);
  let n = 0;
  for (const p of hubs) {
    pts[n * 3] = p[0];
    pts[n * 3 + 1] = p[1];
    pts[n * 3 + 2] = p[2];
    n += 1;
  }
  for (let e = 0; e < edges.length; e++) {
    const [a, b] = edges[e];
    for (let k = 0; k < perEdge; k++) {
      const t = (k + 1) / (perEdge + 1);
      const wob = Math.sin(t * Math.PI) * 0.018 * (hash(e + k) - 0.5);
      pts[n * 3] = a[0] + (b[0] - a[0]) * t;
      pts[n * 3 + 1] = a[1] + (b[1] - a[1]) * t + wob;
      pts[n * 3 + 2] = a[2] + (b[2] - a[2]) * t + wob * 0.6;
      n += 1;
    }
  }

  return { pts, hubs, edges, count };
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.mobile = window.matchMedia("(max-width: 900px)").matches;
    this.quiet = false;
    this.pointer = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this._init();
  }

  _init() {
    const { canvas } = this;
    const art = mlp();
    this.count = art.count;
    this.current = art.pts;
    this.hubs = art.hubs;
    this.edges = art.edges;

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
    this.camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 40);
    this.camera.position.set(0.42, 0.03, 4.05);

    this.group = new THREE.Group();
    this.group.position.set(0.82, 0.02, 0);
    this.group.scale.setScalar(1.48);
    this.group.rotation.y = -0.28;
    this.scene.add(this.group);

    this.neuronCount = art.hubs.length;
    const soma = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    });
    this.neurons = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.04, 12, 12),
      soma,
      this.neuronCount
    );
    this.neurons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.neurons.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.neuronCount * 3),
      3
    );
    this.group.add(this.neurons);
    this._dummy = new THREE.Object3D();
    this._placeNeurons();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(art.pts, 3));
    const sizes = new Float32Array(this.count);
    const accents = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const isHub = i < this.hubs.length;
      sizes[i] = isHub ? 1.35 : hash(i) * 0.55 + 0.28;
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
          float pulse = 0.78 + 0.22 * sin(uTime * 0.85 - position.x * 2.4);
          p += 0.008 * vec3(
            sin(uTime * 0.18 + position.y * 1.2),
            sin(uTime * 0.14 + position.x * 0.9),
            cos(uTime * 0.16 + position.z * 0.8)
          );
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (70.0 / -mv.z);
          vAlpha = clamp(1.55 / length(mv.xyz), 0.14, 0.66) * pulse;
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

    this.lineCount = art.edges.length;
    this.linePos = new Float32Array(this.lineCount * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(this.linePos, 3));
    this.lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: LINE,
        transparent: true,
        opacity: this.mobile ? 0.26 : 0.3,
        depthWrite: false
      })
    );
    this.group.add(this.lines);
    this._lines();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.08,
      0.42,
      0.7
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
    for (let i = 0; i < hubs.length; i++) {
      const p = hubs[i];
      this._dummy.position.set(p[0], p[1], p[2]);
      this._dummy.scale.setScalar(0.95 + hash(i) * 0.28);
      this._dummy.updateMatrix();
      this.neurons.setMatrixAt(i, this._dummy.matrix);
      this.neurons.setColorAt(i, hash(i + 9) < 0.7 ? ORANGE : NODE);
    }
    this.neurons.instanceMatrix.needsUpdate = true;
    if (this.neurons.instanceColor) this.neurons.instanceColor.needsUpdate = true;
  }

  _lines() {
    const dst = this.linePos;
    const edges = this.edges;
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i];
      const o = i * 6;
      dst[o] = a[0];
      dst[o + 1] = a[1];
      dst[o + 2] = a[2];
      dst[o + 3] = b[0];
      dst[o + 4] = b[1];
      dst[o + 5] = b[2];
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

    const rot = this.reduced ? 0 : Math.sin(t * 0.12) * 0.08;
    this.group.rotation.y = -0.22 + rot + this.pointer.x * 0.06;
    this.group.rotation.x = this.pointer.y * 0.035 + Math.sin(t * 0.09) * 0.02;
    this.camera.lookAt(0.72, 0, 0);

    this.bloomPass.strength = this.mobile || this.reduced ? 0.06 : 0.09;
    this.composer.render();
  };
}
