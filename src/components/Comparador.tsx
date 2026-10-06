"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatArs, pctOff } from "@/lib/format";
import { STORE_IDS, STORES } from "@/lib/stores/meta";
import type { Product, StoreId, StoreResult } from "@/lib/types";

type Slot = { state: "idle" } | { state: "loading" } | { state: "done"; result: StoreResult };
type View = "todos" | "tiendas";
type Sort = "asc" | "desc";

const SUGERENCIAS = ["RTX 5060", "Ryzen 5 7600", "SSD 1TB NVMe", "Monitor 27 144hz", "Mouse Logitech G502"];

const idleSlots = () => Object.fromEntries(STORE_IDS.map((s) => [s, { state: "idle" }])) as Record<StoreId, Slot>;

const loadingSlots = () =>
  Object.fromEntries(STORE_IDS.map((s) => [s, { state: "loading" }])) as Record<StoreId, Slot>;

export default function Comparador({ initialQuery = "" }: { initialQuery?: string }) {
  const initial = initialQuery.trim().length >= 2 ? initialQuery.trim() : "";
  const [input, setInput] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [slots, setSlots] = useState<Record<StoreId, Slot>>(initial ? loadingSlots : idleSlots);
  const [enabled, setEnabled] = useState<Record<StoreId, boolean>>(
    () => Object.fromEntries(STORE_IDS.map((s) => [s, true])) as Record<StoreId, boolean>,
  );
  const [view, setView] = useState<View>("todos");
  const [sort, setSort] = useState<Sort>("asc");
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
        });
    }
  }, []);

  const runSearch = (q: string) => {
    const term = q.trim();
    if (term.length < 2) return;
    setQuery(term);
    setSlots(loadingSlots());
    const url = new URL(window.location.href);
    url.searchParams.set("q", term);
    window.history.replaceState(null, "", url);
    fetchAll(term);
  };

  // búsqueda que viene en la URL (?q=...), para poder compartir links
  useEffect(() => {
    if (initial) fetchAll(initial);
  }, [initial, fetchAll]);

  const results = useMemo(
    () =>
      STORE_IDS.flatMap((s) => {
        const slot = slots[s];
        return slot.state === "done" && enabled[s] ? slot.result.products : [];
      }),
    [slots, enabled],
  );

  const sorted = useMemo(
    () => [...results].sort((a, b) => (sort === "asc" ? a.price - b.price : b.price - a.price)),
    [results, sort],
  );

  const bestByStore = useMemo(() => {
    const m = new Map<StoreId, Product>();
    for (const p of results) {
      const cur = m.get(p.store);
      if (!cur || p.price < cur.price) m.set(p.store, p);
    }
    return [...m.values()].sort((a, b) => a.price - b.price);
  }, [results]);

  const loadingCount = STORE_IDS.filter((s) => slots[s].state === "loading").length;
  const searched = query !== "";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
      {/* Header */}
      <header className="flex items-center justify-between py-6">
        <button type="button" onClick={() => { reqId.current++; setQuery(""); setInput(""); setSlots(idleSlots()); window.history.replaceState(null, "", "/"); }} className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-black">$</span>
          <span>
            Precio<span className="text-accent">AR</span>
          </span>
        </button>
        <span className="text-xs text-muted">by Sync Solutions</span>
      </header>

      {/* Hero + buscador */}
      <section className={searched ? "pt-2" : "pt-16 sm:pt-24"}>
        {!searched && (
          <div className="mb-8 text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              El mismo producto, <span className="text-accent">todas las tiendas.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-balance text-muted">
              Buscá una vez y compará precios de Mercado Libre, Compra Gamer, FullH4rd, Venex, Mexx y Gezatek en
              segundos.
            </p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(input);
          }}
          className="mx-auto flex max-w-3xl gap-2 rounded-2xl border border-line bg-panel p-2 shadow-lg shadow-black/20 focus-within:border-accent/60"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej: RTX 5060, Ryzen 7 7800X3D, SSD 1TB…"
            className="min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted/70"
            autoFocus
            aria-label="Producto a buscar"
          />
          <button
            type="submit"
            disabled={input.trim().length < 2}
            className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
          >
            Comparar
          </button>
        </form>

        {!searched && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput(s);
                  runSearch(s);
                }}
                className="rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:border-accent hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      {searched && (
        <>
          {/* Estado por tienda (también sirve de filtro) */}
          <section className="mt-6 flex flex-wrap gap-2" aria-label="Tiendas">
            {STORE_IDS.map((s) => (
              <StoreChip
                key={s}
                store={s}
                slot={slots[s]}
                on={enabled[s]}
                toggle={() => setEnabled((p) => ({ ...p, [s]: !p[s] }))}
              />
            ))}
          </section>

          {/* Resumen comparativo */}
          {bestByStore.length > 0 && <Resumen best={bestByStore} query={query} />}

          {/* Controles */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {results.length} resultados para <span className="text-fg">“{query}”</span>
              {loadingCount > 0 && ` · buscando en ${loadingCount} tienda${loadingCount > 1 ? "s" : ""}…`}
            </p>
            <div className="flex gap-2">
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  ["todos", "Todos"],
                  ["tiendas", "Por tienda"],
                ]}
              />
              <Segmented
                value={sort}
                onChange={setSort}
                options={[
                  ["asc", "Menor $"],
                  ["desc", "Mayor $"],
                ]}
              />
            </div>
          </div>

          {/* Resultados */}
          {view === "todos" ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sorted.map((p) => (
                <ProductCard key={p.id} p={p} best={p.price === sorted[0]?.price && sort === "asc"} />
              ))}
              {loadingCount > 0 && sorted.length === 0 && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} />)}
            </div>
          ) : (
            <div className="mt-4 space-y-8">
              {STORE_IDS.filter((s) => enabled[s]).map((s) => {
                const slot = slots[s];
                const items =
                  slot.state === "done"
                    ? [...slot.result.products].sort((a, b) => (sort === "asc" ? a.price - b.price : b.price - a.price))
                    : [];
                return (
                  <div key={s}>
                    <h2 className="mb-3 flex items-center gap-2 font-semibold">
                      <Dot store={s} /> {STORES[s].name}
                      <span className="text-sm font-normal text-muted">
                        {slot.state === "loading" ? "buscando…" : `${items.length} resultados`}
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {slot.state === "loading" && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} />)}
                      {items.map((p) => (
                        <ProductCard key={p.id} p={p} />
                      ))}
                      {slot.state === "done" && slot.result.status !== "ok" && (
                        <p className="text-sm text-muted">
                          {slot.result.message ?? "Sin resultados para esta búsqueda."}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loadingCount === 0 && results.length === 0 && (
            <div className="mt-16 text-center text-muted">
              <p className="text-lg text-fg">No encontramos “{query}”.</p>
              <p className="mt-1 text-sm">Probá con menos palabras o con el modelo exacto (ej: “RTX 5060”).</p>
            </div>
          )}
        </>
      )}

      <footer className="mt-24 text-center text-xs text-muted">
        Precios obtenidos en tiempo real de cada tienda (cache 10 min). Verificá siempre el precio final en el sitio.
      </footer>
    </div>
  );
}

