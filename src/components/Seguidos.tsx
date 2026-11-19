"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { searchAll } from "@/lib/client-search";
import { formatArs } from "@/lib/format";
import {
  currentPush,
  disablePush,
  enablePush,
  pushSupported,
  testPush,
  unfollow,
  useSeguidos,
  VAPID_PUBLIC_KEY,
  type Seguido,
} from "@/lib/seguidos";
import { STORES } from "@/lib/stores/meta";
import type { Product } from "@/lib/types";
import { AlertIcon, ArrowIcon, CheckIcon, Dot, Footer, Spinner, TopBar } from "./ui";

/** Sin entrada = todavía buscando. */
type Now = { best?: Product; failed: number };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

export default function Seguidos() {
  const list = useSeguidos();
  const [now, setNow] = useState<Record<string, Now>>({});
  const started = useRef(new Set<string>());

  // el precio de hoy de cada una, de a dos búsquedas a la vez (cada una consulta todas las tiendas)
  useEffect(() => {
    const queue = list.filter((s) => !started.current.has(s.query.toLowerCase()));
    for (const s of queue) started.current.add(s.query.toLowerCase());
    if (!queue.length) return;
    const worker = async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        const results = await searchAll(s.query);
        const best = results.flatMap((r) => r.products).sort((a, b) => a.price - b.price)[0];
        const failed = results.filter((r) => r.status === "error").length;
        const key = s.query.toLowerCase();
        setNow((p) => ({ ...p, [key]: { best, failed } }));
      }
    };
    worker();
    worker();
  }, [list]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-10 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-12">
        <div className="min-w-0">
          <h1 className="cartel-num text-[clamp(2.75rem,7vw,4.5rem)] uppercase leading-[0.95]">Seguidos</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-2">
            Lo que estás por comprar, con el precio de hoy al lado del de cuando lo empezaste a seguir. Se guarda en
            este navegador, sin cuenta.
          </p>

          {list.length === 0 ? (
            <div className="mt-10 border-t border-ink pt-6">
              <p className="text-xl font-bold">Todavía no seguís nada.</p>
              <p className="mt-2 max-w-md text-ink-2">
                Buscá un producto y tocá <strong className="font-semibold text-ink">Seguir</strong> arriba de los
                resultados. Lo vas a encontrar acá con su precio actualizado.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center gap-2 rounded-[3px] bg-ink px-5 py-3 font-bold text-paper transition-transform duration-200 ease-out-expo hover:-translate-y-px"
              >
                Buscar un producto <ArrowIcon />
              </Link>
            </div>
          ) : (
            <ul className="mt-8 divide-y divide-rule border-t border-ink">
              {list.map((s) => (
                <Fila key={s.query} s={s} now={now[s.query.toLowerCase()]} />
              ))}
            </ul>
          )}
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-24">
          <Avisos count={list.length} />
          <Instalar />
        </aside>
      </main>
      <Footer />
    </div>
  );
}

