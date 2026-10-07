import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Imagen para compartir (1200×630) en el mundo del cartel: papel, el cartel rosa
 * con el número grande y una lista de apoyo a la derecha. Satori solo entiende flexbox.
 */

const INK = "#16171a";
const INK2 = "#50535b";
const PAPER = "#eef0ea";
const SHEET = "#ffffff";
const FLUO = "#ff3d8b";
const RULE = "#d6d9d0";

let fonts: Promise<{ name: string; data: Buffer; weight: 500 | 700 | 900; style: "normal" }[]> | undefined;
function loadFonts() {
  const dir = join(process.cwd(), "src/assets/fonts");
  fonts ??= Promise.all([
    readFile(join(dir, "ArchivoCondensed-Black.ttf")).then((data) => ({
      name: "Cartel",
      data,
      weight: 900 as const,
      style: "normal" as const,
    })),
    readFile(join(dir, "Archivo-Bold.ttf")).then((data) => ({ name: "Archivo", data, weight: 700 as const, style: "normal" as const })),
    readFile(join(dir, "Archivo-Medium.ttf")).then((data) => ({ name: "Archivo", data, weight: 500 as const, style: "normal" as const })),
  ]);
  return fonts;
}

export interface OgRow {
  label: string;
  value: string;
  dot?: string;
  strong?: boolean;
}

export async function cartelImage({
  heading,
  price,
  caption,
  rows,
  footer,
}: {
  /** línea arriba del número, ej "Más barato en Venex" */
  heading: string;
  /** número sin "$", ej "384.500" (o "—" si no hay) */
  price: string;
  /** debajo del número, ej el título del producto */
  caption?: string;
  rows: OgRow[];
  footer: string;
}) {
  // el número tiene que entrar en el cartel: achica según la cantidad de caracteres
  const size = Math.min(136, Math.floor(500 / ((price.length + 2) * 0.47)));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, fontFamily: "Archivo" }}>
        {/* barra de marca */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: INK, color: PAPER, padding: "22px 56px" }}>
          <div
            style={{
              display: "flex",
              width: 44,
              height: 44,
              background: FLUO,
              color: INK,
              borderRadius: 4,
              alignItems: "center",
              justifyContent: "center",
              transform: "rotate(-6deg)",
              fontFamily: "Cartel",
              fontSize: 30,
            }}
          >
            $
          </div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>Pesito</div>
          <div style={{ marginLeft: "auto", fontSize: 22, fontWeight: 500, opacity: 0.7 }}>{footer}</div>
        </div>

        <div style={{ display: "flex", flex: 1, padding: "44px 56px", gap: 48, alignItems: "center" }}>
          {/* el cartel */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 600,
              background: FLUO,
              color: INK,
              padding: "36px 40px",
              borderRadius: 6,
              transform: "rotate(-1.5deg)",
              boxShadow: "0 30px 40px -24px rgba(22,23,26,0.55)",
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 700 }}>{heading}</div>
            <div style={{ display: "flex", alignItems: "flex-start", fontFamily: "Cartel", lineHeight: 0.9, marginTop: 10 }}>
              <span style={{ fontSize: size * 0.42, marginTop: size * 0.1, marginRight: 6 }}>$</span>
              <span style={{ fontSize: size }}>{price}</span>
              <span style={{ fontSize: size }}>.-</span>
            </div>
            {caption && (
              <div style={{ fontSize: 24, fontWeight: 500, marginTop: 14, maxWidth: 520, lineClamp: 2, display: "block" }}>
                {caption}
              </div>
            )}
          </div>

          {/* lista de apoyo */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, background: SHEET, border: `1px solid ${RULE}`, borderRadius: 6 }}>
            {rows.slice(0, 8).map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 22px",
                  borderTop: i ? `1px solid ${RULE}` : "none",
                  fontSize: 23,
                  color: INK,
                }}
              >
                {r.dot && <div style={{ width: 13, height: 13, borderRadius: 13, background: r.dot }} />}
                <div style={{ fontWeight: r.strong ? 700 : 500, color: r.strong ? INK : INK2 }}>{r.label}</div>
                <div style={{ marginLeft: "auto", fontWeight: 700 }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: await loadFonts(),
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    },
  );
}
