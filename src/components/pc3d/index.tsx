"use client";

import dynamic from "next/dynamic";

/** Three.js pesa: se carga aparte y solo en el navegador. */
export const PcScene = dynamic(() => import("./PcScene"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-[3px] bg-rule/40" aria-hidden="true" />,
});
