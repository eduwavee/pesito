/**
 * ¿Comprar ahora o esperar? Compara el precio de hoy con lo que vimos en los últimos 30 días
 * (no más: con inflación, una ventana larga haría parecer caro casi cualquier precio de hoy).
 */
export type Verdict = "bueno" | "normal" | "esperar" | "pocos";

export interface Timing {
  verdict: Verdict;
  /** frase para mostrar */
  text: string;
  /** días con precio que usamos para comparar */
  days: number;
}

const WINDOW = 30;
const MIN_DAYS = 4;

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export function buyTiming(points: { day: string; price: number }[], today: number | undefined, todayDay: string): Timing {
  const from = addDays(todayDay, -WINDOW);
  const past = points.filter((p) => p.day < todayDay && p.day >= from).map((p) => p.price);
  if (!today || past.length < MIN_DAYS) {
    return {
      verdict: "pocos",
      days: past.length,
      text: "Todavía no tenemos suficientes días de precios para decirte si es buen momento.",
    };
  }
  const sorted = [...past].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const pct = Math.round(((today - median) / median) * 100);
  const days = past.length;
  if (today <= min) {
    return { verdict: "bueno", days, text: `Es el precio más bajo que vimos en los últimos ${WINDOW} días.` };
  }
  if (pct <= -5) {
    return { verdict: "bueno", days, text: `Está ${-pct} % por debajo de lo normal de las últimas semanas.` };
  }
  if (pct >= 7) {
    return {
      verdict: "esperar",
      days,
      text: `Está ${pct} % por encima de lo normal de las últimas semanas: si no te urge, puede volver a bajar.`,
    };
  }
  return { verdict: "normal", days, text: "Está en su precio normal de las últimas semanas." };
}
