import type { Metadata } from "next";
import { ClientDetail } from "@/components/client/client-detail";

export const metadata: Metadata = { title: "Cliente — YMALOG" };

export default async function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetail projectId={id} />;
}
