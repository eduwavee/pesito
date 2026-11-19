import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import Armador from "@/components/armador/Armador";
import { STORE_LIST } from "@/lib/stores/meta";

const description =
  `Armá tu PC pieza por pieza al mejor precio de ${STORE_LIST}, con chequeo de compatibilidad o a partir de tu presupuesto.`;

export async function generateMetadata({ searchParams }: PageProps<"/armar">): Promise<Metadata> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") params.set(k, v);
  const image = `/api/og/armado?${params.toString()}`;
  return {
    title: "Armá tu PC — Pesito",
    description,
    openGraph: { images: [image] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

/** La imagen para compartir depende del armado (searchParams): la página se arma por pedido. */
async function PorPedido() {
  await connection();
  return null;
}

export default function ArmarPage() {
  return (
    <>
      <Armador />
      <Suspense>
        <PorPedido />
      </Suspense>
    </>
  );
}
