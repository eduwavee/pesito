import type { Metadata } from "next";
import Estado from "@/components/Estado";

export const metadata: Metadata = {
  title: "Estado de las tiendas — Pesito",
  description: "Qué tiendas están respondiendo ahora y cómo anduvieron en los últimos 14 días.",
};

export default function EstadoPage() {
  return <Estado />;
}
