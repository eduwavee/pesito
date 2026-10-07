"use client";

import { useState } from "react";
import { formatArs, formatNum } from "@/lib/format";
import { ArrowIcon, CheckIcon } from "./ui";

/** "Avisame si baja": mail + precio objetivo. Sin cuenta: se activa desde el mail y ahí mismo está la baja. */
export function Alerta({ query, best }: { query: string; best?: number }) {
  const suggested = best ? Math.floor((best * 0.95) / 1000) * 1000 : undefined;
  const [email, setEmail] = useState("");
  const [raw, setRaw] = useState(suggested ? String(suggested) : "");
  const [state, setState] = useState<
    { s: "idle" } | { s: "sending" } | { s: "ok"; emailed: boolean } | { s: "error"; msg: string }
  >({ s: "idle" });
  const target = Number(raw.replace(/\D/g, ""));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ s: "sending" });
    try {
      const res = await fetch("/api/alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, query, target }),
      });
      const body = await res.json();
      if (!res.ok) setState({ s: "error", msg: body.error ?? "No pudimos crear la alerta" });
      else setState({ s: "ok", emailed: body.emailed });
    } catch {
      setState({ s: "error", msg: "Sin conexión. Probá de nuevo." });
    }
  }

  return (
    <section aria-labelledby="alerta-titulo" className="rounded-[4px] border border-rule bg-sheet">
      <div className="border-b border-rule px-4 py-3.5 sm:px-5">
        <h2 id="alerta-titulo" className="font-bold">
          Avisame si baja
        </h2>
      </div>
      {state.s === "ok" ? (
        <div className="px-4 py-5 sm:px-5" aria-live="polite">
          <p className="flex items-center gap-2 font-bold">
            <span className="grid size-5 place-items-center rounded-full bg-ink text-paper">
              <CheckIcon />
            </span>
            Falta un paso: confirmá desde tu mail.
          </p>
          <p className="mt-2 text-sm text-ink-2">
            Te mandamos un link a {email}. Cuando lo confirmes, revisamos las tiendas todos los días y te escribimos
            cuando alguna tenga “{query}” a {formatArs(target)} o menos.
            {!state.emailed &&
              " (En este servidor no está configurado el envío de mails: el link de confirmación quedó en la consola del servidor.)"}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 px-4 py-4 sm:px-5">
          <label className="block">
            <span className="text-sm font-semibold">Cuando cueste</span>
            <span className="mt-1 flex items-baseline border-b-2 border-ink">
              <span className="cartel-num text-xl">$</span>
              <input
                value={target ? formatNum(target) : ""}
                onChange={(e) => setRaw(e.target.value)}
                inputMode="numeric"
                placeholder="350.000"
                className="cartel-num w-full min-w-0 bg-transparent px-1 pb-0.5 text-2xl outline-none placeholder:text-ink-3 focus-visible:outline-none"
              />
              <span className="shrink-0 text-sm text-ink-2">o menos</span>
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Tu mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vos@mail.com"
              className="mt-1 w-full rounded-[3px] border border-rule-strong bg-sheet px-3 py-2 outline-none focus:border-ink"
            />
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="submit"
              disabled={state.s === "sending"}
              className="inline-flex items-center gap-2 rounded-[3px] bg-ink px-4 py-2.5 text-sm font-bold text-paper disabled:bg-ink-3"
            >
              {state.s === "sending" ? "Guardando…" : "Avisame"} <ArrowIcon />
            </button>
            <p className="text-xs text-ink-2" aria-live="polite">
              {state.s === "error" ? <span className="font-semibold text-alert">{state.msg}</span> : "Sin cuenta. Confirmás y te das de baja desde el mail."}
            </p>
          </div>
        </form>
      )}
    </section>
  );
}
