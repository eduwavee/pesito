import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/**
 * Regresión: en el build, Next ejecuta los GET que no leen el pedido para prerenderizarlos.
 * /api/estado corría el monitor sin red y anotaba todas las tiendas "caídas" (y mandaba el aviso).
 * Todo GET que no use el pedido tiene que llamar a connection() antes de hacer nada.
 */
describe("rutas que no se ejecutan en el build", () => {
  const routes = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? routes(join(dir, e.name)) : /^route\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
    );
  it("todo GET sin request llama a connection()", () => {
    const sinPedido = routes(join(app, "api")).filter((f) => /export async function GET\(\)/.test(readFileSync(f, "utf8")));
    expect(sinPedido.length).toBeGreaterThan(0);
    for (const f of sinPedido) expect(readFileSync(f, "utf8"), f).toMatch(/await connection\(\)/);
  });
  it("el cron también (lee el pedido solo si hay CRON_SECRET)", () => {
    expect(readFileSync(join(app, "api/cron/route.ts"), "utf8")).toMatch(/await connection\(\)/);
  });
});
