"use client";

import { useCallback, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import {
  buildTotal,
  cheapestFit,
  decodeBuild,
  encodeBuild,
  filledCount,
  oneStoreTotals,
  rankOffers,
} from "@/lib/builder/build";
import { buildWarnings, type Fit } from "@/lib/builder/compat";
import { fitsCategory, PART_IDS, PARTS, partDef, qtyOf, slotPrice, type Build, type PartId } from "@/lib/builder/parts";
import { nextTier, startTier, TIERS, USES, type Use } from "@/lib/builder/presets";
import { recommendFor, type Recommendation } from "@/lib/builder/recommend";
import { cpuHasGraphics, cpuIncludesCooler } from "@/lib/builder/specs";
import { searchAll } from "@/lib/client-search";
import { formatArs, formatNum } from "@/lib/format";
import { capacityGb } from "@/lib/versus";
import { STORE_IDS, STORES } from "@/lib/stores/meta";
import type { Product, StoreId } from "@/lib/types";
import { PcScene } from "../pc3d";
import { Armados } from "./Armados";
import {
  AlertIcon,
  ArrowIcon,
  BackIcon,
  CheckIcon,
  Dot,
  Footer,
  SearchIcon,
  Segmented,
  ShareButton,
  Struck,
  Tape,
  TopBar,
} from "../ui";

/** `auto`: la búsqueda la hicimos nosotros con la recomendación (si cambia el armado, se rehace) */
type OfferState = { query: string; products: Product[]; received: StoreId[]; failed: StoreId[]; auto?: boolean };
type Mode = "manual" | "presupuesto";
type Auto =
  | { phase: "running"; tier: string }
  | { phase: "done"; tier: string; total: number; budget: number; missing: PartId[] };

const STORAGE_KEY = "precioar:armado";
const RESUMEN = PARTS.length;

export default function Armador() {
  const [build, setBuild] = useState<Build>({});
  const [offers, setOffers] = useState<Partial<Record<PartId, OfferState>>>({});
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("manual");
  const [auto, setAuto] = useState<Auto | null>(null);
  const ready = useRef(false);

  /** Busca una pieza en todas las tiendas, mostrando cada tienda apenas responde. */
  const search = useCallback((part: PartId, query: string, auto = false): Promise<Product[]> => {
    const q = query.trim();
    setOffers((prev) => ({ ...prev, [part]: { query: q, products: [], received: [], failed: [], auto } }));
    setBuild((prev) => ({ ...prev, [part]: { ...prev[part], query: q } }));
    return searchAll(q, (r) =>
      setOffers((prev) => {
        const cur = prev[part];
        // respuesta de una búsqueda vieja, o repetida (la misma búsqueda pedida dos veces)
        if (!cur || cur.query !== q || cur.received.includes(r.store)) return prev;
        return {
          ...prev,
          [part]: {
            ...cur,
            products: [...cur.products, ...r.products],
            received: [...cur.received, r.store],
            failed: r.status === "error" ? [...cur.failed, r.store] : cur.failed,
          },
        };
      }),
    ).then((rs) => rs.flatMap((r) => r.products));
  }, []);

  // restaurar: primero el link compartido, si no lo último que se armó en este navegador
  useEffect(() => {
    let saved = window.location.search.slice(1);
    if (!saved) {
      try {
        saved = localStorage.getItem(STORAGE_KEY) ?? "";
      } catch {}
    }
    const decoded = decodeBuild(saved);
    const ids = PART_IDS.filter((id) => decoded[id]);
    if (!ids.length) {
      ready.current = true;
      return;
    }
    Promise.all(ids.map((id) => (decoded[id]!.skipped ? Promise.resolve([]) : search(id, decoded[id]!.query)))).then(
      (lists) => {
        const b: Build = {};
        for (const id of PART_IDS) {
          const d = decoded[id];
          if (!d) continue;
          if (d.skipped) {
            b[id] = { query: "", pick: null };
            continue;
          }
          const list = lists[ids.indexOf(id)];
          // el elegido tiene que seguir pasando los filtros (un link viejo puede traer un accesorio)
          const saved = d.pickId ? list.find((p) => p.id === d.pickId && fitsCategory(id, p)) : undefined;
          const pick = saved || (d.pickId ? cheapestFit(id, list, b) : undefined);
          b[id] = { query: d.query, pick, qty: d.qty };
        }
        setBuild(b);
        ready.current = true;
      },
    );
  }, [search]);

  // guardar en el link y en el navegador
  useEffect(() => {
    if (!ready.current) return;
    const encoded = encodeBuild(build);
    window.history.replaceState(null, "", encoded ? `/armar?${encoded}` : "/armar");
    try {
      localStorage.setItem(STORAGE_KEY, encoded);
    } catch {}
  }, [build]);

  const choose = (part: PartId, pick: Product | null) =>
    setBuild((prev) => ({ ...prev, [part]: { ...prev[part], query: prev[part]?.query ?? "", pick } }));

  const setQty = (part: PartId, qty: number) =>
    setBuild((prev) => ({ ...prev, [part]: { ...prev[part], query: prev[part]?.query ?? "", qty } }));

  const reset = () => {
    setBuild({});
    setOffers({});
    setAuto(null);
    setStep(0);
  };

  /** Por presupuesto: prueba niveles de armado hasta quedar dentro (o lo más cerca posible). */
  async function runBudget(budget: number, use: Use) {
    const tiers = TIERS[use];
    const tried = new Set<number>();
    let i = startTier(tiers);
    let best: { i: number; build: Build; total: number } | undefined;
    for (;;) {
      tried.add(i);
      setAuto({ phase: "running", tier: tiers[i].name });
      const q = tiers[i].queries;
      const lists = await Promise.all(PART_IDS.map((id) => (q[id] ? search(id, q[id]!) : Promise.resolve([]))));
      const b: Build = {};
      PART_IDS.forEach((id, k) => {
        b[id] = q[id] === null ? { query: "", pick: null } : { query: q[id]!, pick: cheapestFit(id, lists[k], b) };
      });
      const total = buildTotal(b);
      const better =
        !best ||
        (total <= budget && (best.total > budget || total > best.total)) ||
        (best.total > budget && total < best.total);
      if (better) best = { i, build: b, total };
      const n = nextTier(tiers, i, total, budget, tried);
      if (n === undefined) break;
      i = n;
    }
    const chosen = best!;
    // dejar a la vista las ofertas del armado elegido (ya están en cache)
    await Promise.all(PART_IDS.map((id) => (chosen.build[id]?.query ? search(id, chosen.build[id]!.query) : null)));
    setBuild(chosen.build);
    setAuto({
      phase: "done",
      tier: tiers[chosen.i].name,
      total: chosen.total,
      budget,
      missing: PART_IDS.filter((id) => chosen.build[id]?.pick === undefined),
    });
    setStep(RESUMEN);
  }

  const total = buildTotal(build);
  const filled = filledCount(build);
  const warnings = useMemo(() => buildWarnings(build), [build]);
  const offerLists = useMemo(
    () => Object.fromEntries(PART_IDS.map((id) => [id, offers[id]?.products ?? []])) as Record<PartId, Product[]>,
    [offers],
  );
  const placed = useMemo(
    () => Object.fromEntries(PART_IDS.map((id) => [id, !!build[id]?.pick])) as Record<PartId, boolean>,
    [build],
  );
  const part = step < RESUMEN ? PARTS[step] : undefined;

  // lo que mejor va con lo ya elegido (procesador → mother del mismo socket → su DDR → ...)
  const recs = useMemo(() => (part ? recommendFor(part.id, build) : []), [part, build]);

  /**
   * Ir a un paso. Si todavía no se buscó nada ahí, ya mostramos las mejores opciones para el
   * armado; si la búsqueda la hicimos nosotros y después cambió el armado (otro procesador), la rehacemos.
   */
  const goTo = (n: number) => {
    setStep(n);
    const id = PARTS[n]?.id;
    if (!id || auto?.phase === "running") return;
    const q = recommendFor(id, build)[0]?.query;
    const cur = offers[id];
    if (q && (!cur || (cur.auto && cur.query !== q))) search(id, q, true);
  };
  // la escena 3D se arma una vez: le pasamos una función estable que llama a la última versión de goTo
  const goToRef = useRef(goTo);
  useEffect(() => {
    goToRef.current = goTo;
  });

  // la escena 3D muestra nombre y precio de cada pieza, y un clic lleva a su paso
  const sceneLabels = useMemo(
    () =>
      Object.fromEntries(
        PARTS.map((d) => {
          const pick = build[d.id]?.pick;
          const qty = qtyOf(build, d.id);
          const state = pick
            ? `${qty > 1 ? `${qty} × ` : ""}${formatArs(slotPrice(build, d.id))}`
            : pick === null
              ? d.skip?.short.toLowerCase()
              : "sin elegir";
          return [d.id, `${d.name} · ${state}`];
        }),
      ) as Record<PartId, string>,
    [build],
  );
  const pickFromScene = useCallback((id: PartId) => goToRef.current(PART_IDS.indexOf(id)), []);
  // la tienda más barata que tiene todo lo elegido (para la línea del cartel)
  const oneStore = useMemo(
    () =>
      filled > 0 ? oneStoreTotals(offerLists, build).find((s) => s.missing.length === 0 && s.total > 0) : undefined,
    [offerLists, build, filled],
  );

  // un armado completo suma al ranking de populares (una vez por armado)
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    if (filled !== PARTS.length || !total) return;
    const key = encodeBuild(build);
    if (recorded.current.has(key)) return;
    recorded.current.add(key);
    fetch("/api/armados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, total, parts: filled }),
    }).catch(() => {});
  }, [build, filled, total]);

  // en el celu, la barra del total se esconde mientras el cartel está a la vista
  const [cartelVisible, setCartelVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById("total-cartel");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCartelVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const showBar = !cartelVisible && step !== RESUMEN;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-8 sm:px-6 lg:pb-20">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h1 className="cartel-num text-[clamp(2.75rem,7vw,4.5rem)] uppercase leading-[0.95]">Armá tu PC</h1>
            <p className="mt-2 max-w-xl text-ink-2">
              Pieza por pieza al mejor precio de siete tiendas. Te avisamos si algo no es compatible.
            </p>
          </div>
          <Segmented
            label="Cómo querés armarla"
            value={mode}
            onChange={setMode}
            options={[
              ["manual", "Lo armo yo"],
              ["presupuesto", "Por presupuesto"],
            ]}
          />
        </div>

        {mode === "presupuesto" && <Presupuesto auto={auto} onRun={runBudget} />}

        <StepRail step={step} setStep={goTo} build={build} warnings={warnings} />

        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
          <section className="min-w-0" aria-live="polite">
            {part ? (
              <PartStep
                key={`${part.id}:${build[part.id]?.query ?? ""}`}
                part={part.id}
                build={build}
                offer={offers[part.id]}
                recs={recs}
                onSearch={(q) => search(part.id, q)}
                onChoose={(p) => choose(part.id, p)}
                onQty={(n) => setQty(part.id, n)}
                onPrev={step > 0 ? () => goTo(step - 1) : undefined}
                onNext={() => goTo(step + 1)}
              />
            ) : (
              <Resumen
                build={build}
                offers={offerLists}
                total={total}
                warnings={warnings}
                auto={auto}
                setStep={goTo}
              />
            )}
          </section>

          <aside className="min-w-0 space-y-6 lg:sticky lg:top-24" aria-label="Tu armado">
            <div className="relative overflow-hidden rounded-[4px] border border-rule bg-sheet">
              <PcScene
                placed={placed}
                active={part?.id ?? null}
                labels={sceneLabels}
                complete={filled === PARTS.length}
                onPick={pickFromScene}
                className="h-64 sm:h-72 lg:h-[clamp(11rem,30vh,17rem)]"
                label={`Modelo 3D del armado: ${filled} de ${PARTS.length} piezas elegidas`}
              />
              <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-[2px] bg-sheet/90 px-1.5 py-0.5 text-xs text-ink-2 lg:bottom-auto lg:top-2">
                <span className="pointer-coarse:hidden">Arrastrá para girar · clic en una pieza para elegirla</span>
                <span className="hidden pointer-coarse:inline">Tocá una pieza para elegirla</span>
              </p>
            </div>
            <TotalCartel
              total={total}
              filled={filled}
              warnings={warnings}
              build={build}
              oneStore={oneStore}
              onReset={reset}
            />
          </aside>
        </div>
        <Armados current={encodeBuild(build)} total={total} parts={filled} />
      </main>

      {/* en el celu el total queda siempre a mano */}
      <div
        className={`light-scope fixed inset-x-0 bottom-0 z-20 border-t border-paper/15 bg-ink px-4 py-3 text-paper transition-transform duration-300 ease-out-expo lg:hidden ${
          showBar ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!showBar}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold">
              Total · {filled} de {PARTS.length} piezas
            </p>
            <p className="cartel-num text-3xl leading-none">${formatNum(total)}.-</p>
          </div>
          <button
            type="button"
            onClick={() => setStep(RESUMEN)}
            tabIndex={showBar ? 0 : -1}
            className="inline-flex items-center gap-2 rounded-[3px] bg-paper px-4 py-2.5 text-sm font-bold text-ink"
          >
            Ver resumen <ArrowIcon />
          </button>
        </div>
      </div>

      <Footer />
      <div className="h-20 lg:hidden" aria-hidden="true" />
    </div>
  );
}

/* ---------- Presupuesto ---------- */

function Presupuesto({ auto, onRun }: { auto: Auto | null; onRun: (budget: number, use: Use) => void }) {
  const [raw, setRaw] = useState("");
  const [use, setUse] = useState<Use>("gaming");
  const budget = Number(raw.replace(/\D/g, ""));
  const running = auto?.phase === "running";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (budget >= 100_000 && !running) onRun(budget, use);
      }}
      className="anim-rise mt-6 grid gap-5 rounded-[4px] border border-rule bg-sheet p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold">¿Cuánto querés gastar?</span>
          <span className="mt-2 flex items-baseline border-b-[3px] border-ink transition-shadow focus-within:shadow-[0_4px_0_var(--ink)]">
            <span className="cartel-num text-2xl">$</span>
            <input
              value={raw ? formatNum(budget) : ""}
              onChange={(e) => setRaw(e.target.value)}
              inputMode="numeric"
              placeholder="1.500.000"
              className="cartel-num w-full min-w-0 bg-transparent px-1.5 pb-1 text-4xl caret-fluo-deep outline-none placeholder:text-ink-3 focus-visible:outline-none"
              aria-describedby="presupuesto-ayuda"
            />
          </span>
          <span id="presupuesto-ayuda" className="mt-1.5 block text-xs text-ink-2">
            Mínimo $ 100.000. Probamos armados reales con precios de hoy.
          </span>
        </label>
        <fieldset>
          <legend className="text-sm font-bold">¿Para qué la vas a usar?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {USES.map((u) => (
              <label
                key={u.id}
                className="cursor-pointer rounded-full border-[1.5px] border-ink px-3 py-1.5 text-sm font-semibold transition-colors has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
              >
                <input
                  type="radio"
                  name="uso"
                  value={u.id}
                  checked={use === u.id}
                  onChange={() => setUse(u.id)}
                  className="sr-only"
                />
                {u.name}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <button
          type="submit"
          disabled={running || budget < 100_000}
          className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-5 py-3 font-bold text-paper transition-transform duration-200 ease-out-expo hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-ink-3"
        >
          {running ? "Armando…" : "Armame la PC"} {!running && <ArrowIcon />}
        </button>
        <p className="text-sm text-ink-2" aria-live="polite">
          {auto?.phase === "running" && `Probando un armado ${auto.tier.toLowerCase()}…`}
        </p>
      </div>
    </form>
  );
}

/* ---------- Pasos ---------- */

function StepRail({
  step,
  setStep,
  build,
  warnings,
}: {
  step: number;
  setStep: (n: number) => void;
  build: Build;
  warnings: ReturnType<typeof buildWarnings>;
}) {
  const bad = new Set(warnings.filter((w) => w.level === "error").flatMap((w) => w.parts));
  const items = [
    ...PARTS.map((p) => ({ id: p.id as PartId | "resumen", name: p.name })),
    { id: "resumen" as const, name: "Resumen" },
  ];
  const done = PART_IDS.filter((id) => build[id]?.pick !== undefined).length;
  return (
    <nav aria-label="Pasos del armado" className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="relative min-w-max">
        {/* progreso */}
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-rule" aria-hidden="true" />
        <span
          className="absolute bottom-0 left-0 h-[3px] bg-ink transition-[width] duration-700 ease-out-expo"
          style={{ width: `${(done / PARTS.length) * 100}%` }}
          aria-hidden="true"
        />
        <ol className="flex">
          {items.map((it, i) => {
            const slot = it.id === "resumen" ? undefined : build[it.id];
            const current = i === step;
            const isBad = it.id !== "resumen" && bad.has(it.id);
            const sub =
              it.id === "resumen"
                ? `${done} de ${PARTS.length}`
                : slot?.pick === null
                  ? (partDef(it.id).skip?.short ?? "Salteada")
                  : slot?.pick
                    ? formatArs(slotPrice(build, it.id))
                    : "Sin elegir";
            return (
              <li key={it.id} className="flex-auto">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={current ? "step" : undefined}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-t-[3px] px-3 pb-3 pt-2.5 text-left transition-colors ${
                    current ? "bg-ink text-paper" : "hover:bg-sheet"
                  }`}
                >
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-bold">
                    <span className={`cartel-num text-base ${current ? "text-paper/70" : "text-ink-3"}`}>{i + 1}</span>
                    {it.name}
                    {isBad && (
                      <span className={current ? "text-paper" : "text-alert"} title="Hay un problema de compatibilidad">
                        <AlertIcon />
                      </span>
                    )}
                    {!isBad && slot?.pick !== undefined && (
                      <span
                        className={`grid size-4 place-items-center rounded-full ${current ? "bg-paper text-ink" : "bg-ink text-paper"}`}
                      >
                        <CheckIcon />
                      </span>
                    )}
                  </span>
                  <span className={`text-xs tabular-nums ${current ? "text-paper/75" : "text-ink-2"}`}>{sub}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function PartStep({
  part,
  build,
  offer,
  recs,
  onSearch,
  onChoose,
  onQty,
  onPrev,
  onNext,
}: {
  part: PartId;
  build: Build;
  offer?: OfferState;
  recs: Recommendation[];
  onSearch: (q: string) => void;
  onChoose: (p: Product | null) => void;
  onQty: (n: number) => void;
  onPrev?: () => void;
  onNext: () => void;
}) {
  const def = partDef(part);
  const [draft, setDraft] = useState(build[part]?.query ?? "");
  const [all, setAll] = useState(false);
  const [showBad, setShowBad] = useState(false);
  const chosen = build[part]?.pick;
  const qty = qtyOf(build, part);
  const ranked = useMemo(() => (offer ? rankOffers(part, offer.products, build) : []), [offer, part, build]);
  // lo que no es compatible con el armado queda escondido (salvo que lo pidan o que sea lo elegido)
  const bad = ranked.filter((o) => o.fit.level === "bad" && o.product.id !== chosen?.id);
  const fitting = showBad ? ranked : ranked.filter((o) => !bad.includes(o));
  const shown = all ? fitting : fitting.slice(0, 10);
  const activeRec = recs.find((r) => r.query === offer?.query);
  const next = PARTS[PARTS.findIndex((p) => p.id === part) + 1];
  const pending = offer ? STORE_IDS.length - offer.received.length : 0;
  const cpu = build.cpu?.pick;
  const igpu = part === "gpu" && cpu ? cpuHasGraphics(cpu.title) : undefined;
  const boxCooler = part === "cooler" && cpu ? cpuIncludesCooler(cpu.title) : undefined;
  const skipNote =
    part === "gpu"
      ? igpu === true
        ? "Tu procesador tiene gráficos integrados: para oficina podés no comprar placa de video."
        : igpu === false
          ? "Tu procesador no tiene gráficos integrados: vas a necesitar placa de video."
          : "Si el procesador tiene gráficos integrados, podés no comprar placa de video."
      : boxCooler === true
        ? "Tu procesador trae cooler en la caja: alcanza para uso normal. Uno aparte enfría mejor y hace menos ruido."
        : boxCooler === false
          ? "Tu procesador no trae cooler en la caja: vas a necesitar uno."
          : "Algunos procesadores traen cooler en la caja; los X, X3D y los Intel K no.";

  const submit = (q: string) => {
    if (q.trim().length < 2) return;
    setDraft(q);
    setAll(false);
    onSearch(q);
  };

  return (
    <div className="anim-rise">
      <h2 className="text-3xl font-bold tracking-tight">Elegí {def.article}</h2>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="mt-5 flex items-stretch overflow-hidden rounded-[3px] border-[1.5px] border-ink bg-sheet ring-fluo focus-within:ring-[3px]"
      >
        <label htmlFor={`q-${part}`} className="sr-only">
          Buscar {def.name.toLowerCase()}
        </label>
        <span className="grid place-items-center pl-3 text-ink-3">
          <SearchIcon />
        </span>
        <input
          id={`q-${part}`}
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ej: ${def.hints[0]}`}
          className="min-w-0 flex-1 bg-transparent px-2.5 py-3 text-base outline-none placeholder:text-ink-3"
          enterKeyHint="search"
        />
        <button type="submit" className="bg-ink px-5 text-sm font-bold text-paper transition-colors hover:bg-ink/85">
          Buscar
        </button>
      </form>
      {recs.length > 0 ? (
        <section aria-labelledby={`rec-${part}`} className="mt-4 rounded-[3px] bg-sheet p-4">
          <h3 id={`rec-${part}`} className="text-sm font-bold">
            Lo que mejor va con tu armado
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {recs.map((r) => {
              const on = r.query === offer?.query;
              return (
                <li key={r.query}>
                  <button
                    type="button"
                    onClick={() => submit(r.query)}
                    aria-pressed={on}
                    className={`rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold transition-colors ${
                      on ? "border-ink bg-ink text-paper" : "border-ink hover:bg-ink hover:text-paper"
                    }`}
                  >
                    {r.query}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2.5 text-sm text-ink-2">{(activeRec ?? recs[0]).reason}.</p>
        </section>
      ) : (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-2">Probá con</span>
        {def.hints.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => submit(h)}
            className="rounded-full border border-rule-strong bg-sheet px-3 py-1 text-sm font-medium transition-colors hover:border-ink"
          >
            {h}
          </button>
        ))}
      </div>
      )}

      {def.multi && (
        <QtyPicker max={def.multi} qty={qty} pick={chosen ?? undefined} onChange={onQty} />
      )}

      {def.skip && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-dashed border-rule-strong px-4 py-3">
          <p className="text-sm">{skipNote}</p>
          <button
            type="button"
            onClick={() => onChoose(null)}
            aria-pressed={chosen === null}
            className={`rounded-[3px] border-[1.5px] border-ink px-3 py-1.5 text-sm font-bold transition-colors ${
              chosen === null ? "bg-ink text-paper" : "hover:bg-ink hover:text-paper"
            }`}
          >
            {chosen === null ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon size={12} /> {def.skip.chosen}
              </span>
            ) : (
              def.skip.action
            )}
          </button>
        </div>
      )}

      {/* ofertas */}
      <div className="mt-6">
        {offer && (
          <p className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-2 text-sm text-ink-2">
            <span>
              <strong className="text-ink">{fitting.length}</strong>{" "}
              {bad.length > 0 && !showBad ? "compatibles" : fitting.length === 1 ? "oferta" : "ofertas"} para “
              {offer.query}”{pending > 0 && ` · buscando en ${pending} ${pending === 1 ? "tienda" : "tiendas"}…`}
            </span>
            {offer.failed.length > 0 && (
              <span>No respondieron: {offer.failed.map((s) => STORES[s].name).join(", ")}</span>
            )}
          </p>
        )}

        {!offer && (
          <p className="rounded-[3px] bg-sheet px-4 py-6 text-center text-ink-2">
            Buscá {def.article} o elegí un ejemplo de arriba.
          </p>
        )}

        <ul className="divide-y divide-rule">
          {shown.map(({ product: p, fit }, i) => (
            <OfferRow
              key={p.id}
              p={p}
              fit={fit}
              cheapest={i === 0 && fit.level !== "bad"}
              qty={qty}
              selected={chosen?.id === p.id}
              onChoose={() => onChoose(p)}
            />
          ))}
          {offer &&
            pending > 0 &&
            ranked.length === 0 &&
            Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 py-3.5" aria-hidden="true">
                <span className="size-14 animate-pulse rounded-[3px] bg-rule/70" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3.5 w-4/5 animate-pulse rounded-sm bg-rule" />
                  <span className="block h-3 w-1/3 animate-pulse rounded-sm bg-rule/70" />
                </span>
              </li>
            ))}
        </ul>

        {offer && pending === 0 && ranked.length > 0 && fitting.length === 0 && (
          <p className="py-8 text-center text-ink-2">
            Ninguna oferta de “{offer.query}” es compatible con lo que ya elegiste.
          </p>
        )}

        {offer && pending === 0 && ranked.length === 0 && (
          <p className="py-8 text-center text-ink-2">
            No encontramos “{offer.query}” en ninguna tienda. Probá con menos palabras o con el modelo exacto.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {fitting.length > shown.length && (
            <button type="button" onClick={() => setAll(true)} className="text-sm font-semibold underline">
              Ver las {fitting.length} ofertas
            </button>
          )}
          {bad.length > 0 && (
            <button type="button" onClick={() => setShowBad((v) => !v)} className="text-sm text-ink-2 underline">
              {showBad
                ? "Esconder las que no son compatibles"
                : `Mostrar ${bad.length} que no ${bad.length === 1 ? "es compatible" : "son compatibles"} con tu armado`}
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
        {onPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
          >
            <BackIcon /> Anterior
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onNext}
          className={`inline-flex items-center gap-2 rounded-[3px] px-5 py-3 font-bold transition-[transform,background-color] duration-200 ease-out-expo hover:-translate-y-px ${
            chosen !== undefined ? "bg-ink text-paper" : "border-[1.5px] border-ink text-ink"
          }`}
        >
          {next ? `Siguiente: ${next.name}` : "Ver resumen"} <ArrowIcon />
        </button>
      </div>
    </div>
  );
}

/** Cuántas memorias: x2 para dual channel, x4 para llenar el mother. */
function QtyPicker({
  max,
  qty,
  pick,
  onChange,
}: {
  max: number;
  qty: number;
  pick?: Product;
  onChange: (n: number) => void;
}) {
  const each = pick ? capacityGb(pick.title) : undefined;
  const hint =
    qty === 1
      ? "Con 2 módulos iguales la memoria anda en dual channel y rinde bastante más."
      : qty === 2
        ? "Dual channel: la opción recomendada."
        : qty === 3
          ? "Con 3 módulos se pierde el dual channel: mejor 2 o 4."
          : "4 módulos: verificá que tu mother tenga 4 ranuras.";
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-rule-strong px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold">
          ¿Cuántos módulos?
          {pick && (
            <span className="font-normal text-ink-2">
              {" "}
              · {each ? `${each * qty} GB en total, ` : ""}
              <span className="tabular-nums">{formatArs(pick.price * qty)}</span>
            </span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-ink-2">{hint}</p>
      </div>
      <Segmented
        label="Cantidad de módulos de memoria"
        value={String(qty)}
        onChange={(v) => onChange(Number(v))}
        options={Array.from({ length: max }, (_, i) => [String(i + 1), `×${i + 1}`] as [string, string])}
      />
    </div>
  );
}

function FitBadge({ fit }: { fit: Fit }) {
  if (fit.level === "ok")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
        <CheckIcon size={11} /> {fit.reason ?? "Compatible"}
      </span>
    );
  if (fit.level === "bad")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-alert">
        <AlertIcon /> {fit.reason}
      </span>
    );
  return fit.reason ? <span className="text-xs text-ink-2">{fit.reason}</span> : null;
}

function OfferRow({
  p,
  fit,
  cheapest,
  qty,
  selected,
  onChoose,
}: {
  p: Product;
  fit: Fit;
  cheapest: boolean;
  qty: number;
  selected: boolean;
  onChoose: () => void;
}) {
  return (
    <li
      className={`anim-rise grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto_auto] ${
        fit.level === "bad" ? "opacity-60" : ""
      }`}
    >
      <span className="row-span-2 grid aspect-square place-items-center overflow-hidden rounded-[3px] border border-rule bg-white p-1 sm:row-span-1">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-center text-xs leading-tight text-ink-3">Sin foto</span>
        )}
      </span>
      <span className="min-w-0">
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 font-medium leading-snug hover:underline"
        >
          {p.title}
        </a>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <Dot store={p.store} /> {STORES[p.store].name}
          </span>
          <FitBadge fit={fit} />
          {cheapest && (
            <span className="rounded-[2px] bg-lime light-scope px-1.5 py-px text-xs font-bold text-ink">Más barato</span>
          )}
        </span>
      </span>
      <span className="col-start-2 flex flex-col sm:col-start-auto sm:items-end">
        <span className="cartel-num text-2xl leading-none">{formatArs(p.price)}</span>
        {qty > 1 && (
          <span className="mt-1 text-xs tabular-nums text-ink-2">
            × {qty} = {formatArs(p.price * qty)}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onChoose}
        aria-pressed={selected}
        className={`col-start-2 inline-flex items-center justify-center gap-1.5 justify-self-start rounded-[3px] px-3.5 py-2 text-sm font-bold transition-colors sm:col-start-auto sm:justify-self-end ${
          selected ? "bg-ink text-paper" : "border-[1.5px] border-ink hover:bg-ink hover:text-paper"
        }`}
      >
        {selected ? (
          <>
            <CheckIcon size={12} /> Elegida
          </>
        ) : (
          "Elegir"
        )}
      </button>
    </li>
  );
}

/* ---------- Total y resumen ---------- */

function TotalCartel({
  total,
  filled,
  warnings,
  build,
  oneStore,
  onReset,
}: {
  total: number;
  filled: number;
  warnings: ReturnType<typeof buildWarnings>;
  build: Build;
  oneStore?: { store: StoreId; total: number };
  onReset: () => void;
}) {
  // el total anterior queda tachado arriba, como en el comparador
  const [prev, setPrev] = useState<number | null>(null);
  const last = useRef(total);
  useEffect(() => {
    if (last.current !== total) {
      setPrev(last.current > 0 && total > 0 ? last.current : null);
      last.current = total;
    }
  }, [total]);

  return (
    <ViewTransition name="cartel" share="morph" default="none">
      <article
        id="total-cartel"
        aria-label="Total del armado"
        className="relative z-10 rotate-[-1.2deg] rounded-[4px] bg-fluo light-scope p-6 lg:-mt-12 lg:ml-6 shadow-[0_24px_40px_-24px_rgba(22,23,26,0.6),0_2px_4px_rgba(22,23,26,0.08)] sm:p-7"
      >
        <Tape className="-top-3 left-1/2 -translate-x-1/2 rotate-[2deg]" />
        <p className="text-lg font-bold">Total del armado</p>
        <div className="mt-2 min-h-6">
          {prev !== null && (
            <Struck key={prev} className="cartel-num text-xl text-ink/70">
              <span className="sr-only">Antes: </span>${formatNum(prev)}.-
            </Struck>
          )}
        </div>
        <p
          key={total}
          className="anim-write cartel-num flex items-start text-[clamp(3.25rem,10vw,5rem)] leading-[0.9]"
          aria-live="polite"
        >
          <span className="mr-1 mt-[0.12em] text-[0.42em]">$</span>
          {formatNum(total)}
          <span aria-hidden="true">.-</span>
        </p>
        <p className="mt-3 text-sm font-semibold">
          {filled} de {PARTS.length} piezas elegidas
          {build.gpu?.pick === null && " (sin placa de video)"}
          {build.cooler?.pick === null && " (cooler de caja)"}
        </p>

        {oneStore && (
          <p className="mt-1 text-sm">
            Todo en {STORES[oneStore.store].name}: <strong className="tabular-nums">{formatArs(oneStore.total)}</strong>
            {oneStore.total > total && ` (+${formatArs(oneStore.total - total)})`}
          </p>
        )}

        {warnings.length > 0 && (
          <ul className="mt-4 space-y-2 rounded-[3px] bg-sheet p-3 text-sm">
            {warnings.map((w) => (
              <li
                key={w.message}
                className={`flex gap-2 ${w.level === "error" ? "font-semibold text-alert" : "text-ink-2"}`}
              >
                <span className="mt-0.5 shrink-0">
                  <AlertIcon />
                </span>
                {w.message}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <ShareButton title="Mi armado en PrecioAR" text={`Mi PC sale ${formatArs(total)} armándola al mejor precio`} />
          {filled > 0 && (
            <button type="button" onClick={onReset} className="text-sm font-semibold underline">
              Empezar de nuevo
            </button>
          )}
        </div>
      </article>
    </ViewTransition>
  );
}

function Resumen({
  build,
  offers,
  total,
  warnings,
  auto,
  setStep,
}: {
  build: Build;
  offers: Record<PartId, Product[]>;
  total: number;
  warnings: ReturnType<typeof buildWarnings>;
  auto: Auto | null;
  setStep: (n: number) => void;
}) {
  const stores = oneStoreTotals(offers, build);
  const complete = stores.filter((s) => s.missing.length === 0);
  const anyPicked = PART_IDS.some((id) => build[id]?.pick);

  return (
    <div className="anim-rise">
      <h2 className="text-3xl font-bold tracking-tight">Tu armado</h2>

      {auto?.phase === "done" && (
        <p
          className={`mt-4 rounded-[3px] px-4 py-3 text-sm font-medium ${auto.total <= auto.budget ? "bg-lime light-scope" : "bg-sheet"}`}
        >
          {auto.total <= auto.budget
            ? `Armado ${auto.tier.toLowerCase()} por ${formatArs(auto.total)}: te sobran ${formatArs(auto.budget - auto.total)} de tu presupuesto.`
            : `Lo más barato que encontramos sale ${formatArs(auto.total)}: se pasa ${formatArs(auto.total - auto.budget)} de tu presupuesto.`}
          {auto.missing.length > 0 &&
            ` No encontramos ${auto.missing.map((id) => partDef(id).name.toLowerCase()).join(", ")}; buscalo a mano.`}
        </p>
      )}

      <ol className="mt-5 divide-y divide-rule border-y border-ink">
        {PARTS.map((def, i) => {
          const slot = build[def.id];
          const pick = slot?.pick;
          const bad = warnings.some((w) => w.level === "error" && w.parts.includes(def.id));
          return (
            <li
              key={def.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[9rem_minmax(0,1fr)_auto_auto]"
            >
              <span className="flex items-center gap-1.5 text-sm font-bold">
                {def.name}
                {bad && (
                  <span className="text-alert">
                    <AlertIcon />
                  </span>
                )}
              </span>
              <span className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-auto">
                {pick ? (
                  <a href={pick.url} target="_blank" rel="noopener noreferrer" className="block hover:underline">
                    <span className="line-clamp-1">
                      {qtyOf(build, def.id) > 1 && <strong>{qtyOf(build, def.id)} × </strong>}
                      {pick.title}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-2">
                      <Dot store={pick.store} /> {STORES[pick.store].name}
                    </span>
                  </a>
                ) : (
                  <span className="text-ink-2">
                    {pick === null ? (def.skip?.summary ?? "Salteada") : "Sin elegir"}
                  </span>
                )}
              </span>
              <span className="cartel-num text-right text-2xl leading-none sm:row-start-auto">
                {pick ? formatArs(slotPrice(build, def.id)) : "—"}
              </span>
              <button
                type="button"
                onClick={() => setStep(i)}
                className="hidden text-sm font-semibold underline sm:block"
                aria-label={`Cambiar ${def.name.toLowerCase()}`}
              >
                Cambiar
              </button>
            </li>
          );
        })}
        <li className="flex items-baseline justify-between py-4">
          <span className="font-bold">Total combinando tiendas</span>
          <span className="cartel-num text-3xl">{formatArs(total)}</span>
        </li>
      </ol>

      {anyPicked && (
        <section className="mt-10" aria-labelledby="una-tienda">
          <h3 id="una-tienda" className="text-xl font-bold">
            ¿Y todo en una sola tienda?
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            Un solo envío y una sola garantía. Usamos la oferta compatible más barata de cada tienda para las mismas
            búsquedas.
          </p>
          <ul className="mt-4 divide-y divide-rule rounded-[4px] border border-rule bg-sheet">
            {stores.map((s) => (
              <li key={s.store} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <span className="flex items-center gap-2 font-medium">
                  <Dot store={s.store} /> {STORES[s.store].name}
                </span>
                {s.missing.length === 0 ? (
                  <span className="flex items-baseline gap-3">
                    <span className="text-xs tabular-nums text-ink-2">
                      {s.total - total > 0 ? `+${formatArs(s.total - total)} vs. combinar` : "igual que combinar"}
                    </span>
                    <span className={`cartel-num text-2xl ${s === complete[0] ? "rounded-[2px] bg-lime light-scope px-1.5" : ""}`}>
                      {formatArs(s.total)}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-ink-2">
                    No tiene {s.missing.map((id) => partDef(id).name.toLowerCase()).join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
