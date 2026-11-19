"use client";

import { useEffect, useState } from "react";
import type { DueloResult } from "@/lib/duelos";
import { articleFor } from "@/lib/perf";
import { formatArs } from "@/lib/format";
import { STORES } from "@/lib/stores/meta";
import type { Product } from "@/lib/types";
import { ArrowIcon, Dot } from "./ui";

/** Duelos destacados con el precio más bajo de hoy de cada lado. */
export function Duelos({ onPick, title }: { onPick: (a: string, b: string) => void; title: string }) {
  const [duelos, setDuelos] = useState<DueloResult[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/duelos")
      .then((r) => r.json() as Promise<{ duelos: DueloResult[] }>)
      .then((d) => alive && setDuelos(d.duelos))
      .catch(() => alive && setDuelos([]));
    return () => {
      alive = false;
    };
  }, []);

  if (duelos && !duelos.length) return null;

  return (
    <section aria-labelledby="duelos-titulo" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-ink pb-3">
        <h2 id="duelos-titulo" className="cartel-num text-[clamp(2.25rem,5vw,3.25rem)] uppercase leading-[0.95]">
          {title}
        </h2>
        <p className="max-w-md text-sm text-ink-2">Las dudas más comunes, con el precio más bajo de hoy de cada lado.</p>
      </div>
      <ul className="divide-y divide-rule" aria-busy={!duelos}>
        {!duelos &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="py-5" aria-hidden="true">
              <div className="h-5 w-2/3 animate-pulse rounded-[3px] bg-rule/60" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded-[3px] bg-rule/40" />
            </li>
          ))}
        {duelos?.map((d) => <Fila key={`${d.a}-${d.b}`} d={d} onPick={onPick} />)}
      </ul>
      <p className="mt-3 text-xs text-ink-2">
        Rendimiento en juegos estimado con una escala propia y aproximada. Solo productos nuevos y del modelo exacto.
      </p>
    </section>
  );
}

function Fila({ d, onPick }: { d: DueloResult; onPick: (a: string, b: string) => void }) {
  const both = d.pa && d.pb;
  const cheaper = both ? (d.pa!.price <= d.pb!.price ? "a" : "b") : undefined;
  const diff = both ? Math.abs(d.pa!.price - d.pb!.price) : 0;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onPick(d.a, d.b);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="group grid w-full grid-cols-1 gap-x-6 gap-y-2 py-5 text-left transition-colors hover:bg-sheet sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] sm:items-center sm:px-2"
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-wide text-ink-2">{d.tema}</span>
          <span className="mt-0.5 block text-xl font-bold group-hover:underline">
            {d.a} <span className="cartel-num px-1 text-ink-3">vs</span> {d.b}
          </span>
          {both && (
            <span className="mt-1 block text-sm">
              {diff === 0 ? (
                "Salen lo mismo"
              ) : (
                <>
                  <strong className="font-semibold">{cheaper === "a" ? d.a : d.b}</strong> sale {formatArs(diff)} menos
                </>
              )}
              {d.perf && (
                <span className="text-ink-2">
                  {" · "}
                  {d.perf === "parecido" ? "rinden parecido" : `${articleFor(d.b).el} ${d.b} rinde ${d.perf}`}
                </span>
              )}
              {d.perGb && (
                <span className="text-ink-2">
                  {" · "}
                  {formatArs(d.perGb[0])} vs {formatArs(d.perGb[1])} por GB
                </span>
              )}
            </span>
          )}
        </span>
        <span className="grid grid-cols-2 gap-4 text-sm">
          <Precio p={d.pa} />
          <Precio p={d.pb} />
        </span>
        <span className="hidden items-center gap-1.5 text-sm font-semibold sm:inline-flex">
          Ver duelo <ArrowIcon />
        </span>
      </button>
    </li>
  );
}

function Precio({ p }: { p?: Product }) {
  if (!p) return <span className="text-ink-3">Sin precio hoy</span>;
  return (
    <span className="min-w-0">
      <span className="cartel-num block text-2xl leading-none">{formatArs(p.price)}</span>
      <span className="mt-1 flex items-center gap-1.5 text-ink-2">
        <Dot store={p.store} /> <span className="truncate">{STORES[p.store].name}</span>
      </span>
    </span>
  );
}
