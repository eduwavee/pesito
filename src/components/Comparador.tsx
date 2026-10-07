"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { formatArs, formatNum, pctOff } from "@/lib/format";
import { groupProducts, type ProductGroup } from "@/lib/group";
import { bestByStore as bestPerStore, raceSteps } from "@/lib/race";
import { modelOf, variantOf, variantsOf, type Variant } from "@/lib/variants";
import { Alerta } from "./Alerta";
import { Cuotas } from "./Cuotas";
import { Historial } from "./Historial";
import { STORE_IDS, STORES } from "@/lib/stores/meta";
import type { Product, StoreId, StoreResult } from "@/lib/types";
import { PcScene } from "./pc3d";
import { useAutocomplete } from "./Sugerencias";
import { ArrowIcon, CheckIcon, Dot, Footer, SearchIcon, Segmented, ShareButton, Spinner, Struck, Tape, TopBar } from "./ui";

type Slot = { state: "idle" } | { state: "loading" } | { state: "done"; result: StoreResult };
type View = "todos" | "productos" | "tiendas";
/** "todas" o la etiqueta de una variante ("5060 Ti"); null = la que corresponde a la búsqueda */
type Pick = string | null;
type Sort = "asc" | "desc";

const SUGERENCIAS = ["RTX 5060", "Ryzen 5 7600", "SSD 1TB NVMe", "Monitor 27 144hz", "Mouse Logitech G502"];

const idleSlots = () => Object.fromEntries(STORE_IDS.map((s) => [s, { state: "idle" }])) as Record<StoreId, Slot>;

const loadingSlots = () => Object.fromEntries(STORE_IDS.map((s) => [s, { state: "loading" }])) as Record<StoreId, Slot>;

const byPrice = (sort: Sort) => (a: Product, b: Product) => (sort === "asc" ? a.price - b.price : b.price - a.price);

