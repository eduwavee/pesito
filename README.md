# PrecioAR — Comparador de precios de hardware

Buscás un producto una vez y ves el precio en **Mercado Libre, Compra Gamer, FullH4rd, Venex, Mexx y Gezatek**, con el más barato resaltado y un resumen de precio mínimo por tienda.

![PrecioAR](docs/screenshot.png)

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Cheerio

## Correr local

```bash
npm install
cp .env.example .env.local   # opcional: credenciales de Mercado Libre
npm run dev                  # http://localhost:3000
```

`DEMO_MODE=1 npm run dev` muestra precios de ejemplo sin consultar ninguna tienda (útil para demos o screenshots).

## Cómo funciona

```
Navegador ──► /api/search/[tienda]?q=...   (una request por tienda, en paralelo)
                    │
                    ├─ cache en memoria 10 min (evita martillar las tiendas)
                    ├─ adapter de la tienda  → Product[]
                    └─ filtro: el título tiene que tener todas las palabras buscadas
```

Cada tienda carga por separado, así la que responde primero aparece primero y si una falla las demás siguen andando.

| Tienda | Cómo se obtiene | Archivo |
|---|---|---|
| Compra Gamer | JSON público del catálogo completo (`static.compragamer.com/productos`, ~2 MB) cacheado 15 min y filtrado en el server | `src/lib/stores/compragamer.ts` |
| FullH4rd | HTML de `/cat/search/{q}` | `fullh4rd.ts` |
| Venex | HTML de `resultado-busqueda.htm` (windows-1252); datos del JSON en `enhancedClick(...)` | `venex.ts` |
| Mexx | HTML de `/buscar/?p=` (deduplica por número de artículo) | `mexx.ts` |
| Gezatek | HTML de `/buscar/?q=`; datos en `data-id / data-nombre / data-precio` | `gezatek.ts` |
| Mercado Libre | API oficial con token (`ML_CLIENT_ID` + `ML_CLIENT_SECRET`); sin credenciales intenta el HTML del listado | `mercadolibre.ts` |

### Mercado Libre

La búsqueda pública de la API (`/sites/MLA/search`) devuelve **403 sin token**, y el listado web suele pedir login a tráfico automatizado. Para que ML funcione bien:

1. Creá una app en <https://developers.mercadolibre.com.ar/devcenter>.
2. Copiá `Client ID` y `Client Secret` a `.env.local`.

Si la búsqueda sigue en 403 con token, el adapter usa el catálogo (`/products/search` + precio de la buy box).

### Agregar una tienda

1. Crear `src/lib/stores/mitienda.ts` exportando un `StoreAdapter` (`search(query, limit) → Product[]`).
2. Sumarlo al `StoreId` en `types.ts`, a `meta.ts` (nombre/color) y a `ADAPTERS` en `stores/index.ts`.

Maximus quedó afuera por ahora: arma el listado con PageMethods de ASP.NET + sesión, así que necesita un navegador headless.

## Deploy

Funciona en Vercel o Render. Tené en cuenta que algunas tiendas (FullH4rd y Maximus usan Cloudflare) pueden bloquear IPs de datacenter; si pasa, la tienda aparece con "error" y las demás siguen andando.

## Aviso

Proyecto de portfolio. Los precios se leen de los sitios públicos de cada tienda y pueden cambiar; siempre hay que verificar en el sitio. Si una tienda cambia su HTML, hay que actualizar su adapter.

---

Hecho por **Eduardo Velazques** — [Sync Solutions](https://instagram.com/sync.tuc)
