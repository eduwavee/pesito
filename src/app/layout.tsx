import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "PrecioAR — Comparador de precios de hardware",
  description: "Compará precios de Mercado Libre, Compra Gamer, FullH4rd, Venex, Mexx, Gezatek y Frávega en un solo lugar.",
  openGraph: { images: ["/api/og/busqueda"], locale: "es_AR", siteName: "PrecioAR" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#16171a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${archivo.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {children}
        {/* aplica el tema elegido antes de pintar, para que no haya un destello claro */}
        <Script id="tema" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("precioar:tema");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`}
        </Script>
      </body>
    </html>
  );
}
