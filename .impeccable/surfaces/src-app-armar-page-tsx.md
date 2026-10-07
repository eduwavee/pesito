---
version: 1
slug: "src-app-armar-page-tsx"
primary_target: "src/app/armar/page.tsx"
related_targets: ["src/components/armador"]
---

# Armado de PC (/armar)

Scope: `/armar`, new surface inside the Cartel flúo world (DESIGN.md governs identity). Mode: Operate. Job: assemble a PC part by part at the lowest live price, know it fits together, or get a build sized to a budget. Integrates three modes confirmed by the user: manual pick, compatibility checks, budget build. Animations "with intention"; 3D PC parts here, cartel objects elsewhere.

## Direction contract

THESIS: A step-by-step build where the PC assembles itself in 3D as you choose, and the total is a fluo cartel corrected live. Refuses the category default of a long form of dropdowns with a sum at the bottom.

OWN-WORLD: Inherited from DESIGN.md: cool card-stock ground, ink, fluo pink only for the cartel and the part being placed, lime only for "compatible/cheapest". 3D parts drawn as white sheets with ink marker outlines (a technical drawing in 3D), the active part pink.

STORY: Visitor picks "Lo armo yo" or "Por presupuesto", walks 7 steps (CPU, mother, RAM, GPU, SSD, fuente, gabinete), sees incompatible offers flagged, watches each part drop into the case and the total rewrite, then copies a share link or opens each store.

FIRST VIEWPORT: Shared top bar with nav (Comparar / Armar PC). Mode switch + 7-step rail. Left 7 cols: current category search + offers (compatible first, badge per offer). Right 5 cols sticky: 3D case, then the total cartel (monumental price, parts count, warnings, todo-en-una-tienda).

FORM: Paso a paso, #5 on ordered structural list, surface seed key 97a4e6ba. Signature interaction: part drops into the 3D case on pick; cartel morphs between routes via ViewTransition.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
