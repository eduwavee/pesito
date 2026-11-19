import { useSyncExternalStore } from "react";
import type { StoreId } from "./types";

/**
 * Búsquedas seguidas, sin cuenta: viven en el navegador (localStorage). Si el
 * dispositivo activó notificaciones, cada cambio se copia al server para que el
 * cron sepa qué revisar.
 */
export interface Seguido {
  query: string;
  /** el más barato cuando lo empezaste a seguir */
  basePrice?: number;
  baseStore?: StoreId;
  addedAt: string;
}

const KEY = "precioar:seguidos";
const EVENT = "precioar:seguidos";
const MAX = 30;
const EMPTY: Seguido[] = [];

let cacheRaw: string | null | undefined;
let cacheList: Seguido[] = EMPTY;

function read(): Seguido[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  // useSyncExternalStore necesita la misma referencia si no cambió nada
  if (raw === cacheRaw) return cacheList;
  cacheRaw = raw;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    cacheList = Array.isArray(parsed) ? parsed.filter((s) => typeof s?.query === "string") : EMPTY;
  } catch {
    cacheList = EMPTY;
  }
  return cacheList;
}

function write(list: Seguido[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
  syncPush().catch(() => {});
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage); // otras pestañas
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSeguidos(): Seguido[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function isFollowing(list: Seguido[], query: string) {
  return list.some((s) => same(s.query, query));
}

export function follow(query: string, best?: { price: number; store: StoreId }) {
  const list = read();
  if (isFollowing(list, query)) return;
  write([{ query: query.trim(), basePrice: best?.price, baseStore: best?.store, addedAt: new Date().toISOString() }, ...list]);
}

export function unfollow(query: string) {
  write(read().filter((s) => !same(s.query, query)));
}

/* ---------- Notificaciones push ---------- */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function registerServiceWorker() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function currentPush(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function postPush(sub: PushSubscription, test = false) {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      follows: read().map((s) => ({ query: s.query, basePrice: s.basePrice })),
      test,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "No pudimos guardar los avisos");
}

/** Pide permiso, suscribe este dispositivo y manda una notificación de prueba. */
export async function enablePush() {
  if (!pushSupported()) throw new Error("Este navegador no permite notificaciones");
  if (!VAPID_PUBLIC_KEY) throw new Error("Las notificaciones no están configuradas en este servidor");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Bloqueaste las notificaciones para este sitio. Habilitalas desde la configuración del navegador."
        : "No diste permiso para las notificaciones.",
    );
  }
  await registerServiceWorker();
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID_PUBLIC_KEY) }));
  try {
    await postPush(sub, true);
  } catch (e) {
    await sub.unsubscribe().catch(() => {});
    throw e;
  }
  return sub;
}

export async function testPush() {
  const sub = await currentPush();
  if (!sub) throw new Error("Las notificaciones no están activadas");
  await postPush(sub, true);
}

export async function disablePush() {
  const sub = await currentPush();
  if (!sub) return;
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}

/** Copia la lista al server si este dispositivo tiene notificaciones. */
async function syncPush() {
  const sub = await currentPush();
  if (sub) await postPush(sub);
}
