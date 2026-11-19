"use client";

import { useEffect, useState } from "react";
import type { Drop } from "@/lib/drops";
import { formatArs } from "@/lib/format";
import { STORES } from "@/lib/stores/meta";
import { Dot, Struck } from "./ui";

const fmtDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

/** "Bajaron de precio": búsquedas cuyo mínimo bajó desde el último registro. Sin bajas no se muestra. */
export function Bajas({ onPick }: { onPick: (q: string) => void }) {
  const [drops, setDrops] = useState<Drop[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/bajas")
      .then((r) => r.json() as Promise<{ drops?: Drop[] }>)
      .then((d) => alive && setDrops(d.drops ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!drops.length) return null;

  return (
    <section className="border-t border-rule" aria-labelledby="bajas-titulo">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-ink pb-3">
          <h2 id="bajas-titulo" className="cartel-num text-[clamp(2.25rem,5vw,3.5rem)] uppercase leading-[0.95]">
            Bajaron de precio
          </h2>
          <p className="max-w-md text-sm text-ink-2">
            El más barato entre todas las tiendas, comparado con el último día que lo registramos.
          </p>
        </div>
        <ul className="divide-y divide-rule">
          {drops.slice(0, 8).map((d, i) => (
            <li key={d.query}>
              <button
                type="button"
                onClick={() => onPick(d.query)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 text-left transition-colors hover:bg-sheet sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-2"
              >
                <span className="min-w-0">
                  <span className="block text-lg font-bold capitalize group-hover:underline">{d.query}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-ink-2">
                    <Dot store={d.store} />
                    <span className="shrink-0">{STORES[d.store].name}</span>
                    <span className="truncate">· {d.title}</span>
                  </span>
                </span>
                <span className="row-span-2 flex flex-col items-end sm:row-span-1">
                  <Struck delay={250 + i * 120} className="cartel-num text-base text-ink-3">
                    {formatArs(d.prevPrice)}
                  </Struck>
                  <span className="cartel-num text-2xl leading-none sm:text-3xl">{formatArs(d.price)}</span>
                </span>
                <span className="text-sm sm:w-36 sm:text-right">
                  <span className="font-bold">−{d.pct}%</span>
                  <span className="text-ink-2"> desde el {fmtDay(d.prevDay)}</span>
                  {d.lowest && <span className="block text-xs font-semibold text-ink-2">el más bajo en 2 semanas</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
