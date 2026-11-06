import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { TaskDetailView, type TaskDetailHandle } from "./task-detail-view";

const state = vi.hoisted(() => ({
  detail: {} as Record<string, unknown>,
  save: vi.fn(),
  refetch: vi.fn(),
  pending: false,
  managed: false,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/hooks/use-tasks", () => ({
  useTaskDetail: () => state.detail,
  useUpdateTask: () => ({ mutateAsync: state.save, isPending: state.pending }),
  useMoveTask: () => ({}),
  useDeleteTask: () => ({}),
  useRestoreTask: () => ({}),
  useCreateTask: () => ({}),
  useAddSubtask: () => ({}),
  useToggleSubtask: () => ({}),
  useDeleteSubtask: () => ({}),
  errorCode: () => undefined,
}));
vi.mock("@/lib/hooks/use-projects", () => ({ useProject: () => ({ data: { name: "Cliente", canSeeCost: false } }) }));
vi.mock("@/lib/hooks/use-members", () => ({ useProjectMembers: () => ({ data: [] }) }));
vi.mock("@/lib/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [] }) }));
vi.mock("@/lib/hooks/use-engagement-board", () => ({ useEngagementTasks: () => ({ data: [] }), useCreateEngagementTask: () => ({}) }));
vi.mock("@/lib/hooks/use-workflow", () => ({ useWorkflow: () => ({ data: { state: state.managed ? { stage: "DOING" } : null } }) }));
vi.mock("@/components/tasks/task-workflow", () => ({ TaskWorkflow: ({ onDirtyChange }: { onDirtyChange: (value: boolean) => void }) => <button onClick={() => onDirtyChange(true)}>Workflow operável</button> }));
vi.mock("@/lib/hooks/use-me", () => ({ useMe: () => ({ data: { userId: "u1", orgId: "o1" } }) }));
vi.mock("@/lib/hooks/use-can", () => ({ useCan: () => true }));
vi.mock("@/lib/hooks/use-cost", () => ({ useTaskCost: () => ({}) }));
vi.mock("@/components/board/assignees-editor", () => ({ AssigneesEditor: () => null }));
vi.mock("@/components/board/attachments-section", () => ({ AttachmentsSection: () => null }));
vi.mock("@/components/board/activity-tab", () => ({ ActivityTab: () => null }));

const task = {
  id: "t1", projectId: "p1", engagementId: "e1", title: "Tarefa existente",
  description: "", status: "TODO", priority: "MEDIUM", estimatedMinutes: null,
  dueDate: null, position: 0, assigneeId: null, subtasks: [], updatedAt: "2026-11-06T10:00:00Z",
};

beforeEach(() => {
  localStorage.clear();
  state.save.mockReset();
  state.pending = false;
  state.managed = false;
  state.refetch.mockReset();
  state.detail = { data: task, isLoading: false, isError: false, isFetchedAfterMount: true, refetch: state.refetch };
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});

describe("TaskDetailView feedback e recuperação", () => {
  it("ignora rascunhos antigos sem identidade e de outro usuário", async () => {
    const draft = { ...task, title: "Texto privado", due: "", estimated: "" };
    localStorage.setItem("sdt_taskdraft_t1", JSON.stringify(draft));
    localStorage.setItem("sdt_taskdraft_o1:outro:t1", JSON.stringify(draft));
    render(<TaskDetailView taskId="t1" />);
    expect(await screen.findByRole("textbox", { name: "Título da tarefa" })).toHaveValue("Tarefa existente");
  });

  it("anuncia o primeiro carregamento com estrutura reservada, sem renderizar campos", () => {
    state.detail = { isLoading: true, refetch: state.refetch };
    render(<TaskDetailView taskId="t1" />);
    expect(screen.getByRole("status", { name: "Carregando tarefa" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Título da tarefa" })).not.toBeInTheDocument();
  });

  it("mantém o rascunho e oferece retry quando atualização de fundo falha", async () => {
    const { rerender } = render(<TaskDetailView taskId="t1" />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Título da tarefa" }), { target: { value: "Minha edição" } });
    state.detail = { ...state.detail, isError: true, error: { response: { status: 503 } } };
    rerender(<TaskDetailView taskId="t1" />);
    expect(screen.getByRole("textbox", { name: "Título da tarefa" })).toHaveValue("Minha edição");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 404])("oculta dados anteriores quando resposta é %s", async (status) => {
    const { rerender } = render(<TaskDetailView taskId="t1" />);
    await screen.findByRole("textbox", { name: "Título da tarefa" });
    state.detail = { ...state.detail, isError: true, error: { response: { status } } };
    rerender(<TaskDetailView taskId="t1" />);
    expect(screen.queryByRole("textbox", { name: "Título da tarefa" })).not.toBeInTheDocument();
    expect(screen.queryByText("Tarefa existente")).not.toBeInTheDocument();
  });

  it("erro ao salvar preserva edição e rascunho e bloqueia envio duplicado em voo", async () => {
    let rejectSave!: (error: Error) => void;
    state.save.mockReturnValue(new Promise((_resolve, reject) => { rejectSave = reject; }));
    render(<TaskDetailView taskId="t1" />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Título da tarefa" }), { target: { value: "Minha edição" } });
    const save = screen.getByRole("button", { name: "Salvar alterações" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(state.save).toHaveBeenCalledTimes(1);
    rejectSave(new Error("Falha de rede"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Suas alterações foram mantidas");
    expect(screen.getByRole("textbox", { name: "Título da tarefa" })).toHaveValue("Minha edição");
    await waitFor(() => expect(localStorage.getItem("sdt_taskdraft_o1:u1:t1")).toContain("Minha edição"));
    state.save.mockResolvedValue({ ...task, title: "Minha edição", updatedAt: "2026-11-06T11:00:00Z" });
    fireEvent.click(save);
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(localStorage.getItem("sdt_taskdraft_o1:u1:t1")).toBeNull());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("expõe salvamento ocupado e impede salvar ou descartar até resposta", async () => {
    const { rerender } = render(<TaskDetailView taskId="t1" />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Título da tarefa" }), { target: { value: "Minha edição" } });
    state.pending = true;
    rerender(<TaskDetailView taskId="t1" />);
    const save = screen.getByRole("button", { name: "Salvando…" });
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
    fireEvent.click(save);
    expect(state.save).not.toHaveBeenCalled();
  });
  it("fechar painel limpo retorna ao contexto sem pedir descarte", async () => {
    const closeRef = createRef<TaskDetailHandle>();
    const onClose = vi.fn();
    render(<TaskDetailView taskId="t1" panel closeRef={closeRef} onClose={onClose} />);
    await screen.findByRole("textbox", { name: "Título da tarefa" });
    act(() => closeRef.current?.requestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Descartar alterações?" })).not.toBeInTheDocument();
  });

  it("fechar painel com edição exige decisão e continuar preserva o texto", async () => {
    const closeRef = createRef<TaskDetailHandle>();
    const onClose = vi.fn();
    render(<TaskDetailView taskId="t1" panel closeRef={closeRef} onClose={onClose} />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Título da tarefa" }), { target: { value: "Rascunho do painel" } });
    act(() => closeRef.current?.requestClose());
    expect(await screen.findByRole("dialog", { name: "Descartar alterações?" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.getByRole("textbox", { name: "Título da tarefa" })).toHaveValue("Rascunho do painel");
    expect(localStorage.getItem("sdt_taskdraft_o1:u1:t1")).toContain("Rascunho do painel");
  });

});

it("keeps managed workflow operable when legacy status updates and ignores stale legacy draft", async () => {
  state.managed = true;
  localStorage.setItem("sdt_taskdraft_o1:u1:t1", JSON.stringify({ ...task, title: "Rascunho antigo", due: "", estimated: "" }));
  const { rerender } = render(<TaskDetailView taskId="t1" />);
  await screen.findByRole("heading", { name: "Tarefa existente" });
  state.detail = { ...state.detail, data: { ...task, status: "DOING", updatedAt: "2026-11-06T11:00:00Z" } };
  rerender(<TaskDetailView taskId="t1" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Workflow operável" })).toBeEnabled());
  expect(screen.getByRole("heading", { name: "Tarefa existente" })).toBeInTheDocument();
});

it("uses managed Resumo/Revisão/Histórico navigation and retains the dirty close guard across tabs", async () => {
  state.managed = true;
  const closeRef = createRef<TaskDetailHandle>();
  render(<TaskDetailView taskId="t1" panel closeRef={closeRef} />);
  const summary = await screen.findByRole("tab", { name: "Resumo" });
  expect(summary).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("button", { name: "Detalhes" })).not.toBeInTheDocument();
  expect(screen.getByText("Dados da tarefa").closest("details")).not.toHaveAttribute("open");
  fireEvent.click(screen.getByRole("button", { name: "Workflow operável" }));
  fireEvent.click(screen.getByRole("tab", { name: "Revisão" }));
  expect(screen.getByRole("tabpanel", { name: "Revisão" })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("tab", { name: "Revisão" }), { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Histórico" })).toHaveFocus();
  act(() => closeRef.current?.requestClose());
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
