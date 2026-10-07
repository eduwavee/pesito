/**
 * ¿Contado o cuotas sin interés? Con inflación, pagar en cuotas fijas es pagar
 * con plata que cada mes vale menos. Traemos las cuotas a "plata de hoy"
 * (valor presente) y las comparamos con el precio de contado.
 */

/** Valor de hoy de `n` cuotas iguales que suman `total`, la primera dentro de un mes. */
export function presentValue(total: number, n: number, monthlyRate: number): number {
  if (n <= 1) return total / (1 + monthlyRate);
  const cuota = total / n;
  if (monthlyRate === 0) return total;
  return cuota * ((1 - Math.pow(1 + monthlyRate, -n)) / monthlyRate);
}

export interface CuotasVerdict {
  cuota: number;
  /** lo que valen hoy las cuotas */
  today: number;
  /** cuánto más barato sale lo que conviene */
  saving: number;
  best: "contado" | "cuotas";
}

export function compareCuotas(cash: number, cardTotal: number, n: number, monthlyRate: number): CuotasVerdict {
  const today = presentValue(cardTotal, n, monthlyRate);
  const best = today < cash ? "cuotas" : "contado";
  return { cuota: cardTotal / n, today, saving: Math.abs(cash - today), best };
}

/**
 * Inflación mensual a partir de la anual (o al revés), para que el usuario
 * pueda pensar en el número que conoce.
 */
export const monthlyFromYearly = (yearly: number) => Math.pow(1 + yearly, 1 / 12) - 1;
