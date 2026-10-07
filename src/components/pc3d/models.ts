import * as THREE from "three";
import type { PartId } from "@/lib/builder/parts";
import { fan, fins, labelTexture, type Materials, mesh, meshTexture, rbox } from "./kit";

/**
 * Las 7 piezas modeladas a escala (1 unidad ≈ 10 cm) dentro de un mid-tower.
 * Gabinete: x ∈ [-1.1, 1.1] (vidrio en +x), y ∈ [-2.3, 2.3], z ∈ [-2.3, 2.3] (frente en +z).
 */

export interface PartModel {
  group: THREE.Group;
  /** rotores de ventiladores: giran cuando la PC está "prendida" */
  rotors: THREE.Object3D[];
  /** tiras de luz que se encienden con la PC */
  lights: THREE.Mesh[];
  /** desde dónde entra la pieza al armarse */
  from: THREE.Vector3;
}

const MOTHER = { x: -1.0, y: 0.55, z: -0.85 };
const FACE = MOTHER.x + 0.025; // cara del mother que mira al vidrio

export function buildPart(id: PartId, m: Materials): PartModel {
  switch (id) {
    case "case":
      return buildCase(m);
    case "mother":
      return buildMother(m);
    case "cpu":
      return buildCpu(m);
    case "cooler":
      return buildCooler(m);
    case "ram":
      return buildRam(m);
    case "gpu":
      return buildGpu(m);
    case "ssd":
      return buildSsd(m);
    case "psu":
      return buildPsu(m);
  }
}

/* ---------- gabinete ---------- */

function buildCase(m: Materials): PartModel {
  const g = new THREE.Group();
  const rotors: THREE.Object3D[] = [];
  const W = 2.2;
  const H = 4.6;
  const D = 4.6;
  const t = 0.05;

  g.add(mesh(rbox(t, H, D, 0.02), m.caseSteel, [-W / 2, 0, 0])); // lado del mother
  g.add(mesh(rbox(W, t, D, 0.02), m.caseSteel, [0, H / 2, 0])); // techo
  g.add(mesh(rbox(W, t, D, 0.02), m.caseSteel, [0, -H / 2, 0])); // piso
  g.add(mesh(rbox(W, H, t, 0.02), m.caseSteel, [0, 0, -D / 2])); // trasera

  // frente de malla con marco
  const meshMat = new THREE.MeshStandardMaterial({ map: meshTexture(), metalness: 0.6, roughness: 0.5 });
  g.add(mesh(rbox(W + 0.06, H + 0.06, 0.08, 0.04), meshMat, [0, 0, D / 2 + 0.02]));
  g.add(mesh(rbox(W + 0.1, 0.08, 0.12, 0.03), m.steelDark, [0, H / 2 + 0.02, D / 2 + 0.03]));
  g.add(mesh(rbox(W + 0.1, 0.08, 0.12, 0.03), m.steelDark, [0, -H / 2 - 0.02, D / 2 + 0.03]));

  // vidrio templado con marco negro
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.02, H - 0.06, D - 0.06), m.glass);
  glass.position.set(W / 2 + 0.01, 0, 0);
  glass.renderOrder = 10;
  g.add(glass);
  for (const [sy, sz, at] of [
    [0.06, D, [W / 2 + 0.01, H / 2 - 0.03, 0]],
    [0.06, D, [W / 2 + 0.01, -H / 2 + 0.03, 0]],
    [H, 0.06, [W / 2 + 0.01, 0, D / 2 - 0.03]],
    [H, 0.06, [W / 2 + 0.01, 0, -D / 2 + 0.03]],
  ] as const) {
    g.add(mesh(new THREE.BoxGeometry(0.03, sy, sz), m.steelDark, at as unknown as [number, number, number]));
  }

  // patas
  for (const x of [-0.8, 0.8])
    for (const z of [-1.9, 1.9]) g.add(mesh(rbox(0.3, 0.1, 0.4, 0.04), m.plastic, [x, -H / 2 - 0.08, z]));

  // tres ventiladores de entrada al frente y uno de salida atrás
  for (const y of [1.15, 0, -1.15]) {
    const f = fan(m, 1.0);
    f.group.position.set(0.05, y, D / 2 - 0.16);
    f.group.rotation.y = Math.PI; // soplan hacia adentro
    g.add(f.group);
    rotors.push(f.rotor);
  }
  const rear = fan(m, 1.0);
  rear.group.position.set(0.05, 1.35, -D / 2 + 0.16);
  g.add(rear.group);
  rotors.push(rear.rotor);

  // tapas de slots PCIe atrás
  for (let i = 0; i < 6; i++)
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.1, 0.02), m.alu, [-0.55, -0.45 - i * 0.2, -D / 2 + 0.04]));

  return { group: g, rotors, lights: [], from: new THREE.Vector3(0, 0, 0) };
}

