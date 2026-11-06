import { TaskDrawer } from "@/components/tasks/task-drawer";

export default async function ContextualTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <TaskDrawer key={taskId} taskId={taskId} />;
}
