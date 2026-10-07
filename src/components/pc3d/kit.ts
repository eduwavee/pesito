import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Piezas reutilizables para los modelos: materiales, texturas dibujadas en canvas
 * y sub-ensambles (ventiladores, aletas). Todo procedural: no hay archivos .glb.
 */

export const COLORS = {
  ink: 0x16171a,
  fluo: 0xff3d8b,
  paper: 0xeef0ea,
};

/* ---------- materiales ---------- */

export function makeMaterials() {
  return {
    steel: new THREE.MeshStandardMaterial({ color: 0x464a53, metalness: 0.7, roughness: 0.36 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x2b2e34, metalness: 0.6, roughness: 0.5 }),
    caseSteel: new THREE.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0.55, roughness: 0.5 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xb9bcc2, metalness: 0.9, roughness: 0.28 }),
    aluDark: new THREE.MeshStandardMaterial({ color: 0x5d626c, metalness: 0.85, roughness: 0.3 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.2, roughness: 0.55 }),
    pcbGreen: new THREE.MeshStandardMaterial({ color: 0x0f2a22, metalness: 0.2, roughness: 0.55 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x303238, metalness: 0.05, roughness: 0.62 }),
    plasticGrey: new THREE.MeshStandardMaterial({ color: 0x5b5f68, metalness: 0.1, roughness: 0.6 }),
    blade: new THREE.MeshStandardMaterial({ color: 0x3a3c42, metalness: 0.15, roughness: 0.4, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.3 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: 0.3, roughness: 0.4 }),
    light: new THREE.MeshStandardMaterial({
      color: 0xf4f5f0,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: 0.4,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdfe6ea,
      metalness: 0,
      roughness: 0.04,
      transparent: true,
      opacity: 0.07,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    }),
  };
}

export type Materials = ReturnType<typeof makeMaterials>;

/* ---------- texturas ---------- */

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Malla perforada del frente del gabinete. */
export function meshTexture() {
  const t = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#4a4e57";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#16171a";
    const step = 16;
    for (let y = 0; y < 256 + step; y += step * 0.86) {
      const row = Math.round(y / (step * 0.86));
      for (let x = row % 2 ? step / 2 : 0; x < 256 + step; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, step * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 10);
  return t;
}

/** Etiqueta impresa (SSD, fuente). */
export function labelTexture(lines: string[], opts: { bg?: string; fg?: string; accent?: string } = {}) {
  return canvasTexture(512, 160, (ctx) => {
    ctx.fillStyle = opts.bg ?? "#f4f5f0";
    ctx.fillRect(0, 0, 512, 160);
    if (opts.accent) {
      ctx.fillStyle = opts.accent;
      ctx.fillRect(0, 0, 18, 160);
    }
    ctx.fillStyle = opts.fg ?? "#16171a";
    ctx.font = "800 56px system-ui, sans-serif";
    ctx.fillText(lines[0] ?? "", 40, 70);
    ctx.font = "500 30px system-ui, sans-serif";
    lines.slice(1).forEach((l, i) => ctx.fillText(l, 40, 112 + i * 34));
  });
}

/* ---------- geometrías ---------- */

export const rbox = (w: number, h: number, d: number, r = 0.02) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01));

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, at: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Ventilador: marco cuadrado con agujero, rotor con aspas curvas.
 * Mira hacia +Z en coordenadas locales. Devuelve el rotor para hacerlo girar.
 */
export function fan(mats: Materials, size = 1, blades = 9) {
  const group = new THREE.Group();
  const r = size * 0.46;

  const frameShape = new THREE.Shape();
  const h = size / 2;
  const c = size * 0.08;
  frameShape.moveTo(-h + c, -h);
  frameShape.lineTo(h - c, -h);
  frameShape.lineTo(h, -h + c);
  frameShape.lineTo(h, h - c);
  frameShape.lineTo(h - c, h);
  frameShape.lineTo(-h + c, h);
  frameShape.lineTo(-h, h - c);
  frameShape.lineTo(-h, -h + c);
  frameShape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, r + size * 0.015, 0, Math.PI * 2, true);
  frameShape.holes.push(hole);
  const frame = mesh(
    new THREE.ExtrudeGeometry(frameShape, { depth: size * 0.22, bevelEnabled: false, curveSegments: 40 }),
    mats.plastic,
  );
  frame.position.z = -size * 0.11;
  group.add(frame);

  const rotor = new THREE.Group();
  const hub = mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.34, size * 0.16, 32), mats.plastic);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  const cap = mesh(new THREE.CircleGeometry(r * 0.3, 32), mats.aluDark, [0, 0, size * 0.081]);
  rotor.add(cap);

  // aspa: un pétalo curvo que barre de la maza al borde
  const blade = new THREE.Shape();
  const r0 = r * 0.3;
  blade.moveTo(r0, -r * 0.08);
  blade.quadraticCurveTo(r * 0.7, -r * 0.32, r * 0.98, -r * 0.12);
  blade.quadraticCurveTo(r * 0.94, r * 0.18, r * 0.6, r * 0.3);
  blade.quadraticCurveTo(r * 0.42, r * 0.22, r0, r * 0.12);
  blade.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: size * 0.012, bevelEnabled: false, curveSegments: 12 });
  for (let i = 0; i < blades; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / blades) * Math.PI * 2;
    const b = mesh(bladeGeo, mats.blade);
    b.rotation.x = 0.42; // ataque del aspa
    pivot.add(b);
    rotor.add(pivot);
  }
  group.add(rotor);
  return { group, rotor };
}

/** Pila de aletas (disipador): `count` placas finas a lo largo de Z. */
export function fins(mat: THREE.Material, w: number, h: number, length: number, count: number) {
  const geo = new THREE.BoxGeometry(w, h, length / count / 3);
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(0, 0, -length / 2 + (i + 0.5) * (length / count));
    inst.setMatrixAt(i, m);
  }
  inst.castShadow = true;
  inst.receiveShadow = true;
  return inst;
}
