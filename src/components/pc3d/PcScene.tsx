"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { PartId } from "@/lib/builder/parts";
import { COLORS, makeMaterials } from "./kit";
import { buildPart, type PartModel } from "./models";

/**
 * PC en 3D: materiales reales adentro del gabinete (acero, vidrio, PCB) y el
 * mundo del cartel encima: la pieza del paso actual con contorno rosa flúo,
 * contorno de fibrón al pasar el mouse y contornos punteados para lo que falta.
 */

/** Orden de armado: lo de abajo y atrás primero. */
const ORDER: PartId[] = ["case", "psu", "mother", "cpu", "cooler", "ram", "ssd", "gpu"];
const OVERVIEW = new THREE.Vector3(0, -0.15, 0);
const VIEW_DIR = new THREE.Vector3(0.62, 0.3, 0.72).normalize();
const UP = new THREE.Vector3(0, 1, 0);

interface PartState {
  model: PartModel;
  bounds: THREE.Box3;
  volume: number;
  hit: THREE.Mesh;
  ghost: LineSegments2;
  hover: LineSegments2;
  active: LineSegments2;
  mats: THREE.Material[];
  placed: boolean;
  /** 0 → 1 mientras entra */
  t: number;
  delay: number;
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 4);
// entra con un mínimo rebote, como una pieza que encaja
const easeBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

type Api = { sync: (placed: Partial<Record<PartId, boolean>>, active: PartId | null) => void };

