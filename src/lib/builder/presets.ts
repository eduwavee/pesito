import type { PartId } from "./parts";

export type Use = "gaming" | "oficina" | "edicion";

export const USES: { id: Use; name: string }[] = [
  { id: "gaming", name: "Gaming" },
  { id: "oficina", name: "Oficina y estudio" },
  { id: "edicion", name: "Edición y streaming" },
];

/**
 * Armados de referencia por uso, de menor a mayor. Son búsquedas, no productos:
 * el precio sale en vivo de las tiendas. `null` = no hace falta (gráficos integrados, cooler de caja).
 */
export type Tier = { name: string; queries: Record<PartId, string | null> };

export const TIERS: Record<Use, Tier[]> = {
  gaming: [
    {
      name: "Entrada",
      queries: {
        cpu: "Ryzen 5 5600",
        cooler: null,
        mother: "B550M",
        ram: "DDR4 16GB",
        gpu: "RX 6600",
        ssd: "SSD 500GB",
        psu: "Fuente 550W",
        case: "Gabinete",
      },
    },
    {
      name: "Media",
      queries: {
        cpu: "Ryzen 5 7600",
        cooler: null,
        mother: "B650M",
        ram: "DDR5 16GB",
        gpu: "RTX 5060",
        ssd: "SSD 1TB",
        psu: "Fuente 650W",
        case: "Gabinete",
      },
    },
    {
      name: "Alta",
      queries: {
        cpu: "Ryzen 7 7800X3D",
        cooler: "Cooler CPU",
        mother: "B650",
        ram: "DDR5 32GB",
        gpu: "RTX 5070",
        ssd: "SSD 1TB",
        psu: "Fuente 750W",
        case: "Gabinete",
      },
    },
    {
      name: "Entusiasta",
      queries: {
        cpu: "Ryzen 7 9800X3D",
        cooler: "Cooler CPU",
        mother: "X870",
        ram: "DDR5 32GB",
        gpu: "RTX 5070 Ti",
        ssd: "SSD 2TB",
        psu: "Fuente 850W",
        case: "Gabinete",
      },
    },
  ],
  oficina: [
    {
      name: "Básica",
      queries: {
        cpu: "Ryzen 5 5600G",
        cooler: null,
        mother: "A520M",
        ram: "DDR4 8GB",
        gpu: null,
        ssd: "SSD 480GB",
        psu: "Fuente 500W",
        case: "Gabinete",
      },
    },
    {
      name: "Cómoda",
      queries: {
        cpu: "Ryzen 5 5600G",
        cooler: null,
        mother: "B550M",
        ram: "DDR4 16GB",
        gpu: null,
        ssd: "SSD 1TB",
        psu: "Fuente 550W",
        case: "Gabinete",
      },
    },
    {
      name: "Actual",
      queries: {
        cpu: "Ryzen 5 8600G",
        cooler: null,
        mother: "A620M",
        ram: "DDR5 16GB",
        gpu: null,
        ssd: "SSD 1TB",
        psu: "Fuente 550W",
        case: "Gabinete",
      },
    },
  ],
  edicion: [
    {
      name: "Inicial",
      queries: {
        cpu: "Ryzen 5 7600",
        cooler: null,
        mother: "B650M",
        ram: "DDR5 32GB",
        gpu: "RTX 5060",
        ssd: "SSD 1TB",
        psu: "Fuente 650W",
        case: "Gabinete",
      },
    },
    {
      name: "Pro",
      queries: {
        cpu: "Ryzen 7 7700",
        cooler: null,
        mother: "B650",
        ram: "DDR5 32GB",
        gpu: "RTX 5060 Ti",
        ssd: "SSD 2TB",
        psu: "Fuente 750W",
        case: "Gabinete",
      },
    },
    {
      name: "Estudio",
      queries: {
        cpu: "Ryzen 9 9900X",
        cooler: "Cooler CPU",
        mother: "X870",
        ram: "DDR5 64GB",
        gpu: "RTX 5070 Ti",
        ssd: "SSD 2TB",
        psu: "Fuente 850W",
        case: "Gabinete",
      },
    },
  ],
};

/**
 * Elige el siguiente nivel a probar según cómo quedó el total del anterior.
 * Baja si se pasó; sube si sobró más del 20 % y todavía no probamos el de arriba.
 * Devuelve `undefined` cuando hay que quedarse con el actual.
 */
export function nextTier(
  tiers: Tier[],
  current: number,
  total: number,
  budget: number,
  tried: Set<number>,
): number | undefined {
  if (total > budget) {
    const down = current - 1;
    return down >= 0 && !tried.has(down) ? down : undefined;
  }
  const up = current + 1;
  if (total < budget * 0.8 && up < tiers.length && !tried.has(up)) return up;
  return undefined;
}

/** Primer nivel a probar: el del medio, para converger rápido para arriba o para abajo. */
export const startTier = (tiers: Tier[]) => Math.floor((tiers.length - 1) / 2);
