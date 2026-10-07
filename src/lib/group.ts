import { canonical, queryTokens } from "./text";
import type { Product, StoreId } from "./types";
import { modelOf, VARIANT_WORDS, variantOf } from "./variants";

/**
 * Agrupa el MISMO producto publicado en distintas tiendas ("MSI RTX 5060 Shadow 2X" en Venex,
 * Mexx y Frávega) para comparar precio contra precio y no solo "lo más barato que encontramos".
 *
 * Cada tienda titula a su manera, así que comparamos solo lo que distingue un producto:
 * marca, variante del modelo (5060 vs 5060 Ti), capacidad (8 vs 16 GB) y la línea
 * (Ventus, Shadow, Dual...). Ante la duda NO se agrupa: mejor dos grupos que uno mezclado.
 */

const BRANDS = new Set(
  (
    "msi asus gigabyte aorus palit zotac inno3d pny galax gainward evga sapphire xfx powercolor asrock " +
    "biostar kingston corsair adata xpg crucial hiksemi patriot teamgroup gskill samsung wd seagate " +
    "lexar sandisk kingdian lg aoc viewsonic noblex philips benq lenovo hp dell acer logitech " +
    "redragon hyperx razer apple motorola xiaomi thermaltake coolermaster deepcool lian nzxt " +
    "seasonic xyz sentey"
  ).split(" "),
);
/** fabricantes del chip: cuentan como marca solo si no hay otra ("AMD Ryzen 5 7600") */
const CHIP = new Set(["amd", "intel", "nvidia"]);

/** Palabras que no distinguen un producto de otro. */
const GENERIC = new Set(
  (
    "placa de del video tarjeta grafica geforce radeon procesador micro cpu memoria ram disco solido estado " +
    "interno nvme pcie sata gddr6 gddr6x gddr7 ddr4 ddr5 oc edition con sin para y la el en of the edicion " +
    "nucleos threads hilos turbo ghz mhz gb tb bits bit pci express gen m 2 x16 fan fans ventiladores " +
    "precio contado especial outlet nuevo original oficial garantia negro black iii graphics am4 am5 " +
    "lga1700 lga1851 spring sale hot cyber sodimm white blanco blanca"
  ).split(" "),
);

const FLAGS: Record<string, string> = { sodimm: "sodimm", white: "white", blanco: "white", blanca: "white" };

const capacity = (words: string[]) => words.find((w) => /^\d+(gb|tb)$/.test(w));
/** "2x", "x2", "3x": cantidad de ventiladores, sí distingue modelos */
const isFanCount = (w: string) => /^(\d+x|x\d+)$/.test(w);
/** "6000mb", "5 1ghz", "gen4": especificaciones, cada tienda las escribe o no */
const isSpec = (w: string) => /\d(gb|tb|mb|ghz|mhz|hz|w|mm|cm|ms|v|rpm|mah|kg)$/.test(w) || /^gen\d$/.test(w);
/**
 * Palabras con números que sí identifican un modelo: códigos ("su650", "nv3", "sn350") o
 * números largos ("990", "710"). Los números sueltos cortos ("6/12", "2.5", "3.0") no.
 */
const isModelCode = (w: string) =>
  !isFanCount(w) && !isSpec(w) && (/[a-z]/.test(w) ? /\d/.test(w) : /^\d{3,}$/.test(w));

export interface Fingerprint {
  brand?: string;
  variant?: string;
  capacity?: string;
  fans?: string;
  /** velocidad de memorias: 5200 y 5600 MHz son productos distintos */
  mhz?: string;
  /** marcas que separan sí o sí: memoria de notebook, versión blanca */
  flags: string;
  line: Set<string>;
}

export function fingerprint(title: string, query: string): Fingerprint {
  const words = canonical(title).split(" ");
  const asked = queryTokens(query);
  const brands = words.filter((w) => BRANDS.has(w));
  const chips = words.filter((w) => CHIP.has(w));
  const brand = brands[0] ?? chips[0];
  const model = modelOf(query);
  const line = new Set(
    words.filter(
      (w) =>
        w !== brand &&
        !CHIP.has(w) &&
        !GENERIC.has(w) &&
        !asked.some((t) => w.includes(t)) &&
        !VARIANT_WORDS.has(w) &&
        w.length > 1 &&
        (!/\d/.test(w) || isModelCode(w)),
    ),
  );
  const fans = words.find(isFanCount)?.replace(/\D/g, "");
  const mhz = words.find((w) => /^\d{4}mhz$/.test(w));
  const flags = [...new Set(words.flatMap((w) => FLAGS[w] ?? []))].sort().join(",");
  return { brand, variant: model && variantOf(title, model), capacity: capacity(words), fans, mhz, flags, line };
}

/** true si los dos títulos parecen el mismo producto. */
export function sameProduct(a: Fingerprint, b: Fingerprint): boolean {
  if (a.brand !== b.brand) return false;
  if (a.variant !== b.variant) return false;
  if (a.capacity && b.capacity && a.capacity !== b.capacity) return false;
  if (a.fans && b.fans && a.fans !== b.fans) return false;
  if (a.mhz && b.mhz && a.mhz !== b.mhz) return false;
  if (a.flags !== b.flags) return false;
  // uno sin línea ("AMD Ryzen 5 7600") vs otro con datos de más ("... Wraith Stealth"): mismo producto
  if (!a.line.size || !b.line.size) return true;
  const common = [...a.line].filter((w) => b.line.has(w)).length;
  // más de la mitad en común: "Shadow Plus" vs "Ventus Plus" no alcanza
  return common / Math.min(a.line.size, b.line.size) > 0.5;
}

export interface ProductGroup {
  /** el más barato del grupo (da el título y la foto) */
  best: Product;
  /** la oferta más barata de cada tienda, de menor a mayor */
  offers: Product[];
  /** diferencia entre la tienda más cara y la más barata */
  spread: number;
}

/** Grupos con el mismo producto en 2 o más tiendas, de menor a mayor precio. */
export function groupProducts(products: Product[], query: string): ProductGroup[] {
  const sorted = [...products].sort((a, b) => a.price - b.price);
  const clusters: { fp: Fingerprint; items: Product[] }[] = [];
  for (const p of sorted) {
    const fp = fingerprint(p.title, query);
    // sin marca no hay forma confiable de saber si es el mismo
    if (!fp.brand) continue;
    const c = clusters.find((c) => sameProduct(c.fp, fp));
    if (c) c.items.push(p);
    else clusters.push({ fp, items: [p] });
  }
  const groups: ProductGroup[] = [];
  for (const c of clusters) {
    const byStore = new Map<StoreId, Product>();
    for (const p of c.items) if (!byStore.has(p.store)) byStore.set(p.store, p); // ya vienen ordenados
    if (byStore.size < 2) continue;
    const offers = [...byStore.values()];
    groups.push({ best: offers[0], offers, spread: offers[offers.length - 1].price - offers[0].price });
  }
  return groups;
}
