"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatArs } from "@/lib/format";
import { STORES } from "@/lib/stores/meta";
import type { StoreId } from "@/lib/types";
import { Dot } from "./ui";

type Point = { day: string; price: number; store: StoreId; title: string; url: string };

const DAY = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDay = (d: string) => DAY.format(new Date(`${d}T00:00:00Z`));

/**
 * Cómo viene el precio: una sola serie (el más barato de cada día entre todas
 * las tiendas), con el mínimo del período marcado y la tienda en el tooltip.
 */
export function Historial({ query, best }: { query: string; best?: number }) {
  const [data, setData] = useState<{ points: Point[]; storage: string } | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/historial?q=${encodeURIComponent(query)}&dias=90`)
      .then((r) => r.json())
      .then((d) => alive && setData({ points: d.points ?? [], storage: d.storage }))
      .catch(() => alive && setData({ points: [], storage: "error" }));
    return () => {
      alive = false;
    };
  }, [query]);

  const points = data?.points ?? [];
  const min = points.length ? points.reduce((a, b) => (b.price < a.price ? b : a)) : undefined;
  const first = points[0];
  const last = points[points.length - 1];
  const change = first && last && points.length > 1 ? (last.price - first.price) / first.price : 0;

  return (
    <section aria-labelledby="historial-titulo" className="rounded-[4px] border border-rule bg-sheet">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-4 py-3.5 sm:px-5">
        <h2 id="historial-titulo" className="font-bold">
          ¿Cómo viene el precio?
        </h2>
        {points.length > 1 && (
          <button type="button" onClick={() => setTable((v) => !v)} className="text-sm font-semibold underline">
            {table ? "Ver gráfico" : "Ver tabla"}
          </button>
        )}
      </div>

      <div className="px-4 py-4 sm:px-5">
        {!data && <div className="h-40 animate-pulse rounded-[3px] bg-rule/50" aria-hidden="true" />}

        {data && points.length < 2 && (
          <p className="text-sm text-ink-2">
            Empezamos a guardar el precio de “{query}” {points.length ? "hoy" : "con esta búsqueda"}: cada día que alguien
            lo busca (o que tenga una alerta) sumamos un punto. Volvé en unos días para ver la tendencia
            {best ? `; hoy el más barato está a ${formatArs(best)}` : ""}.
          </p>
        )}

        {data && points.length >= 2 && (
          <>
            <p className="mb-3 text-sm">
              {change === 0
                ? "Igual que al principio del período."
                : change < 0
                  ? `Bajó ${Math.round(-change * 100)} % desde el ${fmtDay(first.day)}.`
                  : `Subió ${Math.round(change * 100)} % desde el ${fmtDay(first.day)}.`}{" "}
              {min && (
                <span className="text-ink-2">
                  El más bajo fue {formatArs(min.price)} el {fmtDay(min.day)} en {STORES[min.store].name}.
                </span>
              )}
            </p>
            {table ? <Tabla points={points} /> : <Grafico points={points} min={min!} />}
          </>
        )}
      </div>
    </section>
  );
}

function Tabla({ points }: { points: Point[] }) {
  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-sheet text-left text-ink-2">
          <tr>
            <th className="py-1.5 font-normal">Día</th>
            <th className="py-1.5 font-normal">Tienda</th>
            <th className="py-1.5 text-right font-normal">Más barato</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {[...points].reverse().map((p) => (
            <tr key={p.day}>
              <td className="py-1.5">{fmtDay(p.day)}</td>
              <td className="py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Dot store={p.store} /> {STORES[p.store].name}
                </span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatArs(p.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Grafico({ points, min }: { points: Point[]; min: Point }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 180;
  const pad = { l: 8, r: 8, t: 16, b: 26 };
  const { xs, ys, ticks } = useMemo(() => {
    const t0 = Date.parse(points[0].day);
    const t1 = Date.parse(points[points.length - 1].day);
    const lo = Math.min(...points.map((p) => p.price));
    const hi = Math.max(...points.map((p) => p.price));
    const span = hi - lo || hi * 0.1;
    const yLo = lo - span * 0.15;
    const yHi = hi + span * 0.15;
    const x = (d: string) => pad.l + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (w - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - yLo) / (yHi - yLo)) * (H - pad.t - pad.b);
    return {
      xs: points.map((p) => x(p.day)),
      ys: points.map((p) => y(p.price)),
      // con un solo precio en todo el período, una sola línea (no tres encimadas)
      ticks: [...new Set([hi, (hi + lo) / 2, lo])].map((v) => ({ v, y: y(v) })),
    };
  }, [points, w, pad.l, pad.r, pad.t, pad.b]);

  const path = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const iMin = points.indexOf(min);
  const iLast = points.length - 1;
  const h = hover ?? null;

  const onMove = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i;
    setHover(best);
  };

  return (
    <div ref={box} className="relative">
      <svg
        width={w}
        height={H}
        className="block touch-pan-y overflow-visible"
        role="img"
        aria-label={`Precio más bajo por día: de ${formatArs(points[0].price)} a ${formatArs(points[iLast].price)}`}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {/* grilla recesiva con valores */}
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={pad.l} x2={w - pad.r} y1={t.y} y2={t.y} stroke="var(--rule)" strokeWidth="1" />
            <text x={w - pad.r} y={t.y - 4} textAnchor="end" className="fill-ink-3 text-[11px] tabular-nums">
              {formatArs(Math.round(t.v / 100) * 100)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} className="fill-ink-3 text-[11px]">
          {fmtDay(points[0].day)}
        </text>
        <text x={w - pad.r} y={H - 6} textAnchor="end" className="fill-ink-3 text-[11px]">
          {fmtDay(points[iLast].day)}
        </text>

        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* el mínimo del período: lima = el más barato */}
        <circle cx={xs[iMin]} cy={ys[iMin]} r="6" fill="var(--lime)" stroke="var(--ink)" strokeWidth="1.5" />
        {iLast !== iMin && <circle cx={xs[iLast]} cy={ys[iLast]} r="4.5" fill="var(--ink)" stroke="var(--sheet)" strokeWidth="2" />}

        {h !== null && (
          <g pointerEvents="none">
            <line x1={xs[h]} x2={xs[h]} y1={pad.t} y2={H - pad.b} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={xs[h]} cy={ys[h]} r="5" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2" />
          </g>
        )}
      </svg>

      {h !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-[3px] bg-ink px-2.5 py-1.5 text-xs text-paper"
          style={{ left: Math.min(Math.max(xs[h] - 70, 0), w - 150), transform: "translateY(-100%)" }}
        >
          <p className="font-semibold">{fmtDay(points[h].day)}</p>
          <p className="tabular-nums">
            {formatArs(points[h].price)} · {STORES[points[h].store].name}
          </p>
        </div>
      )}
    </div>
  );
}
