import type { Metadata } from "next";
import { ProjectBoard } from "@/components/board/project-board";

export const metadata: Metadata = { title: "Projeto — YMALOG" };

export default async function ProjetoBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; engagementId: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  const { id, engagementId } = await params;
  const { task } = await searchParams;
  // key força remount ao trocar de projeto → estado (filtro/aba) reinicia limpo. [RF-68]
  return <ProjectBoard key={engagementId} clientId={id} engagementId={engagementId} initialTaskId={task ?? null} />;
}
