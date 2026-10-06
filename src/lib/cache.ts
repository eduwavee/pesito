/** Cache en memoria simple con TTL (alcanza para un proyecto de portfolio / una instancia). */
type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<{ value: T; hit: boolean }> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return { value: hit.value, hit: true };

  // evita pedir lo mismo 2 veces en paralelo
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fn().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  const value = await p;
  store.set(key, { value, expires: Date.now() + ttlMs });
  if (store.size > 500) {
    for (const [k, v] of store) if (v.expires < now) store.delete(k);
  }
  return { value, hit: false };
}
