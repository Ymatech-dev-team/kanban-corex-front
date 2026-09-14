import { TaskDetailView } from "@/components/tasks/task-detail-view";

/** Tela de detalhe da tarefa (substitui o modal). O componente resolve cliente/projeto/membros
 *  pelo próprio dado da tarefa. [tela-detalhe-tarefa] */
export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <TaskDetailView taskId={taskId} />;
}
