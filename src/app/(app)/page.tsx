"use client";

import { Suspense } from "react";
import { AgoraPage } from "@/components/agora/agora-page";

/** Agora: entrada do app. A leitura da URL (?agrupar, ?ver) exige Suspense no build. */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <AgoraPage />
    </Suspense>
  );
}
