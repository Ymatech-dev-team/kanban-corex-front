import type { TaskStatus, TaskPriority } from "@sistema-tasks/contracts";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  /** Só no GET /projects/:id (singular): a sessão tem custos_ver neste cliente. Sinal de render; a barreira é o backend. */
  canSeeCost?: boolean;
}

/** Projeto (Engagement) dentro de um Cliente. */
export interface Engagement {
  id: string;
  projectId: string; // Cliente dono
  name: string;
  description: string | null;
  taskCount: number;
  consultorCount: number;
  isGeneral: boolean; // "Projeto geral" — não pode ser excluído
}

export interface Consultor {
  id: string;
  name: string;
}

/** Estado do custo de uma tarefa (espelha o backend). Só OK tem valor. */
export type CostState = "OK" | "SEM_RESPONSAVEL" | "RESPONSAVEL_SEM_ACESSO" | "SEM_HORAS" | "SEM_REMUNERACAO";

/** Custo de uma tarefa — GET /tasks/:id/cost (rota separada, gated). */
export interface TaskCost {
  state: CostState;
  cents: number | null;
}

export interface PerPersonCost {
  userId: string;
  name: string;
  realizadoCents: number;
  planejadoCents: number;
  horasAbertoMin: number;
}

/** Resumo de custo por cliente — GET /projects/:id/cost (gated). */
export interface ProjectCost {
  realizadoCents: number;
  planejadoCents: number;
  incompletos: { semResponsavel: number; semRemuneracao: number; semHoras: number; respSemAcesso: number };
  porPessoa: PerPersonCost[];
  moeda: "BRL";
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/** Item do feed da tarefa: um evento automático OU um comentário. [detalhe-tarefa B/C] */
export interface TaskActivity {
  id: string;
  type: string; // tipo do evento, ou "COMMENT"
  actorId: string;
  actorName: string; // snapshot no momento do evento/comentário
  payload: Record<string, unknown>;
  createdAt: string;
  // só quando type === "COMMENT":
  body?: string | null; // null = comentário removido (tombstone)
  editedAt?: string | null;
  canManage?: boolean; // pode editar/excluir (autor ou moderador) — hint de UI
}

export interface Member {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  projectId: string;
  engagementId?: string; // projeto ao qual a tarefa pertence [hierarquia-projetos]
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null; // responsável principal (custo/avatar do card) [detalhe-tarefa A1]
  extraAssigneeIds?: string[]; // responsáveis extras (não inclui o principal)
  estimatedMinutes?: number | null;
  position: number;
  updatedAt?: string;
  subtasks?: Subtask[];
}
