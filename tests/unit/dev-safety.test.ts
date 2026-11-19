import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = join(process.cwd(), "src/app");

/**
 * Regresión: un `src/app/manifest.ts` dinámico, en `next dev` (Next 16.4 + Turbopack),
 * se recompila en cada carga de página y el server manda "HMR hash mismatch" → la página
 * se recarga sin parar (cientos de veces por segundo) y calienta la máquina.
 * El manifest va estático en `public/manifest.webmanifest`.
 */
describe("seguridad del modo desarrollo", () => {
  it("el manifest es estático, no un metadata route dinámico", () => {
    for (const f of ["manifest.ts", "manifest.tsx", "manifest.js", "manifest.json"]) {
      expect(existsSync(join(app, f)), `src/app/${f} provoca un bucle de recargas en next dev`).toBe(false);
    }
    expect(existsSync(join(process.cwd(), "public/manifest.webmanifest"))).toBe(true);
  });
});
