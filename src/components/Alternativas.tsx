"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Alternative } from "@/lib/alternatives";
import { formatArs } from "@/lib/format";
import { articleFor, findPerf } from "@/lib/perf";
import { STORES } from "@/lib/stores/meta";
import { ArrowIcon, Dot } from "./ui";

interface Data {
  model?: string;
  price?: number;
  alternatives: Alternative[];
}

/**
 * "Antes de comprar, mirá": otra placa o procesador que rinde parecido por menos, o bastante
 * más por poco más. Solo para modelos de la tabla de rendimiento; si no hay nada, no se muestra.
 */
export function Alternativas({ query, onPick }: { query: string; onPick: (q: string) => void }) {
  const model = findPerf(query);
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    if (!model) return;
    let alive = true;
    fetch(`/api/alternativas?q=${encodeURIComponent(query)}`)
      .then((r) => r.json() as Promise<Data>)
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [query, model]);

  if (!model || !data?.alternatives.length) return null;
  const base = data.model ?? model.query;

  return (
    <section aria-labelledby="alternativas-titulo" className="anim-rise mt-8 rounded-[4px] border border-rule bg-sheet">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-4 py-3.5 sm:px-5">
        <h2 id="alternativas-titulo" className="font-bold">
          Antes de comprar, mirá
        </h2>
        {data.price !== undefined && (
          <p className="text-sm text-ink-2">
            {articleFor(base).el === "el" ? "El" : "La"} {base} más {articleFor(base).barato} hoy: <strong className="tabular-nums text-ink">{formatArs(data.price)}</strong>
          </p>
        )}
      </div>
      <ul className="divide-y divide-rule">
        {data.alternatives.map((a) => (
          <li key={a.query} className="grid grid-cols-1 gap-x-6 gap-y-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-2">
                {a.delta < 0
                  ? `Rinde ${a.perf} y sale ${formatArs(-a.delta)} menos`
                  : a.delta === 0
                    ? `Rinde ${a.perf} por el mismo precio`
                    : `Por ${formatArs(a.delta)} más, rinde ${a.perf}`}
              </p>
              <p className="mt-0.5 text-xl font-bold">{a.query}</p>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-ink-2">
                <Dot store={a.product.store} />
                <span className="shrink-0">{STORES[a.product.store].name}</span>
                <span className="cartel-num shrink-0 text-base text-ink">{formatArs(a.product.price)}</span>
                <a
                  href={a.product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate underline-offset-2 hover:text-ink hover:underline"
                >
                  {a.product.title}
                </a>
              </p>
              {a.platform && (
                <p className="mt-1 text-sm text-ink-2">
                  Es de otra plataforma ({a.platform}): necesitás otro mother y quizás otra memoria.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onPick(a.query)}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-rule-strong px-3 py-2 text-sm font-semibold hover:border-ink"
              >
                Ver precios <ArrowIcon />
              </button>
              <Link
                href={`/comparar?a=${encodeURIComponent(base)}&b=${encodeURIComponent(a.query)}`}
                className="text-sm font-semibold underline underline-offset-2"
              >
                Comparar
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-rule px-4 py-2.5 text-xs text-ink-2 sm:px-5">
        Rendimiento en juegos estimado con una escala propia y aproximada: sirve para comparar, no son FPS. Precios: los
        más bajos de hoy entre todas las tiendas, solo nuevos y del modelo exacto.
      </p>
    </section>
  );
}
