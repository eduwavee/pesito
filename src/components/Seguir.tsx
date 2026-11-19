"use client";

import { follow, isFollowing, unfollow, useSeguidos } from "@/lib/seguidos";
import type { Product } from "@/lib/types";

/** Seguir / dejar de seguir una búsqueda. Guarda el precio de hoy como referencia. */
export function Seguir({ query, best }: { query: string; best?: Product }) {
  const list = useSeguidos();
  const on = isFollowing(list, query);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => (on ? unfollow(query) : follow(query, best && { price: best.price, store: best.store }))}
      title={on ? "Dejar de seguir" : "Guardala en Seguidos para ver cómo cambia el precio"}
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-3 py-1.5 text-sm font-semibold transition-colors ${
        on ? "border-ink bg-ink text-paper" : "border-rule-strong bg-sheet text-ink hover:border-ink"
      }`}
    >
      <StarIcon filled={on} />
      {on ? "Siguiendo" : "Seguir"}
    </button>
  );
}

export function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.6l1.95 4.1 4.45.55-3.27 3.08.84 4.42L8 11.6l-3.97 2.15.84-4.42L1.6 6.25l4.45-.55z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
