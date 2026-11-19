export type Use = "gaming" | "oficina" | "edicion";

export const USES: { id: Use; name: string }[] = [
  { id: "gaming", name: "Gaming" },
  { id: "oficina", name: "Oficina y estudio" },
  { id: "edicion", name: "Edición y streaming" },
];
