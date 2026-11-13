import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowState } from "@sistema-tasks/contracts";
import { LiveByTaskProvider, buildLiveByTask, openActionsByTask, type LiveSource } from "./live-by-task";
import { useTaskCardExtras } from "@/components/board/task-card";

const NOW = new Date("2026-11-12T15:00:00Z");
const at = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const state = (taskId: string, over: Partial<WorkflowState> = {}): WorkflowState => ({
  taskId, orgId: "o", version: 1, stage: "DOING", deliveryRevision: 1, responsibleId: "u1", criteria: [], context: "", executorIds: [], reviews: [], findings: [],
  summary: { objective: "x", completed: [], remaining: ["a"], nextStep: "a", blockers: [], references: [], updatedAt: at(2), updatedBy: "u1", channel: "MCP" },
  execution: { id: "e", agent: "Claude", ownerId: "u1", channel: "MCP", status: "RUNNING", lastUpdatedAt: at(2) },
  ...over,
} as WorkflowState);
const src = (taskId: string, over: Partial<WorkflowState> = {}): LiveSource => ({ taskId, updatedAt: at(2), state: state(taskId, over), responsibleName: "Marina" });
const action = (taskId: string, question: string) => ({ id: `a-${taskId}`, taskId, orgId: "o", recipientId: "u", kind: "DECIDE", state: "OPEN", question, version: 1 });

const hooks = vi.hoisted(() => ({ team: vi.fn(), mine: vi.fn(), actions: vi.fn() }));
vi.mock("@/lib/hooks/use-workflow", () => ({ useTeamWorkflows: hooks.team, useWorkflowMonitoring: hooks.mine, useMyWorkflowActions: hooks.actions }));
vi.mock("@/lib/hooks/use-now", () => ({ useNow: () => NOW }));

describe("buildLiveByTask", () => {
  it("deriva o estado vivo de cada execução do feed", () => {
    const out = buildLiveByTask([src("t1"), src("t2", { summary: { objective: "x", completed: [], remaining: [], nextStep: "", blockers: ["Falta credencial"], references: [], updatedAt: at(2), updatedBy: "u", channel: "MCP" } as WorkflowState["summary"] })], [], NOW);
    expect(out.t1.kind).toBe("running");
    expect(out.t2.kind).toBe("blocked");
  });
  it("pedido aberto para mim marca Esperando você com a pergunta", () => {
    const out = buildLiveByTask([src("t1")], [action("t1", "Stone ou Cielo?")], NOW);
    expect(out.t1.kind).toBe("you");
    expect(out.t1.reason).toBe("Stone ou Cielo?");
  });
  it("sem sinal passa de 20 minutos, usando a regra de deriveLiveStatus", () => {
    const out = buildLiveByTask([{ ...src("t1"), state: state("t1", { execution: { id: "e", agent: "Claude", ownerId: "u1", channel: "MCP", status: "RUNNING", lastUpdatedAt: at(45) } as WorkflowState["execution"], summary: { objective: "x", completed: [], remaining: ["a"], nextStep: "a", blockers: [], references: [], updatedAt: at(45), updatedBy: "u", channel: "MCP" } as WorkflowState["summary"] }) }], [], NOW);
    expect(out.t1.kind).toBe("silent");
  });
  it("openActionsByTask guarda o primeiro pedido de cada tarefa", () => {
    expect(openActionsByTask([action("t1", "primeira"), action("t1", "segunda")]).t1.question).toBe("primeira");
  });
});

function Probe() {
  const { live } = useTaskCardExtras();
  return <p data-testid="probe">{Object.keys(live ?? {}).sort().join(",")}</p>;
}

describe("LiveByTaskProvider", () => {
  beforeEach(() => {
    hooks.team.mockReset();
    hooks.mine.mockReset();
    hooks.actions.mockReset();
    hooks.actions.mockReturnValue({ data: { pages: [{ actions: [action("t1", "Qual?")] }] } });
    hooks.team.mockReturnValue({ items: [src("t1"), src("t2")] });
    hooks.mine.mockReturnValue({ data: { pages: [{ items: [src("t9")] }] } });
  });

  it("com tarefas.ver_globais usa o feed da equipe e não consulta /mine", () => {
    render(<LiveByTaskProvider canGlobal><Probe /></LiveByTaskProvider>);
    expect(screen.getByTestId("probe")).toHaveTextContent("t1,t2");
    expect(hooks.team).toHaveBeenCalled();
    expect(hooks.mine).not.toHaveBeenCalled();
  });

  it("sem tarefas.ver_globais usa /tasks/workflows/mine e não chama o feed da equipe (403)", () => {
    render(<LiveByTaskProvider canGlobal={false}><Probe /></LiveByTaskProvider>);
    expect(screen.getByTestId("probe")).toHaveTextContent("t9");
    expect(hooks.mine).toHaveBeenCalled();
    expect(hooks.team).not.toHaveBeenCalled();
  });

  it("trocar a fonte não remonta os filhos", () => {
    const { rerender } = render(<LiveByTaskProvider canGlobal={false}><Probe /></LiveByTaskProvider>);
    const before = screen.getByTestId("probe");
    rerender(<LiveByTaskProvider canGlobal><Probe /></LiveByTaskProvider>);
    expect(screen.getByTestId("probe")).toBe(before);
    expect(screen.getByTestId("probe")).toHaveTextContent("t1,t2");
  });
});
