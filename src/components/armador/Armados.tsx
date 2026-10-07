"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatArs } from "@/lib/format";
import { PARTS } from "@/lib/builder/parts";

type Mine = { id: string; name: string; key: string; total: number; parts: number; at: string };
type Popular = { key: string; total: number; parts: number; count: number };

const KEY = "precioar:mis-armados";
const read = (): Mine[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Mine[];
  } catch {
    return [];
  }
};
const write = (list: Mine[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
};

const DATE = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

/** Guardar el armado actual con un nombre (en este navegador) y ver los más armados por la gente. */
export function Armados({ current, total, parts }: { current: string; total: number; parts: number }) {
  const [mine, setMine] = useState<Mine[]>([]);
  const [popular, setPopular] = useState<Popular[] | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    // localStorage solo existe en el navegador: se lee después de montar
    const t = setTimeout(() => setMine(read()), 0);
    fetch("/api/armados")
      .then((r) => r.json())
      .then((d) => setPopular(d.builds ?? []))
      .catch(() => setPopular([]));
    return () => clearTimeout(t);
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !total) return;
    const item: Mine = {
      id: crypto.randomUUID(),
      name: name.trim() || `Armado de ${formatArs(total)}`,
      key: current,
      total,
      parts,
      at: new Date().toISOString(),
    };
    const next = [item, ...mine.filter((m) => m.key !== current)].slice(0, 12);
    setMine(next);
    write(next);
    setName("");
  };
  const remove = (id: string) => {
    const next = mine.filter((m) => m.id !== id);
    setMine(next);
    write(next);
  };

  return (
    <section className="mt-16 grid grid-cols-1 gap-8 border-t border-ink pt-8 lg:grid-cols-2" aria-label="Armados">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mis armados</h2>
        <p className="mt-1 text-sm text-ink-2">Se guardan en este navegador, sin cuenta.</p>
        <form onSubmit={save} className="mt-4 flex gap-2">
          <label htmlFor="nombre-armado" className="sr-only">
            Nombre del armado
          </label>
          <input
            id="nombre-armado"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={total ? `Armado de ${formatArs(total)}` : "Elegí piezas para guardar"}
            disabled={!total}
            className="min-w-0 flex-1 rounded-[3px] border border-rule-strong bg-sheet px-3 py-2 outline-none focus:border-ink disabled:bg-paper"
          />
          <button
            type="submit"
            disabled={!total}
            className="rounded-[3px] bg-ink px-4 py-2 text-sm font-bold text-paper disabled:bg-ink-3"
          >
            Guardar
          </button>
        </form>
        {mine.length > 0 ? (
          <ul className="mt-4 divide-y divide-rule rounded-[4px] border border-rule bg-sheet">
            {mine.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/armar?${m.key}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-semibold">{m.name}</span>
                  <span className="text-xs text-ink-2">
                    {m.parts} de {PARTS.length} piezas · {DATE.format(new Date(m.at))}
                  </span>
                </Link>
                <span className="cartel-num text-xl">{formatArs(m.total)}</span>
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  className="text-xs font-semibold text-ink-2 underline hover:text-alert"
                  aria-label={`Borrar ${m.name}`}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-[3px] border border-dashed border-rule-strong px-4 py-5 text-sm text-ink-2">
            Todavía no guardaste ninguno. Guardá variantes (con y sin placa, Intel vs AMD) y compará los totales.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Los más armados</h2>
        <p className="mt-1 text-sm text-ink-2">Armados completos o compartidos por otras personas. El precio es el de ese día.</p>
        {popular === null ? (
          <div className="mt-4 h-32 animate-pulse rounded-[4px] bg-rule/50" aria-hidden="true" />
        ) : popular.length ? (
          <ul className="mt-4 divide-y divide-rule rounded-[4px] border border-rule bg-sheet">
            {popular.map((b, i) => (
              <li key={b.key}>
                <Link href={`/armar?${b.key}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                  <span className="cartel-num w-6 text-lg text-ink-3">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{describe(b.key)}</span>
                    <span className="text-xs text-ink-2">
                      {b.parts} piezas · {b.count} {b.count === 1 ? "vez" : "veces"}
                    </span>
                  </span>
                  <span className="cartel-num text-xl">{formatArs(b.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-[3px] border border-dashed border-rule-strong px-4 py-5 text-sm text-ink-2">
            Todavía no hay armados populares. Completá o compartí el tuyo y aparece acá.
          </p>
        )}
      </div>
    </section>
  );
}

/** "Ryzen 5 7600 + RTX 5060": lo que identifica un armado de un vistazo. */
function describe(key: string) {
  const p = new URLSearchParams(key);
  const q = (id: string) => (p.get(id) ?? "").split("~")[0];
  return [q("cpu"), q("gpu")].filter(Boolean).join(" + ") || "Armado";
}