export default function Comparador({ initialQuery = "" }: { initialQuery?: string }) {
  const initial = initialQuery.trim().length >= 2 ? initialQuery.trim() : "";
  const [input, setInput] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [slots, setSlots] = useState<Record<StoreId, Slot>>(initial ? loadingSlots : idleSlots);
  // orden en que respondieron las tiendas: arma la "carrera" del cartel
  // etiquetado con el id de la búsqueda: una búsqueda nueva (o repetida por Fast Refresh) empieza de cero
  const [arrivalLog, setArrivalLog] = useState<{ id: number; stores: StoreId[] }>({ id: 0, stores: [] });
  const arrivals = arrivalLog.stores;
  const [enabled, setEnabled] = useState<Record<StoreId, boolean>>(
    () => Object.fromEntries(STORE_IDS.map((s) => [s, true])) as Record<StoreId, boolean>,
  );
  const [view, setView] = useState<View>("todos");
  const [sort, setSort] = useState<Sort>("asc");
  const [onlyFree, setOnlyFree] = useState(false);
  const [variantPick, setVariantPick] = useState<Pick>(null);
  const [didYouMean, setDidYouMean] = useState<{ query: string; fix: string } | null>(null);
  const reqId = useRef(0);

  /** Pide a cada tienda por separado: la que responde primero aparece primero. */
  const fetchAll = useCallback((term: string) => {
    const id = ++reqId.current;
    for (const store of STORE_IDS) {
      fetch(`/api/search/${store}?q=${encodeURIComponent(term)}`)
        .then((r) => r.json() as Promise<StoreResult>)
        .catch((): StoreResult => ({ store, status: "error", products: [], ms: 0, message: "Error de red" }))
        .then((result) => {
          if (id !== reqId.current) return; // respuesta de una búsqueda vieja
          setSlots((prev) => ({ ...prev, [store]: { state: "done", result } }));
          setArrivalLog((prev) =>
            prev.id !== id ? { id, stores: [store] } : prev.stores.includes(store) ? prev : { id, stores: [...prev.stores, store] },
          );
        });
    }
  }, []);

  const runSearch = (q: string) => {
    const term = q.trim();
    if (term.length < 2) return;
    setQuery(term);
    setVariantPick(null);
    setSlots(loadingSlots());
    setArrivalLog({ id: 0, stores: [] });
    const url = new URL(window.location.href);
    url.searchParams.set("q", term);
    window.history.replaceState(null, "", url);
    fetchAll(term);
  };

  const reset = () => {
    reqId.current++;
    setQuery("");
    setVariantPick(null);
    setInput("");
    setSlots(idleSlots());
    setArrivalLog({ id: 0, stores: [] });
    window.history.replaceState(null, "", "/");
  };

  // búsqueda que viene en la URL (?q=...), para poder compartir links
  useEffect(() => {
    if (initial) fetchAll(initial);
  }, [initial, fetchAll]);

  const visible = useMemo(
    () =>
      STORE_IDS.flatMap((s) => {
        const slot = slots[s];
        return slot.state === "done" && enabled[s] ? slot.result.products : [];
      }).filter((p) => !onlyFree || p.freeShipping),
    [slots, enabled, onlyFree],
  );

  // "rtx 5060" trae 5060 y 5060 Ti: por defecto mostramos la variante que se buscó
  const { variants, asked } = useMemo(() => variantsOf(visible, query), [visible, query]);
  const variant = variants.length ? (variantPick ?? asked ?? "todas") : "todas";
  const results = useMemo(() => {
    const model = modelOf(query);
    if (variant === "todas" || !model) return visible;
    return visible.filter((p) => variantOf(p.title, model) === variant);
  }, [visible, variant, query]);
  // el filtro solo aparece si alguna tienda informa el envío
  const shippingKnown = STORE_IDS.some((s) => {
    const slot = slots[s];
    return slot.state === "done" && slot.result.products.some((p) => p.freeShipping);
  });

  const sorted = useMemo(() => [...results].sort(byPrice(sort)), [results, sort]);

  const bestByStore = useMemo(() => bestPerStore(results), [results]);

  const groups = useMemo(() => {
    const g = groupProducts(results, query);
    return sort === "asc" ? g : [...g].reverse();
  }, [results, query, sort]);

  /** Cada vez que una tienda llega con un precio menor, el cartel se tacha y se reescribe. */
  const race = useMemo(() => raceSteps(arrivals, bestByStore), [arrivals, bestByStore]);

  const best = race[race.length - 1];
  const loadingCount = STORE_IDS.filter((s) => slots[s].state === "loading").length;
  const answered = STORE_IDS.length - loadingCount;
  const searched = query !== "";
  const demo = STORE_IDS.some((s) => {
    const slot = slots[s];
    return slot.state === "done" && slot.result.demo;
  });
  const allFailed =
    loadingCount === 0 &&
    STORE_IDS.every(
      (s) => slots[s].state === "done" && (slots[s] as { result: StoreResult }).result.status === "error",
    );
  const nothingFound =
    loadingCount === 0 &&
    !allFailed &&
    STORE_IDS.every((s) => {
      const slot = slots[s];
      return slot.state === "done" && slot.result.products.length === 0;
    });

  // sin resultados en ninguna tienda: ¿fue un error de tipeo?
  useEffect(() => {
    if (!nothingFound) return;
    let alive = true;
    fetch(`/api/sugerencias?q=${encodeURIComponent(query)}&corregir=1`)
      .then((r) => r.json() as Promise<{ didYouMean?: string }>)
      .then((d) => alive && d.didYouMean && setDidYouMean({ query, fix: d.didYouMean }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [nothingFound, query]);
  const suggestion = nothingFound && didYouMean?.query === query ? didYouMean.fix : undefined;

  const pickSuggestion = (s: string) => {
    setInput(s);
    runSearch(s);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar onHome={reset}>
        {searched && (
          <SearchBar input={input} setInput={setInput} onSubmit={() => runSearch(input)} onPick={pickSuggestion} />
        )}
      </TopBar>

      {!searched ? (
        <Home
          input={input}
          setInput={setInput}
          onSubmit={() => runSearch(input)}
          onPick={pickSuggestion}
        />
      ) : (
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-20 sm:px-6">
          <h1 className="sr-only">Precios para “{query}”</h1>

          <StoreRail slots={slots} enabled={enabled} toggle={(s) => setEnabled((p) => ({ ...p, [s]: !p[s] }))} />

          {variants.length > 0 && (
            <VariantPicker variants={variants} value={variant} asked={asked} onChange={setVariantPick} />
          )}

          {/* Veredicto: el cartel + el mínimo por tienda */}
          <section
            aria-label="Resumen"
            className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8"
          >
            <div className="min-w-0 space-y-8">
              <Cartel
                key={query}
                best={best}
                history={race.slice(0, -1)}
                answered={answered}
                total={STORE_IDS.length}
                allFailed={allFailed}
                demo={demo}
              />
              <Llegadas arrivals={arrivals} slots={slots} />
            </div>
            <div className="min-w-0 space-y-6">
              <PorTienda
                query={query}
                slots={slots}
                enabled={enabled}
                bestByStore={bestByStore}
                results={results}
                winner={best}
                demo={demo}
              />
              {bestByStore.size > 0 && <Cuotas offers={[...bestByStore.values()].sort((a, b) => a.price - b.price)} />}
            </div>
          </section>

          {/* Historial + alerta de precio */}
          {!demo && (
            <section aria-label="Seguimiento" className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <Historial key={`h-${query}`} query={query} best={best?.price} />
              <Alerta key={`a-${query}-${best ? "b" : "n"}`} query={query} best={best?.price} />
            </section>
          )}

          {/* Controles */}
          <div className="mt-12 flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {results.length} {results.length === 1 ? "oferta" : "ofertas"}
              <span className="font-normal text-ink-2"> para “{query}”</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {shippingKnown && (
                <button
                  type="button"
                  aria-pressed={onlyFree}
                  onClick={() => setOnlyFree((v) => !v)}
                  className={`rounded-[3px] border px-3 py-1.5 text-sm font-medium transition-colors ${
                    onlyFree ? "border-ink bg-ink text-paper" : "border-rule-strong bg-sheet text-ink-2 hover:text-ink"
                  }`}
                >
                  Solo envío gratis
                </button>
              )}
              <Segmented
                label="Vista"
                value={view}
                onChange={setView}
                options={[
                  ["todos", "Todas"],
                  ["productos", "Mismo producto"],
                  ["tiendas", "Por tienda"],
                ]}
              />
              <Segmented
                label="Orden"
                value={sort}
                onChange={setSort}
                options={[
                  ["asc", "Menor precio"],
                  ["desc", "Mayor precio"],
                ]}
              />
            </div>
          </div>

          {/* Resultados */}
          {view === "productos" ? (
            <Grupos groups={groups} loading={loadingCount > 0} />
          ) : view === "todos" ? (
            <ul className="divide-y divide-rule">
              {sorted.map((p) => (
                <ResultRow key={p.id} p={p} best={best} />
              ))}
              {loadingCount > 0 && sorted.length === 0 && Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)}
            </ul>
          ) : (
            <div className="space-y-10 pt-6">
              {STORE_IDS.filter((s) => enabled[s]).map((s) => {
                const slot = slots[s];
                const items = slot.state === "done" ? [...slot.result.products].sort(byPrice(sort)) : [];
                return (
                  <section key={s} aria-labelledby={`grupo-${s}`}>
                    <h3
                      id={`grupo-${s}`}
                      className="flex items-baseline gap-2 border-b border-rule pb-2 text-lg font-bold"
                    >
                      <Dot store={s} className="self-center" /> {STORES[s].name}
                      <span className="text-sm font-normal text-ink-2">
                        {slot.state === "loading"
                          ? "buscando…"
                          : `${items.length} ${items.length === 1 ? "oferta" : "ofertas"}`}
                      </span>
                    </h3>
                    <ul className="divide-y divide-rule">
                      {slot.state === "loading" && Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} />)}
                      {items.map((p) => (
                        <ResultRow key={p.id} p={p} best={best} />
                      ))}
                    </ul>
                    {slot.state === "done" && slot.result.status !== "ok" && (
                      <p className={`pt-3 text-sm ${slot.result.status === "error" ? "text-alert" : "text-ink-2"}`}>
                        {slot.result.status === "error"
                          ? `${STORES[s].name} no respondió${slot.result.message ? `: ${slot.result.message}` : ""}.`
                          : "Sin resultados para esta búsqueda."}{" "}
                        <a
                          href={STORES[s].search(query)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whitespace-nowrap font-medium text-ink underline underline-offset-2"
                        >
                          Buscar en {STORES[s].name} ↗
                        </a>
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {loadingCount === 0 && results.length === 0 && !allFailed && (
            <div className="py-16 text-center">
              <p className="text-2xl font-bold tracking-tight">No encontramos “{query}”.</p>
              {suggestion ? (
                <p className="mt-3 text-lg">
                  ¿Quisiste decir{" "}
                  <button
                    type="button"
                    onClick={() => pickSuggestion(suggestion)}
                    className="font-bold underline decoration-fluo decoration-[3px] underline-offset-4 hover:decoration-ink"
                  >
                    {suggestion}
                  </button>
                  ?
                </p>
              ) : (
                <p className="mt-2 text-ink-2">
                  Probá con menos palabras o con el modelo exacto, por ejemplo “RTX 5060”.
                </p>
              )}
            </div>
          )}
        </main>
      )}

      <Footer />
    </div>
  );
}

/* ---------- Estructura ---------- */

function SearchBar({
  input,
  setInput,
  onSubmit,
  onPick,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  onPick: (v: string) => void;
}) {
  const ac = useAutocomplete({ input, setInput, onPick });
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xl">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          ac.close();
          onSubmit();
        }}
        className="flex min-w-0 items-stretch overflow-hidden rounded-[3px] bg-sheet text-ink ring-fluo focus-within:ring-[3px]"
      >
        <label htmlFor="q-top" className="sr-only">
          Producto a buscar
        </label>
        <span className="grid place-items-center pl-3 text-ink-3">
          <SearchIcon />
        </span>
        <input
          id="q-top"
          type="search"
          value={input}
          {...ac.inputProps}
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-base outline-none placeholder:text-ink-3"
          placeholder="Buscar otro producto"
          enterKeyHint="search"
        />
        <button
          type="submit"
          disabled={input.trim().length < 2}
          className="bg-fluo light-scope px-4 text-sm font-bold text-ink transition-[filter] hover:brightness-110 disabled:bg-rule disabled:text-ink-3"
        >
          Comparar
        </button>
      </form>
      {ac.list}
    </div>
  );
}

function Home({
  input,
  setInput,
  onSubmit,
  onPick,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  onPick: (s: string) => void;
}) {
  const [tooShort, setTooShort] = useState(false);
  const ac = useAutocomplete({
    input,
    setInput: (v) => {
      setInput(v);
      setTooShort(false);
    },
    onPick,
  });
  return (
    <main className="flex-1">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 content-center gap-10 px-4 py-10 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-x-16 lg:gap-y-8">
        <div className="relative min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
          <HangingTag />
          <h1 className="cartel-num text-balance text-[clamp(3.25rem,9vw,6rem)] uppercase leading-[0.97]">
            ¿Dónde está más barato?
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">
            Escribí el componente una vez. Lo buscamos en vivo en siete tiendas argentinas y te dejamos el cartel con el
            precio más bajo.
          </p>
        </div>

        {/* el cartel en blanco, esperando que lo escribas */}
        <ViewTransition name="cartel" share="morph" default="none">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim().length < 2) return setTooShort(true);
              ac.close();
              onSubmit();
            }}
            className="relative min-w-0 rotate-[-1.5deg] rounded-[4px] bg-fluo light-scope p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center shadow-[0_24px_40px_-24px_rgba(22,23,26,0.6),0_2px_4px_rgba(22,23,26,0.08)] sm:p-9"
          >
            <Tape className="-top-3.5 left-1/2 -translate-x-1/2 rotate-[3deg]" />
            <label htmlFor="q-home" className="block text-xl font-bold leading-tight">
              ¿Qué estás buscando?
            </label>
            <div className="relative">
              <input
                id="q-home"
                type="search"
                value={input}
                {...ac.inputProps}
                placeholder="Ej: RTX 5060"
                className="cartel-num mt-4 w-full min-w-0 border-b-[3px] border-ink bg-transparent pb-2 text-[clamp(2rem,6vw,3.25rem)] uppercase leading-none caret-ink outline-none transition-shadow placeholder:text-ink/80 focus:shadow-[0_4px_0_var(--ink)] focus-visible:outline-none"
                autoFocus
                enterKeyHint="search"
              />
              {ac.list}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-6 py-3.5 font-bold text-paper transition-transform duration-200 ease-out-expo hover:-translate-y-px active:translate-y-0"
              >
                Comparar precios <ArrowIcon />
              </button>
              <p className="text-sm font-semibold" aria-live="polite">
                {tooShort && "Escribí al menos 2 letras."}
              </p>
            </div>

            <div className="mt-8 border-t-2 border-dashed border-ink/30 pt-5">
              <p className="text-sm font-semibold">Probá con</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onPick(s)}
                    className="rounded-full border-[1.5px] border-ink px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-fluo"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </ViewTransition>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
          <ul className="flex max-w-lg flex-wrap gap-x-5 gap-y-2.5" aria-label="Tiendas consultadas">
            {STORE_IDS.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm font-medium">
                <Dot store={s} /> {STORES[s].name}
              </li>
            ))}
          </ul>

          {/* cómo se ve la carrera, con precios de mentira */}
          <figure className="mt-10 flex max-w-lg items-center gap-4 border-t border-rule pt-5 text-ink-2">
            <figcaption className="shrink-0 text-sm">Así se corrige el cartel:</figcaption>
            <div className="relative flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <Struck delay={350} className="cartel-num text-xl text-ink-3">
                $ 437.100.-
              </Struck>
              <Struck delay={850} className="cartel-num text-xl text-ink-3">
                $ 392.600.-
              </Struck>
              <span className="cartel-num text-3xl text-ink">$ 384.500.-</span>
              <Marker />
            </div>
          </figure>
        </div>
      </div>

      <ArmaBand />
    </main>
  );
}

