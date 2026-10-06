const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface FetchOpts {
  timeoutMs?: number;
  /** charset a usar si el server no lo informa bien (ej. Venex = windows-1252) */
  charset?: string;
  headers?: Record<string, string>;
}

async function raw(url: string, opts: FetchOpts = {}): Promise<Response> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "es-AR,es;q=0.9",
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      ...opts.headers,
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
  });
  if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status} en ${new URL(url).host}`);
  return res;
}

export async function getHtml(url: string, opts: FetchOpts = {}): Promise<string> {
  const res = await raw(url, opts);
  const buf = await res.arrayBuffer();
  const headerCharset = /charset=([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1];
  const charset = opts.charset ?? headerCharset ?? "utf-8";
  return new TextDecoder(charset).decode(buf);
}

export async function getJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await raw(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  return (await res.json()) as T;
}
