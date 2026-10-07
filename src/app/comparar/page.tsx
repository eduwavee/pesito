import type { Metadata } from "next";
import { Suspense } from "react";
import Versus from "@/components/Versus";

export async function generateMetadata({ searchParams }: PageProps<"/comparar">): Promise<Metadata> {
  const { a, b } = await searchParams;
  const title =
    typeof a === "string" && typeof b === "string" ? `${a} vs ${b} — PrecioAR` : "Uno contra otro — PrecioAR";
  return { title, description: "Compará el precio de dos productos en siete tiendas argentinas." };
}

export default function CompararPage({ searchParams }: PageProps<"/comparar">) {
  return (
    <Suspense fallback={<Versus />}>
      <ConParams searchParams={searchParams} />
    </Suspense>
  );
}

async function ConParams({ searchParams }: { searchParams: PageProps<"/comparar">["searchParams"] }) {
  const { a, b } = await searchParams;
  return <Versus initialA={typeof a === "string" ? a : ""} initialB={typeof b === "string" ? b : ""} />;
}