/* ---------- motherboard ---------- */

function buildMother(m: Materials): PartModel {
  const g = new THREE.Group();
  const at = (y: number, z: number, x = 0): [number, number, number] => [FACE + x, MOTHER.y + y, MOTHER.z + z];

  g.add(mesh(rbox(0.05, 3.05, 2.44, 0.015), m.pcb, [MOTHER.x, MOTHER.y, MOTHER.z]));

  // socket de CPU con marco y palanca
  g.add(mesh(rbox(0.04, 0.62, 0.62, 0.02), m.alu, at(0.55, 0.15, 0.02)));
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.5, 0.5), m.plastic, at(0.55, 0.15, 0.03)));
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8), m.alu, at(0.55, -0.2, 0.05)));

  // disipadores de VRM y tapa de I/O, con aletas
  const vrmTop = new THREE.Group();
  vrmTop.add(mesh(rbox(0.16, 0.26, 0.9, 0.03), m.aluDark));
  const finTop = fins(m.aluDark, 0.08, 0.22, 0.86, 14);
  finTop.position.x = 0.11;
  vrmTop.add(finTop);
  vrmTop.position.set(...at(1.12, 0.1, 0.08));
  g.add(vrmTop);

  const vrmSide = new THREE.Group();
  vrmSide.add(mesh(rbox(0.16, 1.0, 0.24, 0.03), m.aluDark));
  const finSide = fins(m.aluDark, 0.08, 0.96, 0.22, 6);
  finSide.position.x = 0.11;
  vrmSide.add(finSide);
  vrmSide.position.set(...at(0.5, -0.5, 0.08));
  g.add(vrmSide);

  g.add(mesh(rbox(0.24, 0.95, 0.38, 0.05), m.steel, at(0.95, -1.0, 0.12))); // cubierta I/O
  g.add(mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), m.light, at(0.95, -0.8, 0.25))); // detalle

  // capacitores
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 12), m.aluDark, 10);
  const mat = new THREE.Matrix4();
  for (let i = 0; i < 10; i++) {
    mat.makeRotationZ(Math.PI / 2).setPosition(...at(0.86, -0.32 + i * 0.075, 0.04));
    caps.setMatrixAt(i, mat);
  }
  caps.castShadow = true;
  g.add(caps);

  // 4 slots de memoria con trabas
  for (const z of [0.6, 0.7, 0.8, 0.9]) {
    g.add(mesh(new THREE.BoxGeometry(0.06, 1.36, 0.045), m.plasticGrey, at(0.5, z, 0.03)));
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), m.plasticGrey, at(1.2, z, 0.04)));
  }
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.48, 0.09), m.plastic, at(0.45, 1.13, 0.06))); // 24 pines

  // PCIe x16 blindado + x1, slot M.2, chipset
  g.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 0.95), m.alu, at(-0.55, -0.35, 0.035)));
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.95), m.plasticGrey, at(-1.1, -0.35, 0.025)));
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06), m.plastic, at(-0.2, -0.55, 0.015)));
  g.add(mesh(rbox(0.08, 0.62, 0.7, 0.03), m.aluDark, at(-1.0, 0.65, 0.04)));
  g.add(mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), m.light, at(-1.0, 0.65, 0.09)));

  return { group: g, rotors: [], lights: [], from: new THREE.Vector3(1.4, 0, 0) };
}

/* ---------- procesador ---------- */

function buildCpu(m: Materials): PartModel {
  const g = new THREE.Group();
  const x = FACE + 0.06;
  const y = MOTHER.y + 0.55;
  const z = MOTHER.z + 0.15;
  g.add(mesh(new THREE.BoxGeometry(0.02, 0.48, 0.48), m.pcbGreen, [x, y, z]));
  // IHS con las "orejas" típicas
  const ihs = new THREE.Shape();
  const s = 0.19;
  ihs.moveTo(-s, -s + 0.04);
  ihs.lineTo(-s + 0.04, -s);
  ihs.lineTo(s - 0.04, -s);
  ihs.lineTo(s, -s + 0.04);
  ihs.lineTo(s, s - 0.04);
  ihs.lineTo(s - 0.04, s);
  ihs.lineTo(-s + 0.04, s);
  ihs.lineTo(-s, s - 0.04);
  ihs.closePath();
  const geo = new THREE.ExtrudeGeometry(ihs, {
    depth: 0.04,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    bevelSegments: 2,
  });
  const lid = mesh(geo, m.alu, [x + 0.01, y, z]);
  lid.rotation.y = Math.PI / 2;
  g.add(lid);
  return { group: g, rotors: [], lights: [], from: new THREE.Vector3(1.0, 0, 0) };
}

