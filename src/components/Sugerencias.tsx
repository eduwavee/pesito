"use client";

import { useEffect, useId, useState } from "react";
import { SearchIcon } from "./ui";

/** Respuestas del navegador: escribir "rtx 5", borrar y volver a escribir no repite pedidos. */
const memo = new Map<string, Promise<string[]>>();

function fetchCompletions(q: string): Promise<string[]> {
  const key = q.trim().toLowerCase();
  let hit = memo.get(key);
  if (!hit) {
    hit = fetch(`/api/sugerencias?q=${encodeURIComponent(key)}`)
      .then((r) => r.json() as Promise<{ completions?: string[] }>)
      .then((d) => d.completions ?? [])
      .catch(() => []);
    memo.set(key, hit);
  }
  return hit;
}

/**
 * Autocompletado para un input de búsqueda. Devuelve los props para el input y la lista;
 * la lista se ubica debajo del contenedor `relative` más cercano.
 */
export function useAutocomplete({
  input,
  setInput,
  onPick,
}: {
  input: string;
  setInput: (v: string) => void;
  onPick: (v: string) => void;
}) {
  const id = useId();
  const [items, setItems] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  // solo se abre mientras el usuario escribe, no al volver a enfocar ni después de elegir
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!typing || input.trim().length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      fetchCompletions(input).then((list) => {
        if (!alive) return;
        setItems(list);
        setActive(-1);
      });
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [input, typing]);

  const open = typing && input.trim().length >= 2 && items.length > 0;
  const close = () => {
    setTyping(false);
    setActive(-1);
  };
  const pick = (v: string) => {
    close();
    setInput(v);
    onPick(v);
  };

  const inputProps = {
    role: "combobox",
    "aria-expanded": open,
    "aria-controls": `${id}-lista`,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": open && active >= 0 ? `${id}-${active}` : undefined,
    autoComplete: "off",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
      setTyping(true);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        pick(items[active]);
      } else if (e.key === "Escape") {
        close();
      }
    },
    onBlur: close,
  };

  const list = open ? (
    <ul
      id={`${id}-lista`}
      role="listbox"
      aria-label="Sugerencias"
      className="anim-rise absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-[3px] border border-rule-strong bg-sheet py-1 text-left text-base font-medium normal-case text-ink shadow-[0_16px_32px_-16px_rgba(22,23,26,0.5)]"
    >
      {items.map((s, i) => (
        <li
          key={s}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          // mousedown: si fuera click, el blur del input cerraría la lista antes
          onMouseDown={(e) => {
            e.preventDefault();
            pick(s);
          }}
          onMouseEnter={() => setActive(i)}
          className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${i === active ? "bg-paper" : ""}`}
        >
          <span className="text-ink-3">
            <SearchIcon />
          </span>
          {s}
        </li>
      ))}
    </ul>
  ) : null;

  return { inputProps, list, close };
}
