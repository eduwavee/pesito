import { Suspense } from "react";
import Comparador from "@/components/Comparador";

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
