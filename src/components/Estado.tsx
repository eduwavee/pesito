"use client";

import { useEffect, useState } from "react";
import type { DayStatus, StoreHealth } from "@/lib/health";
import { STORES } from "@/lib/stores/meta";
import { AlertIcon, CheckIcon, Dot, Footer, Spinner, TopBar } from "./ui";

interface Report {
  checkedAt?: string;
  stores: StoreHealth[];
}

const DAY_LABEL: Record<DayStatus, string> = {
  ok: "respondió siempre",
  partial: "falló algunas veces",
  down: "no respondió",
  none: "sin chequeos",
};

/** Celda de la tira de 14 días: tinta = anduvo, rojo = no, rayado = a veces, línea = sin datos. */
const DAY_CLASS: Record<DayStatus, string> = {
  ok: "bg-ink",
  partial: "bg-[repeating-linear-gradient(135deg,var(--alert)_0_2px,transparent_2px_4px)] ring-1 ring-inset ring-alert",
  down: "bg-alert",
  none: "border border-dashed border-rule-strong",
};

const fmtDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

function ago(iso?: string) {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

export default function Estado() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/estado")
      .then((r) => (r.ok ? (r.json() as Promise<Report>) : Promise.reject()))
      .then(setReport)
      .catch(() => setError(true));
  }, []);

  const up = report?.stores.filter((s) => s.current?.status === "ok").length ?? 0;
  const total = report?.stores.length ?? 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <h1 className="cartel-num text-[clamp(2.75rem,7vw,4.5rem)] uppercase leading-[0.95]">Estado de las tiendas</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
          Cada tienda se revisa todos los días con dos búsquedas de prueba. Si una se rompe (nos bloquea o cambia su
          página), la ves acá y en el comparador aparece como “no respondió”, sin frenar a las demás.
        </p>

        {error ? (
          <p className="mt-10 font-semibold text-alert">No pudimos cargar el estado. Probá de nuevo en un rato.</p>
        ) : !report ? (
          <p className="mt-10 flex items-center gap-2 text-ink-2">
            <Spinner /> Revisando las tiendas…
          </p>
        ) : (
          <>
            <p className="mt-8 text-xl font-bold" aria-live="polite">
              {up === total ? "Todas las tiendas responden." : `${up} de ${total} tiendas responden.`}
              <span className="ml-2 text-base font-normal text-ink-2">Último chequeo: {ago(report.checkedAt)}.</span>
            </p>

            <div className="mt-6">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-ink text-xs font-semibold uppercase tracking-wide text-ink-3">
                    <th scope="col" className="py-2 pr-4">Tienda</th>
                    <th scope="col" className="py-2 pr-4">Ahora</th>
                    <th scope="col" className="hidden py-2 pr-4 md:table-cell">Últimos 14 días</th>
                    <th scope="col" className="py-2 text-right sm:pr-4">Anduvo</th>
                    <th scope="col" className="hidden py-2 text-right sm:table-cell">Responde en</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {report.stores.map((s) => (
                    <Row key={s.store} s={s} />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2" aria-label="Referencias">
              {(["ok", "partial", "down", "none"] as DayStatus[]).map((d) => (
                <li key={d} className="flex items-center gap-2">
                  <span className={`inline-block h-4 w-2.5 rounded-[2px] ${DAY_CLASS[d]}`} aria-hidden="true" />
                  {DAY_LABEL[d][0].toUpperCase() + DAY_LABEL[d].slice(1)}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Row({ s }: { s: StoreHealth }) {
  const c = s.current;
  const ok = c?.status === "ok";
  const summary = s.days.filter((d) => d.status !== "none");
  const bad = summary.filter((d) => d.status !== "ok").length;
  return (
    <tr className="align-top">
      <th scope="row" className="py-3.5 pr-4 font-semibold">
        <span className="flex items-center gap-2 whitespace-nowrap">
          <Dot store={s.store} /> {STORES[s.store].name}
        </span>
      </th>
      <td className="py-3.5 pr-4">
        {!c ? (
          <span className="text-ink-3">Sin chequeos</span>
        ) : ok ? (
          <span className="flex items-center gap-2 font-semibold">
            <span className="grid size-4 place-items-center rounded-full bg-ink text-paper">
              <CheckIcon size={8} />
            </span>
            Responde
          </span>
        ) : (
          <span className="block max-w-xs text-alert">
            <span className="flex items-center gap-1.5 font-semibold">
              <AlertIcon /> {c.status === "empty" ? "Sin productos" : c.blocked ? "Nos bloquea" : "Falla"}
            </span>
            {c.message && <span className="mt-0.5 block text-sm text-ink-2">{c.message}</span>}
            <span className="mt-0.5 block text-xs text-ink-3">Última vez que anduvo: {ago(s.lastOk)}</span>
          </span>
        )}
        <div className="mt-2.5 md:hidden">
          <Strip s={s} bad={bad} summary={summary.length} compact />
        </div>
      </td>
      <td className="hidden py-3.5 pr-4 md:table-cell">
        <Strip s={s} bad={bad} summary={summary.length} />
      </td>
      <td className="cartel-num py-3.5 text-right text-xl sm:pr-4">{s.uptime === undefined ? "—" : `${s.uptime}%`}</td>
      <td className="hidden py-3.5 text-right tabular-nums text-ink-2 sm:table-cell">
        {s.avgMs === undefined ? "—" : s.avgMs < 1000 ? `${s.avgMs} ms` : `${(s.avgMs / 1000).toFixed(1)} s`}
      </td>
    </tr>
  );
}

/** La tira de 14 días de una tienda. */
function Strip({ s, bad, summary, compact = false }: { s: StoreHealth; bad: number; summary: number; compact?: boolean }) {
  return (
    <ol
      className={`flex ${compact ? "gap-[2px]" : "gap-[3px]"}`}
      aria-label={
        summary
          ? `${STORES[s.store].name}: ${bad ? `${bad} de ${summary} días con fallas` : `anduvo los ${summary} días revisados`}`
          : `${STORES[s.store].name}: sin chequeos todavía`
      }
    >
      {s.days.map((d) => (
        <li
          key={d.day}
          title={`${fmtDay(d.day)}: ${DAY_LABEL[d.status]}`}
          className={`${compact ? "h-4 w-[7px] rounded-[1px]" : "h-6 w-2.5 rounded-[2px]"} ${DAY_CLASS[d.status]}`}
        />
      ))}
    </ol>
  );
}
