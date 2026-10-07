import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Pega contra las tiendas reales: sirve para enterarse cuando una cambia su HTML o bloquea la IP. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/live/**/*.test.ts"], testTimeout: 30_000 },
});
