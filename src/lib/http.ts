import type { StoreErrorKind } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Error de una tienda con su causa: es lo que termina en `StoreResult.errorKind` y en los logs. */
export class StoreError extends Error {
  constructor(
    public kind: StoreErrorKind,
    message: string,
    /** Dato técnico para el log (código de red, URL final...). No se muestra al usuario. */
    public detail?: string,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

const isBlockStatus = (status: number) => status === 401 || status === 403 || status === 429;

export class HttpError extends StoreError {
  constructor(
    public status: number,
    message: string,
    detail?: string,
  ) {
    super(isBlockStatus(status) ? "blocked" : "http", message, detail);
    this.name = "HttpError";
  }
}

interface FetchOpts {
  timeoutMs?: number;
  /** charset a usar si el server no lo informa bien (ej. Venex = windows-1252) */
  charset?: string;
  headers?: Record<string, string>;
}

/** Traduce una excepción de `fetch` (o de leer el cuerpo) a timeout / error de conexión. */
function networkError(e: unknown, host: string, timeoutMs: number): StoreError {
  if (e instanceof StoreError) return e;
  const err = e instanceof Error ? e : new Error(String(e));
  if (err.name === "TimeoutError" || err.name === "AbortError") {
    return new StoreError("timeout", `${host} tardó más de ${Math.round(timeoutMs / 1000)} s en responder`);
  }
  // undici envuelve el motivo real (ENOTFOUND, ECONNREFUSED, ECONNRESET...) en `cause`
  const cause = err.cause as { code?: string; message?: string } | undefined;
  const code = cause?.code ?? cause?.message ?? err.message;
  return new StoreError("connection", `No se pudo conectar con ${host}`, code);
}

async function raw(url: string, opts: FetchOpts = {}): Promise<Response> {
  const host = new URL(url).host;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "es-AR,es;q=0.9",
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        ...opts.headers,
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw networkError(e, host, timeoutMs);
  }
  // Cloudflare "Just a moment...": la tienda bloquea consultas automáticas, reintentar no sirve
  if (res.headers.get("cf-mitigated") === "challenge") {
    throw new HttpError(403, "La tienda bloquea consultas automáticas (Cloudflare)", "cf-mitigated: challenge");
  }
  if (!res.ok) {
    const via = res.headers.get("server") === "cloudflare" ? ", firewall de Cloudflare" : "";
    throw new HttpError(
      res.status,
      isBlockStatus(res.status)
        ? `${host} rechazó la consulta automática (HTTP ${res.status}${via})`
        : `${host} respondió con error HTTP ${res.status}`,
    );
  }
  return res;
}

/** Lee el cuerpo completo: el timeout también puede saltar acá, con la respuesta a medio bajar. */
async function body(res: Response, url: string, opts: FetchOpts): Promise<ArrayBuffer> {
  const host = new URL(url).host;
  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch (e) {
    throw networkError(e, host, opts.timeoutMs ?? 12_000);
  }
  if (buf.byteLength === 0) throw new StoreError("empty-response", `${host} respondió vacío (HTTP ${res.status})`);
  return buf;
}

export async function getHtml(url: string, opts: FetchOpts = {}): Promise<string> {
  const res = await raw(url, opts);
  const buf = await body(res, url, opts);
  const headerCharset = /charset=([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1];
  const charset = opts.charset ?? headerCharset ?? "utf-8";
  let html: string;
  try {
    html = new TextDecoder(charset).decode(buf);
  } catch {
    // charset desconocido en la cabecera: probamos con utf-8 antes de darlo por perdido
    html = new TextDecoder("utf-8").decode(buf);
  }
  if (!html.trim()) throw new StoreError("empty-response", `${new URL(url).host} respondió vacío (HTTP ${res.status})`);
  return html;
}

export async function getJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await raw(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  const text = new TextDecoder("utf-8").decode(await body(res, url, opts));
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new StoreError(
      "processing",
      `${new URL(url).host} no devolvió un JSON válido`,
      text.slice(0, 80).replace(/\s+/g, " "),
    );
  }
}
