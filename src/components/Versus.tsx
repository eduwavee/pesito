"use client";

import { useCallback, useEffect, useMemo, useState, ViewTransition } from "react";
import { fitsCategory, type PartId } from "@/lib/builder/parts";
import { searchAll } from "@/lib/client-search";
import { formatArs, formatNum } from "@/lib/format";
import { bestByStore } from "@/lib/race";
import { STORE_COUNT, STORE_IDS, STORES } from "@/lib/stores/meta";
import { isComparable, type Product, type StoreId } from "@/lib/types";
import { isExactModel } from "@/lib/variants";
import { guessKind, isAccessoryTitle, isNotebookTitle, pricePerGb, specsFor, type Kind } from "@/lib/versus";
import { Duelos } from "./Duelos";
import { ArrowIcon, Dot, Footer, ShareButton, Spinner, Tape, TopBar } from "./ui";

type Side = { query: string; products: Product[]; received: StoreId[] };

const EJEMPLOS: [string, string][] = [
  ["RTX 5060", "RX 9060 XT"],
  ["Ryzen 5 7600", "Core i5 14400F"],
  ["SSD 1TB", "SSD 2TB"],
  ["DDR5 16GB", "DDR5 32GB"],
  ["Lenovo LOQ", "HP Victus"],
];

const KIND_PART: Partial<Record<Kind, PartId>> = { gpu: "gpu", cpu: "cpu", ssd: "ssd", ram: "ram", psu: "psu" };

/** Solo lo que realmente es del tipo buscado (sin accesorios ni PCs armadas). */
function clean(kind: Kind, query: string, products: Product[]) {
  const part = KIND_PART[kind];
  // placas y procesadores: el modelo exacto ("RTX 5060" no es una 5060 Ti), como en el resto del sitio
  if (kind === "gpu" || kind === "cpu") return products.filter((p) => fitsCategory(part!, p) && isExactModel(p.title, query));
  if (part) return products.filter((p) => fitsCategory(part, p));
  // notebooks: solo la notebook en sí (no la mochila ni el cargador que también la nombran)
  return products.filter((p) => p.inStock !== false && isComparable(p) && (kind !== "notebook" || !isAccessoryTitle(p.title)));
}

