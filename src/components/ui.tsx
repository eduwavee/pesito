"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { STORES } from "@/lib/stores/meta";
import type { StoreId } from "@/lib/types";

/* ---------- Estructura compartida ---------- */

const NAV = [
  { href: "/", label: "Comparar precios", short: "Precios" },
  { href: "/comparar", label: "Uno contra otro", short: "A vs B" },
  { href: "/armar", label: "Armar PC", short: "Armar" },
] as const;

export function TopBar({ children, onHome }: { children?: React.ReactNode; onHome?: () => void }) {
  const path = usePathname();
  return (
    <header className="light-scope sticky top-0 z-30 bg-ink text-paper">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6">
        <Link
          href="/"
          onClick={onHome}
          className="group flex shrink-0 items-center gap-2.5 rounded-sm text-lg font-extrabold tracking-tight focus-visible:outline-paper"
          aria-label="Pesito, inicio"
        >
          <Logo />
          <span className="hidden lg:inline">Pesito</span>
        </Link>

        <nav aria-label="Secciones" className="flex shrink-0 gap-1 text-sm font-semibold">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative whitespace-nowrap rounded-[3px] px-2.5 py-2 transition-colors focus-visible:outline-paper ${
                  active ? "text-paper" : "text-paper/65 hover:text-paper"
                }`}
              >
                <span className="sm:hidden">{n.short}</span>
                <span className="hidden sm:inline">{n.label}</span>
                {active && (
                  <span className="absolute inset-x-2.5 -bottom-0.5 h-[3px] rounded-full bg-paper" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </nav>

        {children}

        <ThemeToggle />

        <a
          href="https://instagram.com/sync.tuc"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden shrink-0 text-sm text-paper/70 underline-offset-4 hover:text-paper hover:underline xl:block"
        >
          by Sync Solutions
        </a>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-rule">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Precios leídos en vivo de cada tienda (se guardan 10 minutos). Verificá siempre el precio final en el sitio.
        </p>
        <p className="shrink-0">
          Hecho por{" "}
          <a
            href="https://instagram.com/sync.tuc"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ink underline"
          >
            Sync Solutions
          </a>
        </p>
      </div>
    </footer>
  );
}

/* ---------- Piezas ---------- */

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-[3px] border border-rule-strong bg-sheet p-0.5 text-sm"
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`whitespace-nowrap rounded-[2px] px-2.5 py-1.5 font-medium transition-colors sm:px-3 ${
            value === v ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function Dot({ store, className = "" }: { store: StoreId; className?: string }) {
  return (
    <span
      className={`inline-block size-2.5 shrink-0 rounded-full ring-1 ring-ink/25 ${className}`}
      style={{ background: STORES[store].color }}
      aria-hidden="true"
    />
  );
}

/** Precio tachado con un trazo de fibrón. */
export function Struck({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** ms: para tachar varios en secuencia */
  delay?: number;
}) {
  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <svg
        style={{ "--strike-delay": `${delay}ms` } as React.CSSProperties}
        className="anim-strike pointer-events-none absolute left-[-6%] top-[52%] h-[0.45em] w-[112%] -translate-y-1/2 overflow-visible text-ink"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M2 7 C 25 3, 55 8, 98 3"
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

/** Tira de cinta que sostiene el cartel contra la pared. */
export function Tape({ className = "" }: { className?: string }) {
  return <span className={`tape pointer-events-none absolute h-7 w-24 ${className}`} aria-hidden="true" />;
}

export function Logo() {
  return (
    <span
      className="grid size-8 rotate-[-6deg] place-items-center rounded-[3px] bg-fluo light-scope text-ink transition-transform duration-300 ease-out-expo group-hover:rotate-0"
      aria-hidden="true"
    >
      <span className="cartel-num text-lg leading-none">$</span>
    </span>
  );
}

export function Spinner() {
  return (
    <span
      className="size-3.5 animate-spin rounded-full border-2 border-rule-strong border-t-ink motion-reduce:animate-none"
      role="status"
      aria-label="buscando"
    />
  );
}

export function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 8H3.5M7.5 3.5 3 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.75" />
      <path d="m10.5 10.5 3.25 3.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="m2 5.2 2 2L8 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1.75 12.75 12H1.25L7 1.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 5.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="10.2" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.75 9.25a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-.75.74"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9.25 6.75a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l.75-.74"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Compartir: en el celu abre el menú del sistema (WhatsApp, etc.); en la compu copia el link. */
export function ShareButton({ title, text, quiet = false }: { title: string; text: string; quiet?: boolean }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // cancelado: no hacemos nada
        return;
      }
    }
    await navigator.clipboard?.writeText(url);
    setDone(true);
    setTimeout(() => setDone(false), 2200);
  };
  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex items-center gap-2 text-sm font-bold ${
        quiet ? "underline underline-offset-4" : "rounded-[3px] bg-ink px-4 py-2.5 text-paper"
      }`}
    >
      <LinkIcon /> <span aria-live="polite">{done ? "¡Link copiado!" : "Compartir"}</span>
    </button>
  );
}

/** Claro / oscuro. Arranca siguiendo al sistema; si lo cambiás, se recuerda. */
function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setDark(root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
    read();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("precioar:tema", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Pasar a modo claro" : "Pasar a modo oscuro"}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className="ml-auto grid size-9 shrink-0 place-items-center rounded-[3px] text-paper/75 transition-colors hover:bg-paper/10 hover:text-paper focus-visible:outline-paper"
    >
      {dark === null ? null : dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M14.5 11.2A6.25 6.25 0 0 1 6.8 3.5a6.25 6.25 0 1 0 7.7 7.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9 1.75v1.8M9 14.45v1.8M1.75 9h1.8M14.45 9h1.8M3.9 3.9l1.27 1.27M12.83 12.83l1.27 1.27M3.9 14.1l1.27-1.27M12.83 5.17l1.27-1.27"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
