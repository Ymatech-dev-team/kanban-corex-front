import { toast } from "sonner";

/**
 * Toast de "Desfazer" pós-exclusão (soft-delete + undo). Janela de 8s (maior que o default do sonner
 * porque o delete de Cliente/Tarefa troca de tela). `onUndo` chama o restore; o sonner fecha o toast no
 * clique da ação, então dispara uma vez só (e o restore no backend é idempotente). [excluir-com-seguranca]
 */
export function undoToast(message: string, onUndo: () => void) {
  toast(message, {
    duration: 8000,
    action: { label: "Desfazer", onClick: onUndo },
  });
}