function Fila({ s, now }: { s: Seguido; now?: Now }) {
  const best = now?.best;
  const diff = best && s.basePrice ? best.price - s.basePrice : undefined;
  const pct = diff !== undefined && s.basePrice ? Math.round((Math.abs(diff) / s.basePrice) * 100) : 0;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 py-5">
      <div className="min-w-0">
        <Link href={`/?q=${encodeURIComponent(s.query)}`} className="text-xl font-bold capitalize hover:underline">
          {s.query}
        </Link>
        <p className="mt-0.5 text-sm text-ink-2">
          Desde el {fmtDate(s.addedAt)}
          {s.basePrice ? ` a ${formatArs(s.basePrice)}` : ""}
          {s.baseStore ? ` en ${STORES[s.baseStore].name}` : ""}
        </p>
        {best && (
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm">
            <Dot store={best.store} />
            <span className="shrink-0 font-medium">{STORES[best.store].name}</span>
            <a
              href={best.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-ink-2 underline-offset-2 hover:text-ink hover:underline"
            >
              {best.title}
            </a>
          </p>
        )}
      </div>
      <div className="flex flex-col items-end text-right">
        {!now ? (
          <span className="flex items-center gap-2 text-sm text-ink-2">
            <Spinner /> Buscando
          </span>
        ) : best ? (
          <>
            <span className="cartel-num text-3xl leading-none">{formatArs(best.price)}</span>
            {diff !== undefined && (
              <span className="mt-1 text-sm">
                {diff < 0 ? (
                  <strong className="font-bold">
                    Bajó {formatArs(-diff)} (−{pct}%)
                  </strong>
                ) : diff > 0 ? (
                  <span className="text-ink-2">
                    Subió {formatArs(diff)} (+{pct}%)
                  </span>
                ) : (
                  <span className="text-ink-2">Igual que antes</span>
                )}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-ink-2">{now.failed ? "Las tiendas no respondieron" : "Sin resultados hoy"}</span>
        )}
        <button
          type="button"
          onClick={() => unfollow(s.query)}
          className="mt-2 text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
        >
          Dejar de seguir
        </button>
      </div>
    </li>
  );
}

type PushState = { s: "checking" } | { s: "off" } | { s: "on" };

/** Notificaciones push en este dispositivo. */
function Avisos({ count }: { count: number }) {
  const [state, setState] = useState<PushState>({ s: "checking" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ios = useIsIos();
  const standalone = useStandalone();
  const supported = useClient(pushSupported, true);
  const view = !supported ? "unsupported" : !VAPID_PUBLIC_KEY ? "unconfigured" : state.s;

  useEffect(() => {
    if (!pushSupported() || !VAPID_PUBLIC_KEY) return;
    currentPush()
      .then((sub) => setState({ s: sub ? "on" : "off" }))
      .catch(() => setState({ s: "off" }));
  }, []);

  async function run(fn: () => Promise<unknown>, done: PushState, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setState(done);
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setState({ s: (await currentPush().catch(() => null)) ? "on" : "off" });
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Algo falló. Probá de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="avisos-titulo" className="rounded-[4px] border border-rule bg-sheet">
      <div className="border-b border-rule px-4 py-3.5 sm:px-5">
        <h2 id="avisos-titulo" className="font-bold">
          Avisos en este dispositivo
        </h2>
      </div>
      <div className="px-4 py-4 text-sm sm:px-5">
        {view === "checking" ? (
          <Spinner />
        ) : view === "unsupported" ? (
          <p className="text-ink-2">
            {ios && !standalone
              ? "En iPhone las notificaciones andan con Pesito instalado: tocá Compartir y después “Agregar a inicio”, abrilo desde ahí y volvé a esta página."
              : "Este navegador no permite notificaciones. Podés usar las alertas por mail desde cada búsqueda."}
          </p>
        ) : view === "unconfigured" ? (
          <p className="text-ink-2">
            Este servidor todavía no tiene configuradas las notificaciones. Mientras tanto, usá las alertas por mail desde
            cada búsqueda.
          </p>
        ) : view === "on" ? (
          <>
            <p className="flex items-center gap-2 font-bold">
              <span className="grid size-5 place-items-center rounded-full bg-ink text-paper">
                <CheckIcon />
              </span>
              Activados
            </p>
            <p className="mt-2 text-ink-2">
              Revisamos {count === 1 ? "tu búsqueda" : count ? `tus ${count} búsquedas` : "lo que sigas"} una vez por día
              y te avisamos cuando el más barato baje.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(testPush, { s: "on" }, "Te mandamos una notificación de prueba.")}
                className="rounded-[3px] border border-rule-strong px-3 py-2 font-semibold hover:border-ink disabled:opacity-60"
              >
                Probar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(disablePush, { s: "off" }, "Listo, no te vamos a avisar en este dispositivo.")}
                className="rounded-[3px] px-3 py-2 font-semibold text-ink-2 underline underline-offset-2 hover:text-ink disabled:opacity-60"
              >
                Desactivar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-ink-2">
              Te mandamos una notificación cuando el precio más barato de algo que seguís baje. Sin mail ni cuenta.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(enablePush, { s: "on" }, "Listo. Te mandamos una notificación de prueba.")}
              className="mt-4 inline-flex items-center gap-2 rounded-[3px] bg-ink px-4 py-2.5 font-bold text-paper disabled:bg-ink-3"
            >
              {busy ? "Activando…" : "Activar avisos"} <ArrowIcon />
            </button>
          </>
        )}
        {msg && (
          <p className={`mt-3 flex items-start gap-1.5 ${msg.ok ? "text-ink-2" : "font-semibold text-alert"}`} aria-live="polite">
            {!msg.ok && <AlertIcon />}
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Instalar como app: botón en Chrome/Edge/Android, instrucciones en iPhone. */
function Instalar() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const ios = useIsIos();
  const standalone = useStandalone();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || (!prompt && !ios)) return null;

  return (
    <section aria-labelledby="instalar-titulo" className="rounded-[4px] border border-rule bg-sheet px-4 py-4 text-sm sm:px-5">
      <h2 id="instalar-titulo" className="font-bold">
        Tené Pesito a mano
      </h2>
      {prompt ? (
        <>
          <p className="mt-1.5 text-ink-2">Instalalo como app: abre directo, sin pestañas ni barra del navegador.</p>
          <button
            type="button"
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              setPrompt(null);
            }}
            className="mt-3 rounded-[3px] border border-rule-strong px-3 py-2 font-semibold hover:border-ink"
          >
            Instalar Pesito
          </button>
        </>
      ) : (
        <p className="mt-1.5 text-ink-2">
          En Safari tocá <strong className="font-semibold text-ink">Compartir</strong> y después{" "}
          <strong className="font-semibold text-ink">Agregar a inicio</strong>.
        </p>
      )}
    </section>
  );
}

const noSubscribe = () => () => {};

/** Un valor que solo existe en el navegador; en el server (y al hidratar) vale `server`. */
function useClient<T>(get: () => T, server: T) {
  return useSyncExternalStore(noSubscribe, get, () => server);
}

const useIsIos = () => useClient(() => /iPad|iPhone|iPod/.test(navigator.userAgent), false);
const useStandalone = () => useClient(() => matchMedia("(display-mode: standalone)").matches, false);