/* ---------- cooler torre ---------- */

function buildCooler(m: Materials): PartModel {
  const g = new THREE.Group();
  const rotors: THREE.Object3D[] = [];
  const y = MOTHER.y + 0.55;
  const z = MOTHER.z + 0.15;
  const copper = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.32 });

  // base de cobre sobre el procesador y 4 heatpipes que suben a la torre
  g.add(mesh(rbox(0.1, 0.42, 0.42, 0.02), copper, [FACE + 0.13, y, z]));
  for (const dz of [-0.15, -0.05, 0.05, 0.15]) {
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.25, 12), copper, [FACE + 0.7, y + 0.18, z + dz]).rotateZ(Math.PI / 2));
  }

  // torre de aletas: placas finas apiladas a lo largo del eje que sale del mother
  const tower = new THREE.Group();
  const finsGeo = new THREE.BoxGeometry(0.012, 1.2, 0.5);
  const stack = new THREE.InstancedMesh(finsGeo, m.alu, 40);
  const mt = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) {
    mt.makeTranslation(-0.6 + i * 0.031, 0, 0);
    stack.setMatrixAt(i, mt);
  }
  stack.castShadow = true;
  stack.receiveShadow = true;
  tower.add(stack);
  tower.add(mesh(rbox(1.3, 0.06, 0.52, 0.02), m.steelDark, [0, 0.62, 0])); // tapa superior
  tower.position.set(FACE + 0.78, y + 0.2, z);
  g.add(tower);

  // ventilador al costado, soplando hacia atrás
  const f = fan(m, 1.2, 9);
  f.group.position.set(FACE + 0.78, y + 0.2, z + 0.4);
  g.add(f.group);
  rotors.push(f.rotor);

  return { group: g, rotors, lights: [], from: new THREE.Vector3(0, 1.6, 0) };
}

/* ---------- memoria ---------- */

function buildRam(m: Materials): PartModel {
  const g = new THREE.Group();
  const lights: THREE.Mesh[] = [];
  for (const z of [0.7, 0.9]) {
    const stick = new THREE.Group();
    stick.add(mesh(new THREE.BoxGeometry(0.34, 1.3, 0.02), m.pcbGreen));
    // disipador de dos tapas con perfil escalonado
    for (const side of [-1, 1]) {
      stick.add(mesh(rbox(0.32, 1.32, 0.025, 0.01), m.aluDark, [0.01, 0, side * 0.022]));
      stick.add(mesh(rbox(0.06, 1.0, 0.03, 0.01), m.steelDark, [0.1, 0, side * 0.034]));
    }
    const bar = mesh(rbox(0.05, 1.26, 0.07, 0.02), m.light, [0.19, 0, 0]);
    stick.add(bar);
    lights.push(bar);
    stick.position.set(FACE + 0.2, MOTHER.y + 0.5, MOTHER.z + z);
    g.add(stick);
  }
  return { group: g, rotors: [], lights, from: new THREE.Vector3(0, 1.4, 0) };
}

/* ---------- placa de video (montaje vertical, ventiladores al vidrio) ---------- */

