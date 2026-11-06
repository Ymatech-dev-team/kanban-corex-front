"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TaskDetailView, type TaskDetailHandle } from "./task-detail-view";

/** Intercepted route only: a direct URL still renders the full task page. */
export function TaskDrawer({ taskId }: { taskId: string }) {
  const router = useRouter();
  const detail = useRef<TaskDetailHandle>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const close = () => detail.current?.requestClose();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        placement="right"
        showCloseButton={false}
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
          });
        }}
        onEscapeKeyDown={(event) => { event.preventDefault(); close(); }}
        onInteractOutside={(event) => { event.preventDefault(); close(); }}
      >
        <DialogTitle className="sr-only">Detalhes da tarefa</DialogTitle>
        <DialogDescription className="sr-only">Edite a tarefa sem perder o contexto do painel.</DialogDescription>
        <TaskDetailView taskId={taskId} panel closeRef={detail} onClose={() => router.back()} />
      </DialogContent>
    </Dialog>
  );
}
