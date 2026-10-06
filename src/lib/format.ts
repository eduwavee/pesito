const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export const formatArs = (n: number) => ars.format(n);

export const pctOff = (price: number, list?: number) =>
  list && list > price ? Math.round((1 - price / list) * 100) : 0;
