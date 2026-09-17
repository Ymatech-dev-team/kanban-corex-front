import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateTaskInput } from "@sistema-tasks/contracts";
import { api } from "@/lib/api";
import type { ProjectCost, Task } from "@/lib/types";

/** Chaves do quadro POR PROJETO (engagement), distintas das do cliente. */
export function engTasksKey(engagementId: string | null) {
  return ["eng-tasks", engagementId] as const;
}
export function engCostKey(engagementId: string | null) {
  return ["eng-cost", engagementId] as const;
}

function idemKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useEngagementTasks(engagementId: string | null) {
  return useQuery<Task[]>({
    queryKey: engTasksKey(engagementId),
    enabled: !!engagementId,
    queryFn: async () =>
      (await api.get<{ tasks: Task[] }>(`/engagements/${engagementId}/tasks`)).data.tasks,
  });
}

export function useEngagementCost(engagementId: string | null, enabled: boolean) {
  return useQuery<ProjectCost>({
    queryKey: engCostKey(engagementId),
    enabled: !!engagementId && enabled,
    queryFn: async () => (await api.get<ProjectCost>(`/engagements/${engagementId}/cost`)).data,
  });
}

export function useCreateEngagementTask(engagementId: string) {
  const qc = useQueryClient();
  return useMutation({
    // `quiet` (quick-add em série) suprime o toast de sucesso — não vai no payload da API.
    mutationFn: async ({ quiet: _quiet, ...input }: CreateTaskInput & { quiet?: boolean }) =>
      (await api.post<Task>(`/engagements/${engagementId}/tasks`, input, { headers: { "idempotency-key": idemKey() } }))
        .data,
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: engTasksKey(engagementId) });
      qc.invalidateQueries({ queryKey: engCostKey(engagementId) });
      qc.invalidateQueries({ queryKey: ["tasks", "all"] }); // visão global reflete a criação [tarefas-visao-global RF-E5]
      // Mantém o cliente consistente: lista/metrics, custo roll-up e a contagem dos cards de projeto.
      // Literais p/ evitar import circular com use-tasks/use-cost/use-engagements. [review B2]
      if (data?.projectId) {
        qc.invalidateQueries({ queryKey: ["tasks", data.projectId] });
        qc.invalidateQueries({ queryKey: ["project-cost", data.projectId] });
        qc.invalidateQueries({ queryKey: ["engagements", data.projectId] });
      }
      if (!vars.quiet) toast.success("Tarefa criada");
    },
    onError: () => toast.error("Não foi possível criar a tarefa"),
  });
}
