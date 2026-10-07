"use client";

import { useState } from "react";
import { compareCuotas } from "@/lib/cuotas";
import { formatArs } from "@/lib/format";
import { STORES } from "@/lib/stores/meta";
import type { Product } from "@/lib/types";
import { Dot, Segmented } from "./ui";

const PLANES = [3, 6, 12] as const;

/**
 * ¿Contado o cuotas sin interés? Con la inflación que el usuario espera, trae
 * las cuotas a plata de hoy y las compara con el contado, tienda por tienda.
 */
export function Cuotas({ offers }: { offers: Product[] }) {
  const [n, setN] = useState<(typeof PLANES)[number]>(6);
  const [rate, setRate] = useState("2.5");
  const monthly = Math.max(0, Math.min(30, Number(rate.replace(",", ".")) || 0)) / 100;

  const rows = offers.map((p) => {
    const card = p.cardPrice ?? p.price;
    return { p, known: p.cardPrice !== undefined, v: compareCuotas(p.price, card, n, monthly) };
  });
  const bestToday = Math.min(...rows.map((r) => Math.min(r.p.price, r.v.today)));

  return (
    <section aria-labelledby="cuotas-titulo" className="rounded-[4px] border border-rule bg-sheet">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3.5 sm:px-5">
        <h2 id="cuotas-titulo" className="font-bold">
          ¿Contado o cuotas sin interés?
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Cantidad de cuotas"
            value={String(n)}
            onChange={(v) => setN(Number(v) as (typeof PLANES)[number])}
            options={PLANES.map((c) => [String(c), `${c} cuotas`] as [string, string])}
          />
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-2">Inflación</span>
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              className="w-12 rounded-[3px] border border-rule-strong bg-sheet px-1.5 py-1 text-right tabular-nums"
              aria-describedby="cuotas-ayuda"
            />
            <span className="text-ink-2">% mensual</span>
          </label>
        </div>
      </div>

      <ul className="divide-y divide-rule px-4 sm:px-5">
        {rows.map(({ p, known, v }) => {
          const winner = Math.min(p.price, v.today) === bestToday;
          return (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <Dot store={p.store} />
                <span className="truncate">{STORES[p.store].name}</span>
              </span>
              <span className={`text-right font-bold ${v.best === "cuotas" ? "" : "text-ink-2"}`}>
                {v.best === "cuotas" ? "Conviene en cuotas" : "Conviene contado"}
                {winner && <span className="ml-2 rounded-[2px] bg-lime light-scope px-1.5 py-px text-xs text-ink">Mejor opción</span>}
              </span>
              <span className="col-span-2 text-ink-2 tabular-nums">
                Contado {formatArs(p.price)} · {n} × {formatArs(v.cuota)}
                {known ? " con tarjeta" : ""} = {formatArs(v.today)} en plata de hoy
              </span>
            </li>
          );
        })}
      </ul>
      <p id="cuotas-ayuda" className="border-t border-rule px-4 py-3 text-xs text-ink-2 sm:px-5">
        Poné la inflación mensual que esperás: las cuotas fijas se pagan con plata que vale menos cada mes. Usamos el precio
        con tarjeta cuando la tienda lo publica (Compra Gamer); en las demás suponemos el mismo precio que contado.
        Verificá en la tienda qué bancos y cuántas cuotas ofrece.
      </p>
    </section>
  );
}