/** Etiqueta de precio colgando de un hilo, sobre el título. */
function HangingTag() {
  return (
    <svg
      className="anim-swing pointer-events-none absolute -top-14 right-0 hidden w-14 sm:block lg:-right-12 lg:-top-24"
      viewBox="0 0 64 112"
      aria-hidden="true"
    >
      <path d="M32 0 C 30 14, 34 22, 32 34" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      <path
        d="M14 46 L32 30 L50 46 V104 a4 4 0 0 1 -4 4 H18 a4 4 0 0 1 -4 -4 Z"
        fill="var(--sheet)"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="42" r="4" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
      <text x="32" y="86" textAnchor="middle" className="cartel-num" fontSize="30" fill="var(--ink)">
        $
      </text>
    </svg>
  );
}

/** Fibrón que cruza el ejemplo mientras tacha los precios viejos. */
function Marker() {
  return (
    <svg className="anim-marker pointer-events-none absolute -top-5 w-24" viewBox="0 0 96 26" aria-hidden="true">
      <g transform="rotate(-14 48 13)">
        <path d="M6 13 L16 8 H22 V18 H16 Z" fill="var(--ink)" />
        <rect x="22" y="6" width="50" height="14" rx="3" fill="var(--ink)" />
        <rect x="70" y="5" width="22" height="16" rx="4" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="1.5" />
        <rect x="30" y="10" width="26" height="2.5" rx="1.25" fill="var(--paper)" opacity="0.5" />
      </g>
    </svg>
  );
}

