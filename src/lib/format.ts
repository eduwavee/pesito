const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export const formatArs = (n: number) => ars.format(n);

export const pctOff = (price: number, list?: number) =>
  list && list > price ? Math.round((1 - price / list) * 100) : 0;

const num = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** Solo el número, sin "$", para armar el precio del cartel. */
export const formatNum = (n: number) => num.format(n);
