import type { Metadata } from "next";
import Seguidos from "@/components/Seguidos";

export const metadata: Metadata = {
  title: "Seguidos — Pesito",
  description: "Lo que estás por comprar, con el precio de hoy y avisos cuando baja.",
};

export default function SeguidosPage() {
  return <Seguidos />;
}