export default function Versus({ initialA = "", initialB = "" }: { initialA?: string; initialB?: string }) {
  const [inputA, setInputA] = useState(initialA);
  const [inputB, setInputB] = useState(initialB);
  const ready = initialA.trim().length >= 2 && initialB.trim().length >= 2;
  const empty = (query: string): Side => ({ query: query.trim(), products: [], received: [] });
  const [a, setA] = useState<Side | null>(() => (ready ? empty(initialA) : null));
  const [b, setB] = useState<Side | null>(() => (ready ? empty(initialB) : null));

  /** Pide a todas las tiendas y va sumando a medida que responden. */
  const fetchSide = useCallback((q: string, set: (fn: (s: Side | null) => Side | null) => void) => {
    const query = q.trim();
    searchAll(query, (r) =>
      set((cur) =>
        cur && cur.query === query && !cur.received.includes(r.store)
          ? { ...cur, products: [...cur.products, ...r.products], received: [...cur.received, r.store] }
          : cur,
      ),
    );
  }, []);

  const run = useCallback(
    (qa: string, qb: string) => {
      if (qa.trim().length < 2 || qb.trim().length < 2) return;
      setInputA(qa);
      setInputB(qb);
      setA(empty(qa));
      setB(empty(qb));
      fetchSide(qa, setA);
      fetchSide(qb, setB);
      const url = new URL(window.location.href);
      url.searchParams.set("a", qa.trim());
      url.searchParams.set("b", qb.trim());
      window.history.replaceState(null, "", url);
    },
    [fetchSide],
  );

  // link compartido (?a=&b=): el estado inicial ya está armado, solo falta pedir
  useEffect(() => {
    if (!ready) return;
    fetchSide(initialA, setA);
    fetchSide(initialB, setB);
  }, [ready, initialA, initialB, fetchSide]);

  const sides = useMemo(
    () =>
      [a, b].map((side) => {
        if (!side) return null;
        // "lenovo loq" no dice qué es: si la mayoría de los resultados son notebooks, es una notebook
        const nb = side.products.filter((p) => isNotebookTitle(p.title)).length;
        const kind: Kind =
          guessKind(side.query) === "otro" && nb > 0 && nb * 2 >= side.products.length
            ? "notebook"
            : guessKind(side.query, side.products[0]?.title);
        const products = clean(kind, side.query, side.products).sort((x, y) => x.price - y.price);
        return {
          ...side,
          kind,
          products,
          best: products[0],
          max: products[products.length - 1],
          perStore: bestByStore(products),
          pending: STORE_IDS.length - side.received.length,
        };
      }),
    [a, b],
  );
  const [sa, sb] = sides;
  const done = sa && sb && sa.pending === 0 && sb.pending === 0;
  const both = sa?.best && sb?.best;
  const cheaper = both ? (sa.best!.price <= sb.best!.price ? sa : sb) : undefined;
  const pricier = cheaper === sa ? sb : sa;
  const diff = both ? Math.abs(sa.best!.price - sb.best!.price) : 0;
  const notebooks = sa?.kind === "notebook" || sb?.kind === "notebook";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-8 sm:px-6">
        <h1 className="cartel-num text-[clamp(2.75rem,7vw,4.5rem)] uppercase leading-[0.95]">Uno contra otro</h1>
        <p className="mt-2 max-w-xl text-ink-2">Dos productos, {STORE_COUNT} tiendas: cuál sale menos y qué te llevás por la diferencia.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(inputA, inputB);
          }}
          className="mt-8 grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
        >
          {(
            [
              ["a", "Primero", inputA, setInputA, "Ej: RTX 5060"],
              ["b", "Segundo", inputB, setInputB, "Ej: RX 9060 XT"],
            ] as const
          ).map(([id, label, value, set, ph], i) => (
            <div key={id} className={`contents`}>
              {i === 1 && (
                <span className="cartel-num hidden pb-2 text-4xl sm:block" aria-hidden="true">
                  vs
                </span>
              )}
              <label className="block">
                <span className="text-sm font-bold">{label}</span>
                <input
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={ph}
                  className="cartel-num mt-1 w-full min-w-0 border-b-[3px] border-ink bg-transparent pb-1 text-3xl uppercase caret-fluo-deep outline-none placeholder:text-ink-3 focus-visible:outline-none"
                />
              </label>
            </div>
          ))}
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-[3px] bg-ink px-5 py-3 font-bold text-paper transition-transform duration-200 ease-out-expo hover:-translate-y-px"
          >
            Comparar <ArrowIcon />
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-2">Probá con</span>
          {EJEMPLOS.map(([x, y]) => (
            <button
              key={x + y}
              type="button"
              onClick={() => run(x, y)}
              className="rounded-full border border-rule-strong bg-sheet px-3 py-1 text-sm font-medium transition-colors hover:border-ink"
            >
              {x} vs {y}
            </button>
          ))}
        </div>

        {sa && sb && (
          <>
            {/* veredicto */}
            <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <ViewTransition name="cartel" share="morph" default="none">
                <article
                  aria-live="polite"
                  className="anim-slap relative rotate-[-1.2deg] rounded-[4px] bg-fluo light-scope p-6 shadow-[0_24px_40px_-24px_rgba(22,23,26,0.6),0_2px_4px_rgba(22,23,26,0.08)] sm:p-8"
                >
                  <Tape className="-top-3 left-10 rotate-[-4deg]" />
                  {cheaper && pricier ? (
                    <>
                      <p className="text-lg font-bold leading-snug">
                        {diff === 0 ? "Salen lo mismo" : `${cheaper.query} sale menos`}
                      </p>
                      <p className="cartel-num mt-3 flex items-start text-[clamp(3.25rem,10vw,5rem)] leading-[0.9]">
                        <span className="mr-1 mt-[0.12em] text-[0.42em]">$</span>
                        {formatNum(diff)}
                        <span aria-hidden="true">.-</span>
                      </p>
                      <p className="mt-3 font-medium">
                        {diff > 0 &&
                          `de diferencia: ${Math.round((diff / pricier.best!.price) * 100)} % menos que ${pricier.query}.`}
                      </p>
                      {done && (
                        <div className="mt-5">
                          <ShareButton
                            title={`${sa.query} vs ${sb.query} en Pesito`}
                            text={`${cheaper.query} sale ${formatArs(diff)} menos que ${pricier.query}`}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold">{done ? "Falta uno de los dos" : "Buscando en las tiendas…"}</p>
                      <p className="cartel-num mt-3 text-[clamp(3.25rem,10vw,5rem)] leading-[0.9] text-ink/30">$ ———.-</p>
                      {done && (
                        <p className="mt-3 text-sm font-medium">
                          No encontramos “{(sa.best ? sb : sa).query}”. Probá con el modelo exacto.
                        </p>
                      )}
                    </>
                  )}
                </article>
              </ViewTransition>

              {/* tabla lado a lado */}
              <div className="overflow-hidden rounded-[4px] border border-rule bg-sheet">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left">
                      <th className="w-[5.5rem] px-3 py-3 font-normal text-ink-3 sm:w-36 sm:px-4" scope="col">
                        <span className="sr-only">Dato</span>
                      </th>
                      {[sa, sb].map((s) => (
                        <th key={s.query} scope="col" className="px-3 py-3 text-base font-bold break-words sm:px-4">
                          <span className="flex items-center gap-2">
                            {s.query}
                            {s.pending > 0 && <Spinner />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    <Row label="Más barato">
                      {[sa, sb].map((s) => (
                        <td key={s.query} className="px-3 py-3 break-words sm:px-4">
                          {s.best ? (
                            <a href={s.best.url} target="_blank" rel="noopener noreferrer" className="group block">
                              <span className="cartel-num text-xl leading-none sm:text-2xl">{formatArs(s.best.price)}</span>
                              {s === cheaper && diff > 0 && (
                                <span className="mt-1 inline-block rounded-[2px] bg-lime light-scope px-1.5 py-px text-xs font-bold sm:ml-2 sm:mt-0">Más barato</span>
                              )}
                              <span className="mt-1 flex items-center gap-1.5 text-ink-2 group-hover:underline">
                                <Dot store={s.best.store} /> {STORES[s.best.store].name}
                              </span>
                            </a>
                          ) : (
                            <span className="text-ink-3">{s.pending ? "buscando…" : "sin resultados"}</span>
                          )}
                        </td>
                      ))}
                    </Row>
                    <Row label="Más caro">
                      {[sa, sb].map((s) => (
                        <td key={s.query} className="px-3 py-3 tabular-nums sm:px-4">
                          {s.max ? formatArs(s.max.price) : "—"}
                        </td>
                      ))}
                    </Row>
                    <Row label="Ofertas">
                      {[sa, sb].map((s) => (
                        <td key={s.query} className="px-3 py-3 tabular-nums sm:px-4">
                          {s.products.length} en {s.perStore.size} {s.perStore.size === 1 ? "tienda" : "tiendas"}
                        </td>
                      ))}
                    </Row>
                    {notebooks && (
                      <Row label="Cuál es">
                        {[sa, sb].map((s) => (
                          <td key={s.query} className="px-3 py-3 break-words text-ink-2 sm:px-4">
                            <span className="line-clamp-3">{s.best?.title ?? "—"}</span>
                          </td>
                        ))}
                      </Row>
                    )}
                    {specRows(sa, sb).map(([label, va, vb]) => (
                      <Row key={label} label={label}>
                        <td className="px-3 py-3 break-words sm:px-4">{va}</td>
                        <td className="px-3 py-3 break-words sm:px-4">{vb}</td>
                      </Row>
                    ))}
                  </tbody>
                </table>
                {notebooks && (
                  <p className="border-t border-rule px-4 py-2.5 text-xs text-ink-2">
                    Datos leídos del título de la más barata de cada lado (“—” es que el título no lo dice). No decimos
                    cuál es mejor: revisá las especificaciones en la tienda antes de comprar.
                  </p>
                )}
              </div>
            </div>

            {/* mínimo por tienda */}
            <section className="mt-12" aria-labelledby="por-tienda">
              <h2 id="por-tienda" className="border-b border-ink pb-3 text-2xl font-bold tracking-tight">
                Tienda por tienda
              </h2>
              <ul className="divide-y divide-rule">
                {STORE_IDS.map((store) => {
                  const pa = sa.perStore.get(store);
                  const pb = sb.perStore.get(store);
                  return (
                    <li key={store} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-6 py-3 text-sm sm:grid-cols-[12rem_1fr_1fr]">
                      <span className="flex items-center gap-2 font-medium">
                        <Dot store={store} /> {STORES[store].name}
                      </span>
                      {[pa, pb].map((p, i) => (
                        <span key={i} className="text-right tabular-nums sm:text-left">
                          {p ? (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              <span className="font-semibold">{formatArs(p.price)}</span>
                              <span className="hidden text-ink-3 sm:inline"> · {i ? sb.query : sa.query}</span>
                            </a>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </span>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}

        <Duelos onPick={run} title={sa && sb ? "Otros duelos" : "Duelos destacados"} />
      </main>
      <Footer />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className="px-3 py-3 text-left font-normal text-ink-2 sm:px-4">
        {label}
      </th>
      {children}
    </tr>
  );
}

type SideData = { kind: Kind; best?: Product };

const SPEC_ORDER = ["Procesador", "Placa de video", "Memoria", "Disco", "Pantalla", "Sistema"];

/** Filas de datos técnicos: la unión de lo que se pudo leer de cada lado. */
function specRows(a: SideData, b: SideData): [string, string, string][] {
  const ra = a.best ? specsFor(a.kind, a.best) : [];
  const rb = b.best ? specsFor(b.kind, b.best) : [];
  // orden fijo (si un lado no tiene un dato, la fila no cambia de lugar)
  const order = (l: string) => {
    const i = SPEC_ORDER.indexOf(l);
    return i < 0 ? SPEC_ORDER.length : i;
  };
  const labels = [...new Set([...ra, ...rb].map((r) => r.label))].sort((x, y) => order(x) - order(y));
  const rows: [string, string, string][] = labels.map((l) => [
    l,
    ra.find((r) => r.label === l)?.value ?? "—",
    rb.find((r) => r.label === l)?.value ?? "—",
  ]);
  if ([a.kind, b.kind].some((k) => k === "ssd" || k === "ram")) {
    const per = (s: SideData) => {
      const v = s.best ? pricePerGb(s.best) : undefined;
      return v ? `${formatArs(v)} / GB` : "—";
    };
    rows.push(["Precio por GB", per(a), per(b)]);
  }
  return rows;
}
