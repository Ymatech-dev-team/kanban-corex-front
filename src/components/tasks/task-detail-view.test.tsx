import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { TaskDetailView, safeInternalPath, type TaskDetailHandle } from "./task-detail-view";

const managedState = { stage: "DOING", version: 7, deliveryRevision: 2, responsibleId: "m1", context: "Contexto da entrega", criteria: ["Critério visível"], executorIds: [], reviews: [], findings: [], execution: { agent: "Claude", channel: "MCP", status: "RUNNING", lastUpdatedAt: "2026-11-06T10:00:00Z" } };
const state = vi.hoisted(() => ({
  detail: {} as Record<string, unknown>,
  save: vi.fn(),
  refetch: vi.fn(),
  pending: false,
  managed: false,
  push: vi.fn(),
  search: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
  useSearchParams: () => new URLSearchParams(state.search),
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
vi.mock("@/lib/hooks/use-workflow", () => ({ useWorkflow: () => ({ data: { state: state.managed ? managedState : null } }) }));
// A folha (seções, índice, diário) tem testes próprios em task-sheet; aqui ela é um espaço reservado que expõe o contrato com o detalhe.
vi.mock("@/components/task-sheet/task-sheet", () => ({ TaskSheet: ({ header, file, fileOpen, onFileOpenChange, onWorkflowDirtyChange, flowLocked }: { header: React.ReactNode; file: React.ReactNode; fileOpen: boolean; onFileOpenChange: (open: boolean) => void; onWorkflowDirtyChange: (value: boolean) => void; flowLocked: boolean }) => <div data-testid="sheet" data-file-open={String(fileOpen)} data-flow-locked={String(flowLocked)}>{header}<button onClick={() => onWorkflowDirtyChange(true)}>Workflow operável</button><button aria-expanded={fileOpen} onClick={() => onFileOpenChange(!fileOpen)}>Ficha</button>{file}</div> }));
vi.mock("@/lib/hooks/use-me", () => ({ useMe: () => ({ data: { userId: "u1", orgId: "o1" } }) }));
vi.mock("@/lib/hooks/use-can", () => ({ useCan: () => true }));
vi.mock("@/lib/hooks/use-cost", () => ({ useTaskCost: () => ({}) }));
vi.mock("@/components/board/assignees-editor", () => ({ AssigneesEditor: () => null }));
vi.mock("@/components/board/attachments-section", () => ({ AttachmentsSection: () => null }));

const task = {
  id: "t1", projectId: "p1", engagementId: "e1", title: "Tarefa existente",
  description: "", status: "TODO", priority: "MEDIUM", estimatedMinutes: null,
  dueDate: null, position: 0, assigneeId: null, subtasks: [], updatedAt: "2026-11-06T10:00:00Z",
};

beforeEach(() => {
  localStorage.clear();
  state.push.mockReset();
  state.search = "";
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

it("single-scroll sheet: managed workflow has no tabs, keeps the Ficha collapsed and retains the dirty close guard", async () => {
  state.managed = true;
  const closeRef = createRef<TaskDetailHandle>();
  render(<TaskDetailView taskId="t1" panel closeRef={closeRef} />);
  expect(await screen.findByRole("heading", { name: "Tarefa existente" })).toBeInTheDocument();
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Detalhes" })).not.toBeInTheDocument();
  expect(screen.getByTestId("sheet")).toHaveAttribute("data-file-open", "false"); // execução viva: Ficha recolhida
  fireEvent.click(screen.getByRole("button", { name: "Workflow operável" }));
  act(() => closeRef.current?.requestClose());
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("opens the Ficha when the task has no workflow, and lets the user override the default", async () => {
  render(<TaskDetailView taskId="t1" />);
  await screen.findByRole("textbox", { name: "Título da tarefa" });
  expect(screen.getByTestId("sheet")).toHaveAttribute("data-file-open", "true");
  fireEvent.click(screen.getByRole("button", { name: "Ficha" }));
  expect(screen.getByTestId("sheet")).toHaveAttribute("data-file-open", "false");
});

it("shows the header facts (RF29) and keeps the managed context and criteria in the Ficha", async () => {
  state.managed = true;
  state.detail = { ...state.detail, data: { ...task, dueDate: "2020-01-10T12:00:00Z", priority: "HIGH" } };
  render(<TaskDetailView taskId="t1" />);
  expect(await screen.findByRole("heading", { name: "Tarefa existente" })).toBeInTheDocument();
  expect(screen.getByText("Cliente")).toBeInTheDocument();
  expect(screen.getByText("Claude")).toBeInTheDocument();
  expect(screen.getAllByText("Alta").length).toBeGreaterThan(0);
  expect(screen.getByText(/venceu/)).toBeInTheDocument();
  expect(screen.getByText("2 · v7")).toBeInTheDocument();
  expect(screen.getByText("Contexto da entrega")).toBeInTheDocument();
  expect(screen.getByText("Critério visível")).toBeInTheDocument();
  expect(screen.queryByText("Mover etapa")).not.toBeInTheDocument(); // com fluxo a etapa muda pelo fluxo, não pelo campo legado
});

it("exposes Mover etapa in the header for tasks without workflow and saves from outside the Ficha", async () => {
  state.save.mockResolvedValue({ ...task, status: "DOING", updatedAt: "2026-11-06T11:00:00Z" });
  render(<TaskDetailView taskId="t1" />);
  const group = await screen.findByRole("group", { name: "Mover etapa" });
  fireEvent.click(within(group).getByRole("button", { name: "Fazendo" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ patch: expect.objectContaining({ status: "DOING" }) })));
});

it("locks the workflow area while field edits are unsaved", async () => {
  render(<TaskDetailView taskId="t1" />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Título da tarefa" }), { target: { value: "Editando" } });
  expect(screen.getByTestId("sheet")).toHaveAttribute("data-flow-locked", "true");
});

describe("safeInternalPath (?from) — sem open redirect", () => {
  it.each([
    ["tab", "/\t/evil.com"],
    ["LF + barra invertida", "/\n\\evil.com"],
    ["CR + //", "/\r//evil.com"],
    ["barra invertida", "/\\evil.com"],
    ["//evil.com", "//evil.com"],
    ["https://evil.com", "https://evil.com"],
    ["javascript:", "javascript:alert(1)"],
    ["relativo", "tarefas"],
    ["vazio", ""],
    ["nulo", null],
  ])("rejeita %s", (_name, value) => {
    expect(safeInternalPath(value as string | null)).toBeNull();
  });
  it("rejeita os mesmos valores vindos codificados (%09, %0A, %0D), que o searchParams decodifica", () => {
    for (const encoded of ["/%09/evil.com", "/%0A%5Cevil.com", "/%0D//evil.com"]) {
      expect(safeInternalPath(new URLSearchParams(`from=${encoded}`).get("from"))).toBeNull();
    }
  });
  it("preserva caminho interno válido, com query e hash", () => {
    expect(safeInternalPath("/tarefas")).toBe("/tarefas");
    expect(safeInternalPath("/clientes/c1/projetos/p1?visao=ativas#topo")).toBe("/clientes/c1/projetos/p1?visao=ativas#topo");
    expect(safeInternalPath("/")).toBe("/");
  });
  it("ao fechar, navega para o caminho padrão (nunca para fora) quando ?from é forjado, e para o interno quando é válido", async () => {
    state.search = "from=%2F%09%2Fevil.com";
    const closeRef = createRef<TaskDetailHandle>();
    const { unmount } = render(<TaskDetailView taskId="t1" closeRef={closeRef} />);
    await screen.findByRole("textbox", { name: "Título da tarefa" });
    act(() => closeRef.current?.requestClose());
    expect(state.push).toHaveBeenLastCalledWith("/clientes/p1/projetos/e1");
    unmount();
    state.search = "from=%2Ftarefas%3Fvisao%3Drodando";
    const second = createRef<TaskDetailHandle>();
    render(<TaskDetailView taskId="t1" closeRef={second} />);
    await screen.findByRole("textbox", { name: "Título da tarefa" });
    act(() => second.current?.requestClose());
    expect(state.push).toHaveBeenLastCalledWith("/tarefas?visao=rodando");
  });
});

describe("folha: título da aba e alvos de toque", () => {
  it("define o título da aba com o da tarefa e restaura ao sair", async () => {
    document.title = "Antes";
    const { unmount } = render(<TaskDetailView taskId="t1" />);
    await screen.findByRole("textbox", { name: "Título da tarefa" });
    expect(document.title).toBe("Tarefa existente · Corex Tasks");
    unmount();
    expect(document.title).toBe("Antes");
  });

  it("subtarefa: marcar e remover têm alvo de 44 px no celular e o remover aparece no foco", async () => {
    state.detail = { ...state.detail, data: { ...task, subtasks: [{ id: "s1", title: "Sub", done: false }] } };
    render(<TaskDetailView taskId="t1" />);
    const check = await screen.findByRole("button", { name: "Marcar como feita" });
    const remove = screen.getByRole("button", { name: "Remover subtarefa" });
    expect(check.className).toMatch(/max-md:size-11/);
    expect(remove.className).toMatch(/max-md:size-11/);
    expect(remove.className).toMatch(/focus-visible:text-muted-foreground/);
  });
});