export default function PcScene({
  placed,
  active = null,
  showcase = false,
  labels,
  onPick,
  complete,
  className = "",
  label,
}: {
  placed: Partial<Record<PartId, boolean>>;
  active?: PartId | null;
  /** home: se arma sola al entrar en pantalla, se prende y gira */
  showcase?: boolean;
  /** texto del cartelito al pasar el mouse por cada pieza */
  labels?: Partial<Record<PartId, string>>;
  onPick?: (part: PartId) => void;
  /** la PC está completa (las piezas salteadas a propósito cuentan): se "prende" */
  complete?: boolean;
  className?: string;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  // callbacks y textos frescos sin reconstruir la escena
  const live = useRef({ labels, onPick, complete });
  useEffect(() => {
    live.current = { labels, onPick, complete };
  }, [labels, onPick, complete]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // sin WebGL: la lista de piezas alcanza
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";
    el.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envTex = pmrem.fromScene(room, 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.95;

    // luz de estudio: principal con sombra, recorte por detrás y relleno
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(2.5, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
    key.shadow.bias = -0.0005;
    key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.1);
    rim.position.set(-5, 4, -6);
    scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd6d9d0, 0.6));

    // luz interior: se enciende cuando la PC se "prende"
    const inner = new THREE.PointLight(0xffffff, 0, 6, 1.6);
    inner.position.set(0.7, 1.7, 0.6);
    scene.add(inner);

    // piso invisible que solo recibe la sombra: la PC "apoya" sobre el papel
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.44;
    floor.receiveShadow = true;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false; // la rueda sigue scrolleando la página
    controls.rotateSpeed = 0.55;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.56;
    // siempre del lado del vidrio: es por donde se ve el armado
    controls.minAzimuthAngle = -0.15;
    controls.maxAzimuthAngle = Math.PI * 0.62;
    controls.enableRotate = !coarse; // en el celu el dedo scrollea; tocar una pieza la elige
    controls.target.copy(OVERVIEW);

    const resolution = new THREE.Vector2(1, 1);
    const lineMats: LineMaterial[] = [];
    const lineMat = (color: number, width: number, dashed = false, opacity = 1) => {
      const m = new LineMaterial({
        color,
        linewidth: width,
        dashed,
        dashSize: 0.14,
        gapSize: 0.1,
        transparent: true,
        opacity,
        resolution,
      });
      lineMats.push(m);
      return m;
    };
    const boxLines = (box: THREE.Box3, mat: LineMaterial) => {
      const size = box.getSize(new THREE.Vector3()).addScalar(0.08);
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
      const geo = new LineSegmentsGeometry().fromEdgesGeometry(edges);
      edges.dispose();
      const line = new LineSegments2(geo, mat);
      line.computeLineDistances();
      line.position.copy(box.getCenter(new THREE.Vector3()));
      line.renderOrder = 20;
      line.visible = false;
      return line;
    };

    const root = new THREE.Group();
    scene.add(root);
    const materials = makeMaterials();
    const ghostMat = lineMat(COLORS.ink, 1.4, true, 0.32);
    const ghostActiveMat = lineMat(COLORS.fluo, 2.2, true, 0.95);
    const hoverMat = lineMat(COLORS.ink, 2.2);
    const activeMat = lineMat(COLORS.fluo, 2.6);

    const parts = {} as Record<PartId, PartState>;
    for (const id of ORDER) {
      const model = buildPart(id, materials);
      // materiales propios por pieza, para poder desvanecerla al entrar
      const mats: THREE.Material[] = [];
      const own = new Map<THREE.Material, THREE.Material>();
      model.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const src = o.material as THREE.Material;
        let m = own.get(src);
        if (!m) {
          m = src.clone();
          m.userData.opacity = src.opacity;
          m.userData.transparent = src.transparent;
          own.set(src, m);
          mats.push(m);
        }
        o.material = m;
      });
      root.add(model.group);
      const bounds = new THREE.Box3().setFromObject(model.group);
      const size = bounds.getSize(new THREE.Vector3());
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(size.x + 0.1, size.y + 0.1, size.z + 0.1),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.copy(bounds.getCenter(new THREE.Vector3()));
      hit.userData.part = id;
      root.add(hit);
      const ghost = boxLines(bounds, ghostMat);
      const hover = boxLines(bounds, hoverMat);
      const activeLine = boxLines(bounds, activeMat);
      root.add(ghost, hover, activeLine);
      parts[id] = {
        model,
        bounds,
        volume: size.x * size.y * size.z,
        hit,
        ghost,
        hover,
        active: activeLine,
        mats,
        placed: false,
        t: 1,
        delay: 0,
      };
    }

    let activeId: PartId | null = null;
    let hoverId: PartId | null = null;
    let power = 0;

    function paint() {
      for (const id of ORDER) {
        const p = parts[id];
        const k = p.placed ? Math.min(1, Math.max(0, p.t)) : 0;
        const visible = p.placed && p.t > 0;
        p.model.group.visible = visible;
        if (visible) {
          const e = id === "case" ? easeOut(k) : easeBack(k);
          p.model.group.position.copy(p.model.from).multiplyScalar(1 - e);
          if (id === "case") p.model.group.scale.setScalar(0.97 + 0.03 * e);
          const fade = easeOut(Math.min(1, k * 1.6));
          for (const m of p.mats) {
            m.transparent = fade < 1 || (m.userData.transparent as boolean);
            m.opacity = (m.userData.opacity as number) * fade;
          }
        }
        const isActive = activeId === id;
        // de cerca, el contorno del gabinete cruzaría toda la vista
        const zoomed = activeId !== null && activeId !== "case";
        p.ghost.visible = (!p.placed || p.t < 1) && !(id === "case" && zoomed);
        p.ghost.material = isActive ? ghostActiveMat : ghostMat;
        p.active.visible = isActive && p.placed && p.t >= 1;
        p.hover.visible = hoverId === id && !isActive && id !== "case";
      }
    }

    // ---- cámara: se acerca a la pieza del paso actual ----
    let tween: { from: THREE.Vector3; to: THREE.Vector3; d0: number; d1: number; t: number } | null = null;
    let baseDist = 12.6;
    const focusDistance = (id: PartId | null) => {
      if (!id || id === "case" || showcase) return baseDist;
      const size = parts[id].bounds.getSize(new THREE.Vector3());
      return Math.min(baseDist, Math.max(6.2, Math.max(size.x, size.y, size.z) * 3.3));
    };
    const focusTarget = (id: PartId | null) =>
      !id || id === "case" || showcase ? OVERVIEW.clone() : parts[id].bounds.getCenter(new THREE.Vector3());
    function focus(id: PartId | null, instant = false) {
      const to = focusTarget(id);
      const d1 = focusDistance(id);
      if (instant || reduce) {
        controls.target.copy(to);
        camera.position.copy(to).addScaledVector(VIEW_DIR, d1);
        tween = null;
        return;
      }
      tween = { from: controls.target.clone(), to, d0: camera.position.distanceTo(controls.target), d1, t: 0 };
    }

    function sync(next: Partial<Record<PartId, boolean>>, nextActive: PartId | null) {
      const changedActive = nextActive !== activeId;
      activeId = nextActive;
      let stagger = 0;
      for (const id of ORDER) {
        const p = parts[id];
        const want = !!next[id];
        if (want && !p.placed) {
          p.placed = true;
          p.t = reduce ? 1 : 0;
          p.delay = stagger;
          stagger += 0.18;
        } else if (!want && p.placed) {
          p.placed = false;
          p.t = 1;
        }
      }
      if (changedActive) focus(activeId);
      paint();
    }
    api.current = { sync };

    // ---- tamaño: el gabinete entra entero también en contenedores angostos ----
    function resize() {
      const w = el!.clientWidth;
      const h = el!.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      resolution.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
      for (const m of lineMats) m.resolution.copy(resolution);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      baseDist = 12.6 * Math.max(1, 0.95 / camera.aspect);
      if (!tween) focus(activeId, true);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // ---- mouse: contorno de fibrón, cartelito con nombre y precio, clic = ir a ese paso ----
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hits = ORDER.map((id) => parts[id].hit);
    function pick(e: PointerEvent): PartId | null {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const found = ray
        .intersectObjects(hits, false)
        .map((i) => i.object.userData.part as PartId)
        .sort((a, b) => parts[a].volume - parts[b].volume); // la más chica gana (la CPU está "dentro" del mother)
      return found[0] ?? null;
    }
    let downAt: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || downAt) return;
      const id = pick(e);
      hoverId = id;
      const text = id ? live.current.labels?.[id] : undefined;
      const t = tip.current;
      if (t) {
        t.textContent = text ?? "";
        t.style.opacity = text ? "1" : "0";
        const r = renderer.domElement.getBoundingClientRect();
        t.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
      }
      renderer.domElement.style.cursor = id && live.current.onPick ? "pointer" : "grab";
    };
    const onLeave = () => {
      hoverId = null;
      if (tip.current) tip.current.style.opacity = "0";
    };
    const onDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      // un clic (no un arrastre) sobre una pieza lleva a su paso
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) {
        const id = pick(e);
        if (id) live.current.onPick?.(id);
      }
      downAt = null;
    };
    const cvs = renderer.domElement;
    cvs.addEventListener("pointermove", onMove);
    cvs.addEventListener("pointerleave", onLeave);
    cvs.addEventListener("pointerdown", onDown);
    cvs.addEventListener("pointerup", onUp);

    // ---- loop: solo mientras está en pantalla ----
    let inView = false;
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    function frame(now: number) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;

      let assembling = false;
      for (const id of ORDER) {
        const p = parts[id];
        if (p.placed && p.t < 1) {
          if (p.delay > 0) p.delay -= dt;
          else p.t = Math.min(1, p.t + dt / 0.75);
          assembling = true;
        }
      }

      // se "prende" cuando está todo (el cooler y la placa pueden faltar a propósito)
      const complete = live.current.complete ?? ORDER.every((id) => parts[id].placed);
      power += ((complete && !assembling ? 1 : 0) - power) * Math.min(1, dt * 2.2);
      for (const id of ORDER) {
        const p = parts[id];
        if (!reduce) for (const r of p.model.rotors) r.rotation.z += dt * power * 14;
        for (const l of p.model.lights) (l.material as THREE.MeshStandardMaterial).emissiveIntensity = power * 1.4;
      }
      inner.intensity = power * 9;

      if (tween) {
        tween.t = Math.min(1, tween.t + dt / 0.9);
        const k = easeOut(tween.t);
        const dir = camera.position.clone().sub(controls.target).normalize();
        controls.target.lerpVectors(tween.from, tween.to, k);
        camera.position.copy(controls.target).addScaledVector(dir, tween.d0 + (tween.d1 - tween.d0) * k);
        if (tween.t >= 1) tween = null;
      }
      if (!reduce && !tween && !downAt) {
        // vaivén: en la home más amplio (vitrina), en el armado apenas para que se note que es 3D
        const offset = camera.position.clone().sub(controls.target);
        offset.applyAxisAngle(UP, Math.cos(clock * (showcase ? 0.32 : 0.5)) * (showcase ? 0.0042 : 0.0009));
        camera.position.copy(controls.target).add(offset);
      }
      controls.update();
      paint();
      renderer.render(scene, camera);
      if (inView) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (!raf && inView) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        if (showcase) sync(Object.fromEntries(ORDER.map((id) => [id, true])), null);
        kick();
      }
    });
    io.observe(el);

    resize();
    paint();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      controls.dispose();
      api.current = null;
      cvs.removeEventListener("pointermove", onMove);
      cvs.removeEventListener("pointerleave", onLeave);
      cvs.removeEventListener("pointerdown", onDown);
      cvs.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof LineSegments2) {
          o.geometry.dispose();
          const mat = o.material as THREE.Material;
          (mat as THREE.MeshStandardMaterial).map?.dispose();
          mat.dispose();
        }
      });
      Object.values(materials).forEach((m) => m.dispose());
      envTex.dispose();
      pmrem.dispose();
      room.dispose();
      renderer.dispose();
      cvs.remove();
    };
  }, [showcase]);

  useEffect(() => {
    if (!showcase) api.current?.sync(placed, active);
  }, [placed, active, showcase]);

  return (
    <div ref={host} role="img" aria-label={label} className={`relative overflow-hidden ${className}`}>
      <div
        ref={tip}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap rounded-[3px] bg-ink px-2 py-1 text-xs font-semibold text-paper opacity-0 transition-opacity duration-150"
      />
    </div>
  );
}