function buildGpu(m: Materials): PartModel {
  const g = new THREE.Group();
  const rotors: THREE.Object3D[] = [];
  const lights: THREE.Mesh[] = [];
  const L = 2.7;
  const H = 1.22;
  const card = new THREE.Group();

  // cuerpo: backplate + pila de aletas + carcasa frontal
  card.add(mesh(rbox(0.04, H, L, 0.02), m.alu, [-0.19, 0, 0])); // backplate
  const stack = fins(m.aluDark, 0.26, H - 0.12, L - 0.2, 70);
  stack.position.x = -0.03;
  card.add(stack);

  const shroud = new THREE.Shape();
  const h = H / 2;
  const l = L / 2;
  const ch = 0.18;
  shroud.moveTo(-l, -h + ch);
  shroud.lineTo(-l + ch, -h);
  shroud.lineTo(l - 0.05, -h);
  shroud.lineTo(l, -h + 0.05);
  shroud.lineTo(l, h - ch);
  shroud.lineTo(l - ch, h);
  shroud.lineTo(-l + 0.05, h);
  shroud.lineTo(-l, h - 0.05);
  shroud.closePath();
  const fanR = 0.4;
  for (const zz of [-0.86, 0, 0.86]) {
    const hole = new THREE.Path();
    hole.absarc(zz, 0, fanR + 0.02, 0, Math.PI * 2, true);
    shroud.holes.push(hole);
  }
  const shroudGeo = new THREE.ExtrudeGeometry(shroud, {
    depth: 0.06,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 2,
    curveSegments: 40,
  });
  const front = mesh(shroudGeo, m.steel);
  front.rotation.y = Math.PI / 2; // la forma vive en el plano ZY
  front.position.x = 0.12;
  card.add(front);

  for (const zz of [-0.86, 0, 0.86]) {
    const f = fan(m, fanR * 2.05, 11);
    f.group.rotation.y = Math.PI / 2;
    f.group.position.set(0.1, 0, zz);
    // sin marco cuadrado: el marco es la carcasa
    f.group.children[0].visible = false;
    card.add(f.group);
    rotors.push(f.rotor);
  }

  // tira de luz en el canto superior y bracket trasero
  const bar = mesh(new THREE.BoxGeometry(0.06, 0.03, L * 0.7), m.light, [0.08, h + 0.01, 0.1]);
  card.add(bar);
  lights.push(bar);
  card.add(mesh(new THREE.BoxGeometry(0.42, H + 0.1, 0.03), m.alu, [-0.02, 0, -l - 0.04]));
  card.add(mesh(new THREE.BoxGeometry(0.1, 0.16, 0.14), m.plastic, [0.0, h + 0.05, l * 0.5])); // conector 16 pines

  card.position.set(-0.3, -0.35, -0.45);
  g.add(card);

  // riser del montaje vertical
  g.add(mesh(new THREE.BoxGeometry(0.4, 0.06, 0.5), m.steelDark, [-0.65, -1.0, -1.55]));

  return { group: g, rotors, lights, from: new THREE.Vector3(1.6, 0, 0) };
}

/* ---------- SSD M.2 ---------- */

function buildSsd(m: Materials): PartModel {
  const g = new THREE.Group();
  const x = FACE + 0.03;
  const y = MOTHER.y + 0.05;
  const z = MOTHER.z - 0.1;
  g.add(mesh(new THREE.BoxGeometry(0.015, 0.22, 0.8), m.pcbGreen, [x, y, z]));
  for (const dz of [-0.2, 0.12]) g.add(mesh(new THREE.BoxGeometry(0.02, 0.15, 0.2), m.chip, [x + 0.015, y, z + dz]));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.17),
    new THREE.MeshStandardMaterial({ map: labelTexture(["NVMe", "M.2 2280 · PCIe"]), roughness: 0.8 }),
  );
  label.rotation.y = Math.PI / 2;
  label.position.set(x + 0.027, y, z - 0.02);
  g.add(label);
  g.add(mesh(new THREE.BoxGeometry(0.02, 0.05, 0.05), m.gold, [x, y, z - 0.42]));
  return { group: g, rotors: [], lights: [], from: new THREE.Vector3(0.9, 0, 0) };
}

/* ---------- fuente ---------- */

function buildPsu(m: Materials): PartModel {
  const g = new THREE.Group();
  const rotors: THREE.Object3D[] = [];
  const box = new THREE.Group();
  box.add(mesh(rbox(1.5, 0.86, 1.6, 0.04), m.steelDark));

  // reja del ventilador arriba
  const f = fan(m, 1.05, 7);
  f.group.rotation.x = -Math.PI / 2;
  f.group.position.y = 0.4;
  f.group.children[0].visible = false;
  box.add(f.group);
  rotors.push(f.rotor);
  for (const r of [0.2, 0.32, 0.44]) {
    const ring = mesh(new THREE.TorusGeometry(r, 0.008, 6, 48), m.alu, [0, 0.445, 0]);
    ring.rotation.x = Math.PI / 2;
    box.add(ring);
  }
  for (const a of [0, Math.PI / 2]) {
    const bar = mesh(new THREE.BoxGeometry(0.92, 0.012, 0.012), m.alu, [0, 0.445, 0]);
    bar.rotation.y = a;
    box.add(bar);
  }

  // etiqueta del lado del vidrio y conectores modulares al frente
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.32),
    new THREE.MeshStandardMaterial({
      map: labelTexture(["POWER", "80 PLUS · modular"], { bg: "#1c1d21", fg: "#f4f5f0" }),
      roughness: 0.7,
    }),
  );
  label.rotation.y = Math.PI / 2;
  label.position.set(0.752, 0, 0);
  box.add(label);
  for (let i = 0; i < 4; i++)
    box.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.04), m.plastic, [-0.45 + i * 0.3, -0.1, 0.81]));

  box.position.set(0, -1.85, -1.45);
  g.add(box);
  return { group: g, rotors, lights: [], from: new THREE.Vector3(0, 0, 2.2) };
}