/* ---------- Componentes ---------- */

function Dot({ store }: { store: StoreId }) {
  return <span className="inline-block size-2.5 rounded-full" style={{ background: STORES[store].color }} />;
}

function StoreChip({ store, slot, on, toggle }: { store: StoreId; slot: Slot; on: boolean; toggle: () => void }) {
  let info: React.ReactNode = null;
  if (slot.state === "loading") info = <span className="size-3 animate-spin rounded-full border-2 border-muted border-t-transparent" />;
  if (slot.state === "done") {
    const r = slot.result;
    info =
      r.status === "error" ? (
        <span className="text-red-400" title={r.message}>
          error
        </span>
      ) : (
        <span className="tabular-nums text-muted">{r.products.length}</span>
      );
  }
  const title = slot.state === "done" ? (slot.result.message ?? `${slot.result.ms} ms${slot.result.cached ? " (cache)" : ""}`) : undefined;
  return (
    <button
      onClick={toggle}
      title={title}
      aria-pressed={on}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
        on ? "border-line bg-panel" : "border-transparent opacity-40 line-through"
      }`}
    >
      <Dot store={store} />
      {STORES[store].name}
      {info}
    </button>
  );
}

function Resumen({ best, query }: { best: Product[]; query: string }) {
  const min = best[0].price;
  const max = best[best.length - 1].price;
  const ahorro = max - min;
  return (
    <section className="mt-6 grid gap-4 rounded-2xl border border-line bg-panel p-5 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <p className="text-sm text-muted">Mejor precio encontrado</p>
        <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-accent">{formatArs(min)}</p>
        <p className="mt-1 flex items-center gap-2 text-sm">
          <Dot store={best[0].store} /> en {STORES[best[0].store].name}
        </p>
        <a
          href={best[0].url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 line-clamp-2 text-sm text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          {best[0].title}
        </a>
        {best.length > 1 && ahorro > 0 && (
          <p className="mt-4 inline-block rounded-lg bg-accent/10 px-3 py-1.5 text-sm text-accent">
            Ahorrás hasta {formatArs(ahorro)} vs. la opción más cara entre tiendas
          </p>
        )}
      </div>

      <div>
        <p className="mb-3 text-sm text-muted">Precio más bajo por tienda · “{query}”</p>
        <ul className="space-y-2.5">
          {best.map((p) => (
            <li key={p.store} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm">
              <span className="flex items-center gap-2 truncate">
                <Dot store={p.store} />
                {STORES[p.store].name}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full"
                  style={{
                    // la barra arranca en 25% y crece según cuánto más cara es que la mejor
                    width: `${max === min ? 100 : 25 + ((p.price - min) / (max - min)) * 75}%`,
                    background: p.price === min ? "var(--accent)" : "var(--muted)",
                  }}
                />
              </span>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="tabular-nums hover:underline">
                {formatArs(p.price)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProductCard({ p, best }: { p: Product; best?: boolean }) {
  const off = pctOff(p.price, p.listPrice);
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-row overflow-hidden rounded-2xl border bg-panel sm:flex-col transition hover:-translate-y-0.5 hover:border-accent/60 ${
        best ? "border-accent/70" : "border-line"
      }`}
    >
      <div className="relative grid w-28 shrink-0 place-items-center bg-white p-2 sm:aspect-[4/3] sm:w-auto sm:p-4">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-neutral-400">Sin imagen</span>
        )}
        {best && (
          <span className="absolute left-2 top-2 rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-black">
            Más barato
          </span>
        )}
        {off > 0 && (
          <span className="absolute right-2 top-2 rounded-md bg-black/80 px-2 py-0.5 text-xs font-semibold text-white">
            -{off}%
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <span className="flex items-center gap-2 text-xs text-muted">
          <Dot store={p.store} /> {STORES[p.store].name}
          {p.badge && <span className="ml-auto rounded bg-line px-1.5 py-0.5">{p.badge}</span>}
        </span>
        <h3 className="line-clamp-2 text-sm leading-snug group-hover:text-accent">{p.title}</h3>
        <div className="mt-auto pt-1">
          {p.listPrice && <p className="text-xs text-muted line-through tabular-nums">{formatArs(p.listPrice)}</p>}
          <p className="text-xl font-semibold tabular-nums">{formatArs(p.price)}</p>
          {p.inStock === false && <p className="text-xs text-red-400">Sin stock</p>}
        </div>
      </div>
    </a>
  );
}

function Skeleton() {
  return (
    <div className="flex overflow-hidden rounded-2xl border border-line bg-panel sm:flex-col">
      <div className="w-28 shrink-0 animate-pulse bg-line/60 sm:aspect-[4/3] sm:w-auto" />
      <div className="flex-1 space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
        <div className="h-3 w-full animate-pulse rounded bg-line" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-line" />
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="flex rounded-lg border border-line bg-panel p-0.5 text-sm">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`whitespace-nowrap rounded-md px-2.5 py-1.5 transition sm:px-3 ${value === v ? "bg-line text-fg" : "text-muted hover:text-fg"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
