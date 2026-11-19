import webpush from "web-push";
import type { PushFollow, PushSub } from "./db/types";
import { siteUrl } from "./mail";

/** Sin las claves VAPID no se puede mandar push: la UI esconde la opción. */
export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function setup() {
  if (ready) return;
  const site = siteUrl();
  // Apple exige un mailto: o una URL https para identificarnos
  const subject = process.env.VAPID_SUBJECT ?? (site.startsWith("https://") ? site : "mailto:pesito@example.com");
  webpush.setVapidDetails(subject, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

/**
 * Solo aceptamos endpoints de los servicios de push de los navegadores: el cron
 * les hace POST, y no queremos que alguien nos use para pegarle a cualquier URL.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  /** a dónde lleva tocar la notificación */
  url: string;
  tag?: string;
}

/** "gone" = el navegador ya no tiene esa suscripción: hay que borrarla. */
export async function sendPush(sub: Pick<PushSub, "endpoint" | "p256dh" | "auth">, payload: PushPayload) {
  setup();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 12 * 3600, urgency: "normal" },
    );
    return "ok" as const;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone" as const;
    console.warn("[push]", status ?? "", e instanceof Error ? e.message : e);
    return "error" as const;
  }
}

/** Para avisar hace falta que baje al menos esto respecto de la referencia. */
const MIN_DROP = 0.01;

/**
 * Decide qué búsquedas seguidas bajaron. La referencia es el último precio avisado
 * o, si nunca avisamos, el precio de cuando se empezó a seguir. Sin precio de base
 * (se siguió algo sin resultados) el primero que encontramos pasa a ser la base.
 */
export function evaluateFollows(follows: PushFollow[], bestByQuery: Map<string, number>) {
  const notify: { query: string; price: number; before: number }[] = [];
  let changed = false;
  const next = follows.map((f) => {
    const price = bestByQuery.get(f.query.toLowerCase());
    if (price === undefined) return f;
    if (f.basePrice === undefined) {
      changed = true;
      return { ...f, basePrice: price };
    }
    const before = f.notifiedPrice ?? f.basePrice;
    if (price <= before * (1 - MIN_DROP)) {
      notify.push({ query: f.query, price, before });
      changed = true;
      return { ...f, notifiedPrice: price };
    }
    return f;
  });
  return { follows: next, notify, changed };
}
