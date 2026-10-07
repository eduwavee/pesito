import type { Metadata } from "next";
import { Suspense } from "react";
import Comparador from "@/components/Comparador";

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim().slice(0, 80) : "";
  if (term.length < 2) return {};
  const image = `/api/og/busqueda?q=${encodeURIComponent(term)}`;
  return {
    title: `${term} — dónde está más barato | Pesito`,
    description: `Precio de ${term} en Mercado Libre, Compra Gamer, FullH4rd, Venex, Mexx, Gezatek y Frávega.`,
    openGraph: { images: [image] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<Comparador />}>
      <WithQuery searchParams={searchParams} />
    </Suspense>
  );
}

async function WithQuery({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { q } = await searchParams;
  return <Comparador initialQuery={typeof q === "string" ? q : ""} />;
}