/** Puente al armado: la PC en 3D se arma sola cuando entra en pantalla. */
function ArmaBand() {
  return (
    <section className="border-t border-rule bg-sheet" aria-labelledby="arma-titulo">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-20">
        <div>
          <h2 id="arma-titulo" className="cartel-num text-[clamp(2.5rem,6vw,4.25rem)] uppercase leading-[0.95]">
            ¿Armando una PC?
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-2">
            Elegí pieza por pieza al mejor precio, o decinos cuánto querés gastar. Te avisamos si el procesador no entra
            en el mother o si la fuente no alcanza.
          </p>
          <Link
            href="/armar"
            className="mt-7 inline-flex items-center gap-2 rounded-[3px] bg-ink px-6 py-3.5 font-bold text-paper transition-transform duration-200 ease-out-expo hover:-translate-y-px"
          >
            Armar mi PC <ArrowIcon />
          </Link>
        </div>
        <PcScene showcase placed={{}} className="h-72 sm:h-96" label="Modelo 3D de una PC armándose pieza por pieza" />
      </div>
    </section>
  );
}

/* ---------- Veredicto ---------- */

function Cartel({
  best,
  history,
  answered,
  total,
  allFailed,
  demo,
}: {
  best?: Product;
  history: Product[];
  answered: number;
  total: number;
  allFailed: boolean;
  demo: boolean;
}) {
  const waiting = answered < total;
  return (
    <article
      aria-label="Precio más bajo"
      className="anim-slap relative rotate-[-1.2deg] rounded-[4px] bg-fluo light-scope p-6 shadow-[0_24px_40px_-24px_rgba(22,23,26,0.6),0_2px_4px_rgba(22,23,26,0.08)] sm:p-8"
    >
      <Tape className="-top-3 left-10 rotate-[-4deg]" />
      {best ? (
        <>
          <p className="flex items-center gap-2 text-lg font-bold leading-tight">
            Más barato en
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sheet px-2.5 py-0.5 text-base">
              <Dot store={best.store} /> {STORES[best.store].name}
            </span>
          </p>
          {demo && <DemoNote />}

          {history.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1" aria-label="Precios que fue superando">
              {history.map((h) => (
                <li key={h.id}>
                  <Struck className="cartel-num text-xl text-ink/70">
                    <span className="sr-only">Antes: </span>${formatNum(h.price)}.-
                  </Struck>
                </li>
              ))}
            </ul>
          )}

          <p
            key={best.id}
            className="anim-write cartel-num mt-2 flex items-start text-[clamp(3.75rem,13vw,6rem)] leading-[0.9]"
          >
            <span className="mr-1 mt-[0.12em] text-[0.42em]">$</span>
            {formatNum(best.price)}
            <span aria-hidden="true">.-</span>
          </p>

          <a
            href={best.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 line-clamp-2 max-w-md font-medium leading-snug underline decoration-ink/40 hover:decoration-ink"
          >
            {best.title}
          </a>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <a
              href={best.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-5 py-3 font-bold text-paper transition-transform duration-200 ease-out-expo hover:-translate-y-px"
            >
              Ver en {STORES[best.store].name} <ArrowIcon />
            </a>
            {waiting ? (
              <p className="text-sm font-medium" aria-live="polite">
                Respondieron {answered} de {total} tiendas…
              </p>
            ) : (
              <ShareButton
                title={`${best.title} en Pesito`}
                text={`${best.title}: ${formatArs(best.price)} en ${STORES[best.store].name}`}
                quiet
              />
            )}
          </div>
        </>
      ) : (
        <div aria-live="polite">
          <p className="text-lg font-bold">
            {allFailed
              ? "No pudimos consultar ninguna tienda"
              : waiting
                ? "Escribiendo el cartel…"
                : "Sin precios para mostrar"}
          </p>
          <p
            className={`cartel-num mt-3 text-[clamp(3.75rem,13vw,6rem)] leading-[0.9] ${waiting ? "animate-pulse text-ink/30" : "text-ink/30"}`}
            aria-hidden="true"
          >
            $ ———.-
          </p>
          <p className="mt-5 text-sm font-medium">
            {allFailed
              ? "Puede ser un corte momentáneo. Probá de nuevo en un rato."
              : waiting
                ? `Respondieron ${answered} de ${total} tiendas…`
                : "Ninguna tienda tiene este producto. Probá con menos palabras."}
          </p>
        </div>
      )}
    </article>
  );
}

function DemoNote() {
  return (
    <p className="mt-3 inline-block rounded-[2px] bg-sheet px-2 py-1 text-xs font-semibold">
      Modo demo: precios de ejemplo, no reales
    </p>
  );
}

const seg = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Orden de llegada de cada tienda: la carrera queda a la vista aunque haya ganado la primera. */
function Llegadas({ arrivals, slots }: { arrivals: StoreId[]; slots: Record<StoreId, Slot> }) {
  const pending = STORE_IDS.filter((s) => !arrivals.includes(s));
  return (
    <div className="px-1">
      <h2 className="text-sm font-bold">Cómo fueron llegando las tiendas</h2>
      <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:gap-x-6">
        {arrivals.map((s, i) => {
          const slot = slots[s];
          const r = slot.state === "done" ? slot.result : undefined;
          return (
            <li key={s} className="anim-rise flex items-baseline gap-2">
              <span className="cartel-num w-6 shrink-0 text-base">{i + 1}°</span>
              <Dot store={s} className="self-center" />
              <span className="min-w-0 truncate font-medium">{STORES[s].name}</span>
              <span className={`ml-auto shrink-0 tabular-nums ${r?.status === "error" ? "text-alert" : "text-ink-2"}`}>
                {r?.status === "error"
                  ? "no respondió"
                  : r?.cached
                    ? "al instante"
                    : r
                      ? `${seg.format(r.ms / 1000)} s`
                      : ""}
              </span>
            </li>
          );
        })}
        {pending.map((s) => (
          <li key={s} className="flex items-baseline gap-2 text-ink-2">
            <span className="w-6 shrink-0">–</span>
            <Dot store={s} className="self-center opacity-50" />
            <span className="min-w-0 truncate">{STORES[s].name}</span>
            <span className="ml-auto shrink-0">esperando…</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Una fila por tienda: todas sus ofertas como puntos sobre un mismo eje de precio. */
function PorTienda({
  query,
  slots,
  enabled,
  bestByStore,
  results,
  winner,
  demo,
}: {
  query: string;
  slots: Record<StoreId, Slot>;
  enabled: Record<StoreId, boolean>;
  bestByStore: Map<StoreId, Product>;
  results: Product[];
  winner?: Product;
  demo: boolean;
}) {
  const prices = results.map((p) => p.price);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const x = (price: number) => (max === min ? 50 : ((price - min) / (max - min)) * 100);

  const mins = [...bestByStore.values()].map((p) => p.price);
  const ahorro = mins.length > 1 ? Math.max(...mins) - Math.min(...mins) : 0;

  const rows = [...STORE_IDS].sort((a, b) => {
    const pa = bestByStore.get(a)?.price ?? Infinity;
    const pb = bestByStore.get(b)?.price ?? Infinity;
    return pa - pb;
  });

  return (
    <div className="rounded-[4px] border border-rule bg-sheet">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-4 py-3.5 sm:px-5">
        <h2 className="font-bold">Precio más bajo por tienda</h2>
        <p className="truncate text-sm text-ink-2">
          “{query}”{demo && " · precios de ejemplo"}
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 sm:grid-cols-[minmax(6.5rem,8.5rem)_minmax(0,1fr)_auto] sm:px-5">
        {/* eje: en mobile ocupa su propia línea */}
        <span className="order-1 pt-3 text-xs text-ink-3">Tienda</span>
        <span
          className="order-3 col-span-2 flex justify-between gap-2 pb-1 pt-1 text-xs tabular-nums text-ink-3 sm:order-2 sm:col-span-1 sm:pb-0 sm:pt-3"
          aria-hidden="true"
        >
          {prices.length > 0 && (
            <>
              <span>{formatArs(min)}</span>
              <span>{formatArs(max)}</span>
            </>
          )}
        </span>
        <span className="order-2 pt-3 text-right text-xs text-ink-3 sm:order-3">Mínimo</span>

        {rows.map((s) => {
          const slot = slots[s];
          const own = bestByStore.get(s);
          const offers = enabled[s] ? results.filter((p) => p.store === s) : [];
          const isWinner = own && winner && own.id === winner.id;
          let status: React.ReactNode = null;
          if (!enabled[s]) status = <span className="text-ink-3">oculta</span>;
          else if (slot.state === "loading") status = <span className="text-ink-3">buscando…</span>;
          else if (slot.state === "done" && slot.result.status === "error")
            status = <span className="text-alert">no respondió</span>;
          else if (!own) status = <span className="text-ink-3">sin resultados</span>;

          return (
            <div
              key={s}
              className="order-4 col-span-2 grid grid-cols-subgrid items-center gap-y-1.5 border-t border-rule py-2.5 sm:col-span-3"
            >
              <span className={`flex min-w-0 items-center gap-2 text-sm font-medium ${enabled[s] ? "" : "text-ink-3"}`}>
                <Dot store={s} />
                <span className="truncate">{STORES[s].name}</span>
              </span>

              <span className="relative order-last col-span-2 h-5 sm:order-none sm:col-span-1" aria-hidden="true">
                <span className="absolute inset-x-0 top-1/2 h-px bg-rule" />
                {slot.state === "loading" && enabled[s] && (
                  <span className="absolute inset-y-1.5 left-0 w-1/3 animate-pulse rounded-full bg-rule" />
                )}
                {offers.map((p) => {
                  const top = own && p.id === own.id;
                  return (
                    <span
                      key={p.id}
                      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-sheet ${top ? "size-3.5" : "size-2 opacity-60"}`}
                      style={{ left: `${x(p.price)}%`, background: STORES[s].color }}
                    />
                  );
                })}
                {isWinner && own && (
                  <span
                    className="absolute top-1/2 size-[1.375rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-lime ring-1 ring-ink"
                    style={{ left: `${x(own.price)}%` }}
                  />
                )}
              </span>

              <span className="text-right text-sm">
                {own && enabled[s] ? (
                  <a
                    href={own.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-col items-end hover:underline"
                  >
                    <span className={`tabular-nums ${isWinner ? "font-extrabold" : "font-semibold"}`}>
                      {formatArs(own.price)}
                    </span>
                    <span className="text-xs tabular-nums text-ink-2">
                      {isWinner ? "el más barato" : winner ? `+${formatArs(own.price - winner.price)}` : ""}
                    </span>
                  </a>
                ) : (
                  status
                )}
              </span>
            </div>
          );
        })}
      </div>

      {ahorro > 0 && (
        <p className="m-2 rounded-[3px] bg-lime light-scope px-3 py-2.5 text-sm font-medium">
          Elegir bien te ahorra hasta <strong className="font-extrabold tabular-nums">{formatArs(ahorro)}</strong>{" "}
          frente a la tienda más cara.
        </p>
      )}
    </div>
  );
}

/* ---------- Tiendas ---------- */

function StoreRail({
  slots,
  enabled,
  toggle,
}: {
  slots: Record<StoreId, Slot>;
  enabled: Record<StoreId, boolean>;
  toggle: (s: StoreId) => void;
}) {
  return (
    <section aria-label="Filtrar por tienda" className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {STORE_IDS.map((s) => {
          const slot = slots[s];
          const on = enabled[s];
          let info: React.ReactNode = null;
          if (slot.state === "loading") info = <Spinner />;
          if (slot.state === "done") {
            const r = slot.result;
            info =
              r.status === "error" ? (
                <span className="text-alert">error</span>
              ) : (
                <span className="tabular-nums text-ink-2">{r.products.length}</span>
              );
          }
          const title =
            slot.state === "done"
              ? (slot.result.message ??
                `Respondió en ${slot.result.ms} ms${slot.result.cached ? " (desde cache)" : ""}`)
              : undefined;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => toggle(s)}
                title={title}
                aria-pressed={on}
                className={`flex items-center gap-2 whitespace-nowrap rounded-[3px] border px-3 py-2 text-sm font-medium transition-colors ${
                  on
                    ? "border-rule-strong bg-sheet hover:border-ink"
                    : "border-dashed border-rule-strong text-ink-3 hover:text-ink"
                }`}
              >
                <span
                  className={`grid size-4 place-items-center rounded-[2px] border-[1.5px] ${on ? "border-ink bg-ink text-paper" : "border-rule-strong"}`}
                  aria-hidden="true"
                >
                  {on && <CheckIcon />}
                </span>
                <Dot store={s} />
                {STORES[s].name}
                {info}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- Variantes ---------- */

/** "RTX 5060" vs "RTX 5060 Ti": son otro producto y otro precio, se eligen acá. */
function VariantPicker({
  variants,
  value,
  asked,
  onChange,
}: {
  variants: Variant[];
  value: string;
  asked?: string;
  onChange: (v: string) => void;
}) {
  const chip = (key: string, label: React.ReactNode, sub: string) => (
    <li key={key}>
      <button
        type="button"
        aria-pressed={value === key}
        onClick={() => onChange(key)}
        className={`flex flex-col items-start rounded-[3px] border px-3 py-1.5 text-left transition-colors ${
          value === key ? "border-ink bg-ink text-paper" : "border-rule-strong bg-sheet hover:border-ink"
        }`}
      >
        <span className="text-sm font-bold">{label}</span>
        <span className={`text-xs tabular-nums ${value === key ? "text-paper/75" : "text-ink-2"}`}>{sub}</span>
      </button>
    </li>
  );
  const total = variants.reduce((n, v) => n + v.count, 0);
  return (
    <section aria-label="Elegir modelo" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 className="text-sm font-bold">
        Encontramos {variants.length} modelos{asked ? "" : " parecidos"}:
      </h2>
      <ul className="flex flex-wrap gap-2">
        {variants.map((v) =>
          chip(
            v.label,
            <>
              {v.label}
              {v.label === asked && <span className="sr-only"> (lo que buscaste)</span>}
            </>,
            `desde ${formatArs(v.minPrice)} · ${v.count}`,
          ),
        )}
        {chip("todas", "Todos", `${total} ofertas`)}
      </ul>
    </section>
  );
}

/* ---------- Mismo producto en varias tiendas ---------- */

function Grupos({ groups, loading }: { groups: ProductGroup[]; loading: boolean }) {
  if (!groups.length) {
    return (
      <p className="py-12 text-center text-ink-2">
        {loading
          ? "Esperando que respondan las tiendas…"
          : "No encontramos el mismo producto en más de una tienda. Mirá la vista “Todas”."}
      </p>
    );
  }
  return (
    <div className="pt-4">
      <p className="text-sm text-ink-2">
        {groups.length} {groups.length === 1 ? "producto está" : "productos están"} en 2 o más tiendas. Agrupamos por
        marca y modelo leyendo el título: verificá que sea el mismo antes de comprar.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <li key={g.best.id} className="anim-rise rounded-[4px] border border-rule bg-sheet">
            <div className="flex items-center gap-3 border-b border-rule p-3 sm:p-4">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[3px] border border-rule bg-white p-1">
                {g.best.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.best.image} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-center text-[10px] leading-tight text-ink-3">Sin foto</span>
                )}
              </span>
              <h3 className="line-clamp-2 min-w-0 font-medium leading-snug">{g.best.title}</h3>
            </div>
            <ol className="divide-y divide-rule px-3 sm:px-4">
              {g.offers.map((o, i) => (
                <li key={o.id}>
                  <a
                    href={o.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={o.title}
                    className="group flex items-center gap-2 py-2 text-sm"
                  >
                    <Dot store={o.store} />
                    <span className="min-w-0 truncate font-medium group-hover:underline">{STORES[o.store].name}</span>
                    {o.inStock === false && <span className="text-xs font-semibold text-alert">Sin stock</span>}
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-ink-2">
                      {i === 0 ? (
                        <span className="rounded-[2px] bg-lime light-scope px-1.5 py-0.5 font-bold text-ink">
                          Más barato
                        </span>
                      ) : (
                        `+${formatArs(o.price - g.best.price)}`
                      )}
                    </span>
                    <span className={`w-28 shrink-0 text-right tabular-nums ${i === 0 ? "font-extrabold" : "font-semibold"}`}>
                      {formatArs(o.price)}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
            {g.spread > 0 && (
              <p className="border-t border-rule px-3 py-2.5 text-sm text-ink-2 sm:px-4">
                Comprándolo en <strong className="font-semibold text-ink">{STORES[g.best.store].name}</strong> ahorrás{" "}
                <strong className="font-extrabold tabular-nums text-ink">{formatArs(g.spread)}</strong> frente a la más
                cara.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Resultados ---------- */

function ResultRow({ p, best }: { p: Product; best?: Product }) {
  const off = pctOff(p.price, p.listPrice);
  const isBest = best && p.price === best.price;
  const diff = best ? p.price - best.price : 0;
  return (
    <li className="anim-rise">
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-4 px-1 py-3.5 transition-colors hover:bg-sheet sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:px-3"
      >
        <span className="grid aspect-square place-items-center overflow-hidden rounded-[3px] border border-rule bg-white p-1.5">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-center text-xs leading-tight text-ink-3">Sin foto</span>
          )}
        </span>

        <span className="min-w-0">
          <span className="line-clamp-2 font-medium leading-snug group-hover:underline">{p.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <Dot store={p.store} /> {STORES[p.store].name}
            </span>
            {p.badge && (
              <span className="rounded-[2px] bg-paper px-1.5 py-px text-xs font-medium text-ink-2">{p.badge}</span>
            )}
            {off > 0 && <span className="text-xs font-semibold text-ink">-{off}%</span>}
            {p.freeShipping && !/env[ií]o gratis/i.test(p.badge ?? "") && (
              <span className="text-xs font-semibold text-ink">Envío gratis</span>
            )}
            {p.inStock === false && <span className="text-xs font-semibold text-alert">Sin stock</span>}
          </span>
        </span>

        <span className="flex flex-col items-end text-right">
          {p.listPrice && p.listPrice > p.price && (
            <span className="text-xs tabular-nums text-ink-3 line-through">{formatArs(p.listPrice)}</span>
          )}
          <span className="cartel-num text-2xl leading-none sm:text-3xl">{formatArs(p.price)}</span>
          <span className="mt-1 text-xs tabular-nums text-ink-2">
            {isBest ? (
              <span className="rounded-[2px] bg-lime light-scope px-1.5 py-0.5 font-bold text-ink">Más barato</span>
            ) : diff > 0 ? (
              `+${formatArs(diff)}`
            ) : null}
          </span>
        </span>
      </a>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li
      className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-4 px-1 py-3.5 sm:grid-cols-[4.5rem_1fr_auto] sm:px-3"
      aria-hidden="true"
    >
      <span className="aspect-square animate-pulse rounded-[3px] bg-rule/70" />
      <span className="space-y-2">
        <span className="block h-3.5 w-4/5 animate-pulse rounded-sm bg-rule" />
        <span className="block h-3 w-1/3 animate-pulse rounded-sm bg-rule/70" />
      </span>
      <span className="block h-6 w-24 animate-pulse rounded-sm bg-rule" />
    </li>
  );
}
