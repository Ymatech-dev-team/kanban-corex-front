import type { ReactElement, ReactNode } from "react";
import { act, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type WorkflowState } from "@sistema-tasks/contracts";
import { AgoraPage } from "./agora-page";
import { sheetHref } from "./open-sheet";

const NOW = new Date("2026-11-12T17:32:00Z"); // 14:32 BRT
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const mock = vi.hoisted(() => ({
  search: "",
  push: vi.fn(),
  replace: vi.fn(),
  permissions: [] as string[],
  team: {} as Record<string, unknown>,
  mine: {} as Record<string, unknown>,
  actions: {} as Record<string, unknown>,
  tasks: {} as Record<string, unknown>,
  workflow: {} as Record<string, unknown>,
  mutateAsync: vi.fn(),
  api: { get: vi.fn(), post: vi.fn() },
  allTasksCalls: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mock.push, replace: mock.replace }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(mock.search),
}));
vi.mock("@/lib/api", () => ({ api: mock.api }));
vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/hooks/use-me", () => ({ useMe: () => ({ isPending: false, data: { userId: "me", permissions: mock.permissions } }) }));
vi.mock("@/lib/hooks/use-projects", () => ({ useProjects: () => ({ data: [{ id: "c-ima", name: "IMA" }, { id: "c-corex", name: "Corex" }] }) }));
vi.mock("@/lib/hooks/use-all-tasks", () => ({ useAllTasks: (...args: unknown[]) => { mock.allTasksCalls(...args); return mock.tasks; } }));
vi.mock("@/lib/hooks/use-workflow", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/hooks/use-workflow")>()),
  useTeamWorkflows: () => mock.team,
  useWorkflowMonitoring: () => mock.mine,
  useMyWorkflowActions: () => mock.actions,
  useWorkflow: () => mock.workflow,
  useWorkflowWrite: () => ({ mutateAsync: mock.mutateAsync, isPending: false }),
}));

const REQUIRED = ["typecheck", "lint", "test", "build"];
function state(over: Partial<WorkflowState> & { taskId: string }): WorkflowState {
  return { orgId: "org", version: 7, stage: "DOING", deliveryRevision: 1, responsibleId: "u1", criteria: [], context: "", executorIds: ["agent"], reviews: [], findings: [], ...over } as WorkflowState;
}
const exec = (agent: string, status: "RUNNING" | "PAUSED", minutesAgo: number, channel: "MCP" | "WEB" = "MCP") => ({ id: "e", agent, ownerId: "o", channel, status, lastUpdatedAt: ago(minutesAgo) });
const summary = (over: Record<string, unknown> = {}) => ({ objective: "Objetivo da tarefa", completed: ["Passo A", "Passo B", "Passo C", "Passo D"], remaining: ["Passo F"], nextStep: "Passo E", blockers: [], references: [], updatedAt: ago(5), updatedBy: "o", channel: "MCP", ...over });
const feedItem = (taskId: string, title: string, clientName: string, st: WorkflowState, over: Record<string, unknown> = {}) =>
  ({ taskId, title, clientId: `c-${clientName.toLowerCase()}`, clientName, projectName: "Projeto", responsibleName: null, assigneeName: null, updatedAt: st.summary?.updatedAt ?? ago(5), state: st, ...over });

const silent = feedItem("t-silent", "Tela de login", "Conexão", state({ taskId: "t-silent", execution: exec("Codex", "RUNNING", 120), summary: summary({ updatedAt: ago(120) }) } as never));
const blocked = feedItem("t-block", "Relatório fiscal", "IMA", state({ taskId: "t-block", execution: exec("Claude", "RUNNING", 5), summary: summary({ blockers: ["Falta acesso ao banco"] }) } as never));
const running = feedItem("t-run", "Conciliação de recarga", "IMA", state({ taskId: "t-run", execution: exec("Claude", "RUNNING", 3), summary: summary() } as never));
const runningAna = feedItem("t-ana", "Produtos sazonais", "IMA", state({ taskId: "t-ana", execution: exec("Ana", "RUNNING", 6, "WEB"), summary: summary() } as never), { responsibleName: "Ana" });
const doneToday = feedItem("t-done", "Rebrand do painel", "Corex", state({ taskId: "t-done", stage: "DONE", execution: exec("Codex", "PAUSED", 40) } as never), { updatedAt: "2026-11-12T16:58:00Z" });
const FEED = [silent, blocked, running, runningAna, doneToday];

const query = (data: unknown, over: Record<string, unknown> = {}) => ({ data, isLoading: false, isError: false, isSuccess: true, isFetching: false, hasNextPage: false, isFetchingNextPage: false, refetch: vi.fn(), dataUpdatedAt: NOW.getTime(), ...over });
const team = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, isLoading: false, isError: false, isFetching: false, truncated: false, refetch: vi.fn(), dataUpdatedAt: NOW.getTime(), ...over });
const actions = (list: unknown[], over: Record<string, unknown> = {}) => query({ pages: [{ actions: list, nextCursor: null }] }, over);
const decide = { id: "a1", taskId: "t-run", orgId: "org", recipientId: "me", kind: "DECIDE", state: "OPEN", version: 3, question: "Stone ou Cielo?", options: ["Stone", "Cielo"], createdAt: ago(12), taskTitle: "Conciliação de recarga", clientName: "IMA", projectName: "Projeto" };

const capabilities = { canWrite: true, canReview: true, canApprove: true, canReopen: false };
function reviewState(checks: Array<[string, "passed" | "failed"]>, findings: unknown[] = []) {
  return state({ taskId: "t-rev", stage: "IN_REVIEW", version: 9, execution: exec("Codex", "RUNNING", 40), summary: summary(), findings: findings as never,
    reviews: [{ reviewMode: "HUMAN", cycle: 1, deliveryRevision: 1, submittedBy: "agent", submittedAt: ago(40), summary: "Pronto", evidence: [], checks: checks.map(([name, status]) => ({ name, status, required: true })), decision: "pending" }] } as never);
}
const reviewAction = { id: "a2", taskId: "t-rev", orgId: "org", recipientId: "me", kind: "REVIEW", state: "OPEN", version: 1, question: "Revisar entrega — ciclo 1", createdAt: ago(40), taskTitle: "E-mail de boas-vindas", clientName: "Corex", projectName: "Site" };
const allPassed = REQUIRED.map(name => [name, "passed"] as [string, "passed"]);

// ActionResponse usa useQueryClient (recarrega o fluxo no 409): os hooks de dados são simulados, o provider não.
const render = (ui: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(ui, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
};

function setViewport(narrow: boolean) {
  window.matchMedia = ((q: string) => ({ matches: narrow && q.includes("max-width"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null })) as never;
}
const rowsOf = () => screen.queryAllByRole("row").filter(row => row.hasAttribute("data-row"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mock.search = "";
  mock.allTasksCalls.mockReset(); mock.push.mockReset(); mock.replace.mockReset(); mock.mutateAsync.mockReset(); mock.api.get.mockReset(); mock.api.post.mockReset();
  mock.permissions = [PERMISSIONS.tarefas_ver_globais];
  mock.team = team(FEED);
  mock.mine = { ...query({ pages: [{ items: [running], nextCursor: null }] }) };
  mock.actions = actions([]);
  mock.tasks = query({ tasks: [], hasMore: false });
  mock.workflow = query({ state: null, events: [], actions: [], capabilities });
  setViewport(false);
});
afterEach(() => { vi.useRealTimers(); });

describe("Agora — situação e filtros", () => {
  it("mostra título Agora, data em mono e as contagens", () => {
    mock.actions = actions([decide]);
    render(<AgoraPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Agora" })).toBeInTheDocument();
    expect(screen.getByText("qui 12 nov · 14:32")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 rodando" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 esperando você" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 sem sinal" })).toBeInTheDocument();
    expect(screen.getByText("1 concluída hoje")).toBeInTheDocument();
  });

  it("no celular a área de toque é um pseudo-elemento: o botão não cresce e o pressionado não vira bloco alto", () => {
    mock.search = "ver=sinal";
    render(<AgoraPage />);
    const pressed = screen.getByRole("button", { name: "1 sem sinal" });
    const idle = screen.getByRole("button", { name: "2 rodando" });
    for (const button of [pressed, idle]) {
      expect(button.className).not.toMatch(/min-h-/);
      expect(button.className).toMatch(/max-md:before:-inset-y-3/);
    }
    expect(pressed.className).not.toMatch(/(^|\s)(max-md:)?p[yb]-/);
    expect(idle.className).toMatch(/underline-offset-4/);
    expect(pressed.className).toMatch(/no-underline/);
  });

  it("clicar numa contagem filtra Em andamento e guarda ?ver= na URL", async () => {
    const user = userEvent.setup();
    render(<AgoraPage />);
    expect(rowsOf()).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "1 sem sinal" }));
    expect(mock.replace).toHaveBeenCalledWith("/?ver=sinal", { scroll: false });
  });

  it("?ver=sinal filtra a tabela e marca o botão como pressionado; clicar de novo limpa", async () => {
    mock.search = "ver=sinal";
    const user = userEvent.setup();
    render(<AgoraPage />);
    expect(rowsOf()).toHaveLength(1);
    expect(rowsOf()[0]).toHaveTextContent("Tela de login");
    const button = screen.getByRole("button", { name: "1 sem sinal" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await user.click(button);
    expect(mock.replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("?ver=rodando mostra só rodando e o resto some do filtro", () => {
    mock.search = "ver=rodando";
    render(<AgoraPage />);
    expect(rowsOf().map(row => row.getAttribute("data-kind"))).toEqual(["running", "running"]);
  });

  it("filtro sem resultado diz isso e oferece limpar", async () => {
    mock.search = "ver=voce";
    const user = userEvent.setup();
    render(<AgoraPage />);
    expect(screen.getByText("Nada nesse filtro agora.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtro" }));
    expect(mock.replace).toHaveBeenCalledWith("/", { scroll: false });
  });
});

describe("Agora — Em andamento", () => {
  it("ordena por urgência e agrupa por estado por padrão", () => {
    render(<AgoraPage />);
    expect(rowsOf().map(row => row.getAttribute("data-kind"))).toEqual(["silent", "blocked", "running", "running"]);
    const groups = screen.getAllByRole("rowheader").map(header => header.textContent);
    expect(groups).toEqual(["Sem sinal1", "Bloqueadas1", "Rodando2"]);
  });

  it("?agrupar=pessoa agrupa por quem; trocar o agrupamento escreve na URL", async () => {
    mock.search = "agrupar=pessoa";
    const user = userEvent.setup();
    render(<AgoraPage />);
    expect(screen.getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Ana1", "Claude2", "Codex1"]);
    await user.click(screen.getByRole("radio", { name: "Por cliente" }));
    expect(mock.replace).toHaveBeenCalledWith("/?agrupar=cliente", { scroll: false });
  });

  it("?agrupar=cliente agrupa por cliente", () => {
    mock.search = "agrupar=cliente";
    render(<AgoraPage />);
    expect(screen.getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Conexão1", "IMA3"]);
  });

  it("Enter expande a linha com objetivo, últimos 3 feitos, próximo passo e ações; Enter de novo recolhe", async () => {
    const user = userEvent.setup();
    render(<AgoraPage />);
    const row = rowsOf()[0];
    row.focus();
    await user.keyboard("{Enter}");
    expect(row).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(row.getAttribute("aria-controls")!)!;
    expect(within(panel).getByText("Objetivo da tarefa")).toBeInTheDocument();
    expect(within(panel).queryByText("Passo A")).toBeNull();
    for (const step of ["Passo B", "Passo C", "Passo D"]) expect(within(panel).getByText(step)).toBeInTheDocument();
    expect(within(panel).getByText("Passo E")).toBeInTheDocument();
    expect(within(panel).getByText(/Último relato às/)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Abrir folha" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Copiar pedido de retomada" })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(row).toHaveAttribute("aria-expanded", "false");
  });

  it("execução rodando não oferece pedido de retomada", async () => {
    const user = userEvent.setup();
    render(<AgoraPage />);
    await user.click(rowsOf()[2]);
    const panel = document.getElementById(rowsOf()[2].getAttribute("aria-controls")!)!;
    expect(within(panel).queryByRole("button", { name: "Copiar pedido de retomada" })).toBeNull();
  });

  it("↑/↓ navegam entre linhas e O abre a folha da linha focada", async () => {
    const user = userEvent.setup();
    render(<AgoraPage />);
    const rows = rowsOf();
    rows[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(rows[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowUp}");
    expect(rows[1]).toHaveFocus();
    await user.keyboard("o");
    expect(mock.push).toHaveBeenCalledWith(sheetHref("t-block"), { scroll: false });
  });

  it("roving tabindex: uma só parada de Tab (a linha ativa); ↑/↓ movem a parada; o painel é rotulado pela linha", async () => {
    const user = userEvent.setup();
    render(<AgoraPage />);
    const rows = rowsOf();
    expect(rows.map(row => row.tabIndex)).toEqual([0, -1, -1, -1]);
    rows[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(rowsOf().map(row => row.tabIndex)).toEqual([-1, 0, -1, -1]);
    await user.keyboard("{Enter}");
    const panel = document.getElementById(rowsOf()[1].getAttribute("aria-controls")!)!;
    expect(panel).toHaveAttribute("aria-labelledby", rowsOf()[1].id);
  });

  it("se a linha ativa some (filtro), a primeira volta a ser a parada de Tab", async () => {
    mock.search = "";
    const { rerender } = render(<AgoraPage />);
    act(() => rowsOf()[3].focus());
    expect(rowsOf()[3].tabIndex).toBe(0);
    mock.search = "ver=sinal";
    rerender(<AgoraPage />);
    expect(rowsOf().map(row => row.tabIndex)).toEqual([0]);
  });

  it("mostra o canal com rótulo único: MCP e Painel", () => {
    render(<AgoraPage />);
    expect(screen.getAllByText("MCP").length).toBeGreaterThan(0);
    expect(screen.getByText("Painel")).toBeInTheDocument();
  });

  it("mostra 'atualizado HH:MM' em mono e as dicas de teclado", () => {
    render(<AgoraPage />);
    expect(screen.getByText("atualizado 14:32")).toHaveClass("mono");
    expect(screen.getByText(/abre a folha/)).toBeInTheDocument();
  });

  it("mostra 'atualizado HH:MM' mesmo com Em andamento vazio (RF16)", () => {
    mock.team = team([]);
    render(<AgoraPage />);
    expect(screen.getByText("atualizado 14:32")).toHaveClass("mono");
  });

  it("avisa quando o feed foi cortado em 300", () => {
    mock.team = team(FEED, { truncated: true });
    render(<AgoraPage />);
    expect(screen.getByText(/mostrando os 300 mais recentes/)).toBeInTheDocument();
  });

  it("sem execuções convida a criar tarefa ou conectar um agente (Conta › conexões MCP)", () => {
    mock.team = team([]);
    render(<AgoraPage />);
    expect(screen.getByText("Nada em andamento agora.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar tarefa" })).toHaveAttribute("href", "/tarefas");
    expect(screen.getByRole("link", { name: /Conta › conexões MCP/ })).toHaveAttribute("href", "/conta#mcp-connections-title");
  });

  it("carregando mostra esqueleto com a forma final", () => {
    mock.team = team([], { isLoading: true });
    render(<AgoraPage />);
    expect(screen.getByRole("status", { name: "Carregando execuções em andamento" })).toBeInTheDocument();
  });

  it("erro do feed fica no bloco, com Tentar novamente, sem derrubar Prazos nem Feito hoje", async () => {
    const refetch = vi.fn();
    mock.team = team([], { isError: true, refetch });
    mock.tasks = query({ tasks: [{ id: "k1", projectId: "c-ima", title: "Revisão do contrato", status: "TODO", dueDate: "2026-11-13T12:00:00.000Z" }], hasMore: false });
    render(<AgoraPage />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível consultar as execuções em andamento.");
    expect(screen.getByRole("link", { name: "Revisão do contrato" })).toBeInTheDocument();
    await userEvent.setup().click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("Agora — blocos que somem e Prazos / Feito hoje", () => {
  it("sem pedidos, sem prazos e sem concluídas, os três blocos não existem", () => {
    mock.team = team([running]);
    render(<AgoraPage />);
    expect(screen.queryByRole("heading", { name: "Esperando você" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Prazos" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Feito hoje" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Em andamento" })).toBeInTheDocument();
  });

  it("Prazos: até 8, vencidas em alerta, ordenadas, só até domingo, sem concluídas", () => {
    const task = (n: number, due: string, status = "TODO") => ({ id: `k${n}`, projectId: "c-ima", title: `Tarefa ${n}`, status, dueDate: due });
    mock.tasks = query({ hasMore: false, tasks: [
      task(1, "2026-11-13T12:00:00.000Z"), task(2, "2026-09-30T12:00:00.000Z"), task(3, "2026-11-14T12:00:00.000Z", "DONE"),
      task(4, "2026-11-15T12:00:00.000Z"), task(5, "2026-11-16T12:00:00.000Z"), // segunda: fora da semana
      ...[6, 7, 8, 9, 10, 11, 12, 13].map(n => task(n, `2026-11-1${n % 3 + 3}T12:00:00.000Z`)),
    ] });
    render(<AgoraPage />);
    const block = screen.getByRole("heading", { name: "Prazos" }).closest("section")!;
    const links = within(block).getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveTextContent("Tarefa 2");
    expect(within(block).queryByText("Tarefa 3")).toBeNull();
    expect(within(block).queryByText("Tarefa 5")).toBeNull();
    const overdue = within(block).getByText("30 set");
    expect(overdue).toHaveClass("text-warning", "mono");
    expect(within(block).getAllByText(/· IMA/).length).toBeGreaterThan(0);
  });

  it("erro em Prazos é isolado", async () => {
    const refetch = vi.fn();
    mock.tasks = query(undefined, { isError: true, isSuccess: false, refetch });
    render(<AgoraPage />);
    const block = screen.getByRole("heading", { name: "Prazos" }).closest("section")!;
    expect(within(block).getByRole("alert")).toHaveTextContent("Não foi possível consultar os prazos.");
    expect(screen.getAllByRole("row").length).toBeGreaterThan(0); // Em andamento segue de pé
    await userEvent.setup().click(within(block).getByRole("button", { name: "Tentar novamente" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("Feito hoje lista hora BRT, quem e título", () => {
    render(<AgoraPage />);
    const block = screen.getByRole("heading", { name: "Feito hoje" }).closest("section")!;
    expect(within(block).getByText("13:58")).toHaveClass("mono");
    expect(block).toHaveTextContent("Codex concluiu Rebrand do painel");
  });
});

describe("Agora — Esperando você", () => {
  it("opção resolve com o texto da opção e a versão do pedido; mostra a confirmação e o pedido de retomada", async () => {
    mock.actions = actions([decide]);
    mock.mutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AgoraPage />);
    const block = screen.getByRole("heading", { name: "Esperando você" }).closest("section")!;
    expect(block).toHaveTextContent("Claude pergunta");
    expect(block).toHaveTextContent("Stone ou Cielo?");
    expect(block).toHaveTextContent("IMA › Projeto");
    await user.click(within(block).getByRole("button", { name: "Stone" }));
    expect(mock.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mock.mutateAsync).toHaveBeenCalledWith({ kind: "resolve", actionId: "a1", values: { expectedVersion: 3, response: "Stone", resolution: "RESOLVED" } });
    expect(await within(block).findByText("Resposta registrada: Stone")).toBeInTheDocument();
    expect(within(block).getByText(/o agente vê ao retomar/)).toBeInTheDocument();
    expect(within(block).getByRole("button", { name: "Copiar pedido de retomada" })).toBeInTheDocument();
  });

  it("a linha respondida continua na tela mesmo depois que o servidor a tira da lista", async () => {
    mock.actions = actions([decide]);
    mock.mutateAsync.mockImplementation(async () => { mock.actions = actions([]); });
    const user = userEvent.setup();
    const { rerender } = render(<AgoraPage />);
    await user.click(screen.getByRole("button", { name: "Cielo" }));
    rerender(<AgoraPage />);
    expect(await screen.findByText("Resposta registrada: Cielo")).toBeInTheDocument();
  });

  it("duplo clique envia uma vez", async () => {
    mock.actions = actions([decide]);
    mock.mutateAsync.mockReturnValue(new Promise(() => {}));
    render(<AgoraPage />);
    await userEvent.setup().dblClick(screen.getByRole("button", { name: "Stone" }));
    expect(mock.mutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cielo" })).toBeDisabled();
  });

  it("409 avisa que a tarefa mudou e não reenvia sozinho", async () => {
    mock.actions = actions([decide]);
    mock.mutateAsync.mockRejectedValue({ response: { status: 409 } });
    mock.api.get.mockResolvedValue({ data: { state: null, events: [], actions: [{ ...decide, version: 4 }], capabilities } });
    render(<AgoraPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Stone" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("A tarefa mudou. Confira antes de responder.");
    expect(mock.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("resposta demorada (> 1,5 s) com o pedido já fora da lista mantém a linha, ocupada, e confirma ao fim", async () => {
    mock.actions = actions([decide]);
    let finish!: () => void;
    mock.mutateAsync.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const { rerender } = render(<AgoraPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Stone" }));
    mock.actions = actions([]); // a invalidação do hook já tirou o pedido da lista
    rerender(<AgoraPage />);
    await new Promise(resolve => setTimeout(resolve, 1800));
    expect(screen.queryByText("Já respondido")).toBeNull();
    expect(screen.getByRole("button", { name: "Cielo" })).toBeDisabled();
    finish();
    expect(await screen.findByText("Resposta registrada: Stone")).toBeInTheDocument();
    expect(screen.queryByText("Já respondido")).toBeNull();
  });

  it("falha depois de o pedido sair da lista: terminado o envio, vira Já respondido", async () => {
    mock.actions = actions([decide]);
    let fail!: (error: unknown) => void;
    mock.mutateAsync.mockReturnValue(new Promise<void>((_, reject) => { fail = reject; }));
    mock.api.get.mockResolvedValue({ data: { state: null, events: [], actions: [], capabilities } });
    const { rerender } = render(<AgoraPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Stone" }));
    mock.actions = actions([]);
    rerender(<AgoraPage />);
    fail({ response: { status: 409 } });
    await waitFor(() => expect(screen.getByText("Já respondido")).toBeInTheDocument(), { timeout: 4000 });
  });

  it("pedido que some da lista sem resposta nossa vira o aviso Já respondido", async () => {
    mock.actions = actions([decide]);
    const { rerender } = render(<AgoraPage />);
    expect(screen.getByRole("button", { name: "Stone" })).toBeInTheDocument();
    mock.actions = actions([]);
    rerender(<AgoraPage />);
    await waitFor(() => expect(screen.getByText("Já respondido")).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.queryByRole("button", { name: "Stone" })).toBeNull();
  });

  describe("revisão humana", () => {
    function setup(checks: Array<[string, "passed" | "failed"]>, caps = capabilities, findings: unknown[] = []) {
      const st = reviewState(checks, findings);
      mock.actions = actions([reviewAction]);
      mock.workflow = query({ state: st, events: [], actions: [], capabilities: caps });
      mock.team = team([...FEED, feedItem("t-rev", "E-mail de boas-vindas", "Corex", st)]);
      return render(<AgoraPage />);
    }
    const block = () => screen.getByRole("heading", { name: "Esperando você" }).closest("section")!;

    it("mostra os 4 checks, os achados abertos e habilita Aprovar quando tudo passou", async () => {
      setup(allPassed);
      expect(within(block()).getByRole("list", { name: "Checks da revisão" })).toBeInTheDocument();
      for (const name of REQUIRED) expect(within(block()).getByText(name, { exact: false })).toBeInTheDocument();
      expect(block()).toHaveTextContent("nenhum achado aberto");
      expect(within(block()).getByRole("button", { name: "Aprovar" })).toBeEnabled();
      expect(within(block()).getByRole("button", { name: "Pedir ajuste" })).toBeEnabled();
      expect(within(block()).getByRole("button", { name: "Abrir folha" })).toBeEnabled();
      mock.mutateAsync.mockResolvedValue({});
      await userEvent.setup().click(within(block()).getByRole("button", { name: "Aprovar" }));
      expect(mock.mutateAsync).toHaveBeenCalledWith({ kind: "commands", command: { type: "approve_review", cycle: 1 }, expectedVersion: 9 });
      expect(await within(block()).findByText("Aprovada")).toBeInTheDocument();
      await waitFor(() => expect(within(block()).getByRole("status")).toHaveFocus());
    });

    it("Aprovar fica desabilitado com check falho", () => {
      setup([["typecheck", "passed"], ["lint", "failed"], ["test", "passed"], ["build", "passed"]]);
      expect(within(block()).getByRole("button", { name: "Aprovar" })).toBeDisabled();
      expect(within(block()).getByText(/Aprovar fica indisponível/)).toBeInTheDocument();
    });

    it("Aprovar fica desabilitado com achado bloqueante aberto e o achado aparece", () => {
      setup(allPassed, capabilities, [{ id: "f1", description: "Valor negativo na recarga", severity: "high", criterion: "c", responsibleId: "u", blocking: true, state: "open", openedInCycle: 1, fixEvidence: [] }]);
      expect(within(block()).getByRole("button", { name: "Aprovar" })).toBeDisabled();
      expect(block()).toHaveTextContent("1 achado aberto");
      expect(block()).toHaveTextContent("Valor negativo na recarga");
    });

    it("sem permissão de aprovar, Aprovar nem aparece", () => {
      setup(allPassed, { ...capabilities, canApprove: false });
      expect(within(block()).queryByRole("button", { name: "Aprovar" })).toBeNull();
      expect(within(block()).getByRole("button", { name: "Pedir ajuste" })).toBeInTheDocument();
    });

    it("quem executou a entrega não aprova nem pede ajuste pela Agora", () => {
      const st = reviewState(allPassed);
      st.executorIds = ["me"];
      mock.actions = actions([reviewAction]);
      mock.workflow = query({ state: st, events: [], actions: [], capabilities });
      render(<AgoraPage />);
      expect(within(block()).queryByRole("button", { name: "Aprovar" })).toBeNull();
      expect(within(block()).queryByRole("button", { name: "Pedir ajuste" })).toBeNull();
      expect(within(block()).getByRole("button", { name: "Abrir folha" })).toBeInTheDocument();
    });

    it("Pedir ajuste exige motivo e envia request_changes com ciclo e versão", async () => {
      setup(allPassed);
      mock.mutateAsync.mockResolvedValue({});
      const user = userEvent.setup();
      await user.click(within(block()).getByRole("button", { name: "Pedir ajuste" }));
      const submit = within(block()).getByRole("button", { name: "Pedir ajuste" });
      expect(submit).toBeDisabled();
      await user.type(within(block()).getByRole("textbox", { name: "Motivo do ajuste" }), "Texto do cabeçalho errado");
      await user.click(submit);
      expect(mock.mutateAsync).toHaveBeenCalledWith({ kind: "commands", command: { type: "request_changes", cycle: 1, reason: "Texto do cabeçalho errado" }, expectedVersion: 9 });
      expect(await within(block()).findByText("Ajustes pedidos")).toBeInTheDocument();
    });

    it("duplo clique em Aprovar envia uma vez", async () => {
      setup(allPassed);
      mock.mutateAsync.mockReturnValue(new Promise(() => {}));
      await userEvent.setup().dblClick(within(block()).getByRole("button", { name: "Aprovar" }));
      expect(mock.mutateAsync).toHaveBeenCalledTimes(1);
    });

    it("409 na decisão mostra o aviso do RF10 e não reenvia", async () => {
      setup(allPassed);
      mock.mutateAsync.mockRejectedValue({ response: { status: 409 } });
      await userEvent.setup().click(within(block()).getByRole("button", { name: "Aprovar" }));
      expect(await within(block()).findByRole("alert")).toHaveTextContent("A tarefa mudou. Confira antes de responder.");
      expect(mock.mutateAsync).toHaveBeenCalledTimes(1);
    });

    it("sem acesso ao fluxo (403) não usa estado nem capacidades em cache: sem Aprovar nem Pedir ajuste", () => {
      const st = reviewState(allPassed);
      mock.actions = actions([reviewAction]);
      mock.workflow = query({ state: st, events: [], actions: [], capabilities }, { isError: true, error: { response: { status: 403 } } });
      render(<AgoraPage />); // sem item no feed: só o snapshot em cache traria estado
      expect(within(block()).queryByRole("button", { name: "Aprovar" })).toBeNull();
      expect(within(block()).queryByRole("button", { name: "Pedir ajuste" })).toBeNull();
      expect(within(block()).queryByRole("list", { name: "Checks da revisão" })).toBeNull();
      expect(within(block()).getByRole("button", { name: "Abrir folha" })).toBeInTheDocument();
      expect(block()).toHaveTextContent("Não foi possível consultar o estado desta revisão");
    });

    it("decisão demorada (> 1,5 s) com o pedido já fora da lista mantém a linha e não vira Já respondido", async () => {
      const st = reviewState(allPassed);
      mock.actions = actions([reviewAction]);
      mock.workflow = query({ state: st, events: [], actions: [], capabilities });
      let finish!: () => void;
      mock.mutateAsync.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
      const { rerender } = render(<AgoraPage />);
      await userEvent.setup().click(within(block()).getByRole("button", { name: "Aprovar" }));
      mock.actions = actions([]); // a invalidação já tirou o pedido da lista
      rerender(<AgoraPage />);
      await new Promise(resolve => setTimeout(resolve, 1800));
      expect(screen.queryByText("Já respondido")).toBeNull();
      expect(within(block()).getByRole("button", { name: "Aprovar" })).toBeDisabled();
      finish();
      expect(await within(block()).findByText("Aprovada")).toBeInTheDocument();
    });

    it("Abrir folha navega para a rota da folha", async () => {
      setup(allPassed);
      await userEvent.setup().click(within(block()).getByRole("button", { name: "Abrir folha" }));
      expect(mock.push).toHaveBeenCalledWith(sheetHref("t-rev"), { scroll: false });
    });
  });
});

describe("Agora — erro de acesso x erro de rede", () => {
  const denied = (status: number) => ({ response: { status } });
  const secretAction = { ...decide, id: "a-secret", question: "Confidencial" };

  it.each([401, 403, 404])("%s nos pedidos: sem dado antigo (nem pergunta, nem 'nenhum pedido'), só o alerta do bloco", status => {
    mock.actions = actions([secretAction], { isError: true, error: denied(status) });
    render(<AgoraPage />);
    const block = screen.getByRole("heading", { name: "Esperando você" }).closest("section")!;
    expect(screen.queryByText("Confidencial")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stone" })).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma decisão pendente para você.")).not.toBeInTheDocument();
    expect(within(block).getByRole("alert")).toHaveTextContent("Não foi possível consultar os pedidos para você.");
    expect(screen.getByRole("button", { name: "1 sem sinal" })).toBeInTheDocument(); // o resto da tela segue
    expect(screen.queryByRole("button", { name: /esperando você/ })).toBeNull(); // contagem não vem do cache
    expect(screen.getByText("0 esperando você")).toBeInTheDocument();
  });

  it("erro de rede nos pedidos mantém o último estado e avisa", () => {
    mock.actions = actions([secretAction], { isError: true, error: new Error("rede") });
    render(<AgoraPage />);
    const block = screen.getByRole("heading", { name: "Esperando você" }).closest("section")!;
    expect(within(block).getByText("Confidencial")).toBeInTheDocument();
    expect(within(block).getByRole("alert")).toHaveTextContent("Mostrando o último estado carregado");
  });

  it("recuperar do 403 não transforma o que estava em cache em 'Já respondido'", async () => {
    mock.actions = actions([secretAction]);
    const { rerender } = render(<AgoraPage />);
    expect(screen.getAllByText("Confidencial").length).toBeGreaterThan(0);
    mock.actions = actions([secretAction], { isError: true, error: denied(403) });
    rerender(<AgoraPage />);
    expect(screen.queryByText("Confidencial")).not.toBeInTheDocument();
    mock.actions = actions([]);
    rerender(<AgoraPage />);
    await new Promise(resolve => setTimeout(resolve, 1800));
    expect(screen.queryByText("Já respondido")).toBeNull();
  });

  it.each([403, 404])("%s no feed: tarefas e concluídas em cache somem, só o alerta de Em andamento", status => {
    mock.team = team(FEED, { isError: true, error: denied(status) });
    render(<AgoraPage />);
    expect(rowsOf()).toHaveLength(0);
    expect(screen.queryByText("Tela de login")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Feito hoje" })).toBeNull();
    expect(screen.queryByText("1 sem sinal")).toBeNull();
    const block = screen.getByRole("heading", { name: "Em andamento" }).closest("section")!;
    expect(within(block).getByRole("alert")).toHaveTextContent("Não foi possível consultar as execuções em andamento.");
  });

  it("erro de rede no feed mantém as execuções com aviso e Tentar novamente", () => {
    mock.team = team(FEED, { isError: true, error: new Error("rede") });
    render(<AgoraPage />);
    expect(rowsOf()).toHaveLength(4);
    const block = screen.getByRole("heading", { name: "Em andamento" }).closest("section")!;
    expect(within(block).getByRole("alert")).toHaveTextContent("Mostrando o último estado carregado");
    expect(within(block).getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("403 em Prazos esconde o cache; erro de rede o mantém com aviso", () => {
    const cached = query({ tasks: [{ id: "k1", projectId: "c-ima", title: "Prazo confidencial", status: "TODO", dueDate: "2026-11-13T12:00:00.000Z" }], hasMore: false });
    mock.tasks = { ...cached, isError: true, error: denied(403) };
    const { unmount } = render(<AgoraPage />);
    expect(screen.queryByText("Prazo confidencial")).toBeNull();
    expect(within(screen.getByRole("heading", { name: "Prazos" }).closest("section")!).getByRole("alert")).toBeInTheDocument();
    unmount();
    mock.tasks = { ...cached, isError: true, error: new Error("rede") };
    render(<AgoraPage />);
    expect(screen.getByText("Prazo confidencial")).toBeInTheDocument();
    expect(within(screen.getByRole("heading", { name: "Prazos" }).closest("section")!).getByRole("alert")).toHaveTextContent("Mostrando o último estado carregado");
  });
});

describe("Agora — pedido longo com identidade da tarefa", () => {
  it("mostra título e cliente › projeto da tarefa e preserva a pergunta inteira, sem recorte", () => {
    const question = "Contexto longo ".repeat(500).trim();
    mock.actions = actions([{ ...decide, id: "a-long", taskId: "t-long", taskTitle: "Decidir escopo", clientName: "Cliente", projectName: "Projeto", question }]);
    render(<AgoraPage />);
    const block = screen.getByRole("heading", { name: "Esperando você" }).closest("section")!;
    expect(within(block).getByText("Decidir escopo")).toBeInTheDocument();
    expect(block).toHaveTextContent("Cliente › Projeto");
    const text = within(block).getByText(/Contexto longo/);
    expect(text).not.toHaveClass("line-clamp-2");
    expect(text.textContent).toBe(question);
  });
});

describe("Agora — permissões e celular", () => {
  it("sem tarefas.ver_globais usa /mine e esconde Por pessoa", () => {
    mock.permissions = [];
    mock.team = new Proxy({}, { get() { throw new Error("/team não pode ser a fonte sem tarefas.ver_globais"); } });
    render(<AgoraPage />);
    expect(rowsOf()).toHaveLength(1);
    expect(rowsOf()[0]).toHaveTextContent("Conciliação de recarga");
    expect(screen.queryByRole("radio", { name: "Por pessoa" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Por estado" })).toBeInTheDocument();
  });

  it("sem tarefas.ver_globais não chama /tasks e Prazos não aparece (decisão conservadora)", () => {
    mock.permissions = [];
    mock.tasks = query({ tasks: [{ id: "k1", projectId: "c-ima", title: "Prazo que não deve aparecer", status: "TODO", dueDate: "2026-11-13T12:00:00.000Z" }], hasMore: false });
    render(<AgoraPage />);
    expect(mock.allTasksCalls).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Prazos" })).toBeNull();
    expect(screen.queryByText("Prazo que não deve aparecer")).toBeNull();
  });

  it("com a permissão, Prazos consulta /tasks até o domingo da semana em BRT", () => {
    render(<AgoraPage />);
    expect(mock.allTasksCalls).toHaveBeenCalledWith({ dueTo: "2026-11-16T02:59:59.999Z", limit: "20" });
  });

  it("?agrupar=pessoa sem permissão cai em estado", () => {
    mock.permissions = [];
    mock.search = "agrupar=pessoa";
    render(<AgoraPage />);
    expect(screen.getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Rodando1"]);
  });

  it("abaixo de 768 px empilha 3 níveis por execução, sem tabela, e cada linha abre a folha", () => {
    setViewport(true);
    render(<AgoraPage />);
    expect(screen.queryByRole("table")).toBeNull();
    const items = document.querySelectorAll("li[data-row]");
    expect(items).toHaveLength(4);
    const first = items[0] as HTMLElement;
    const link = within(first).getByRole("link");
    expect(link).toHaveAttribute("href", sheetHref("t-silent"));
    expect(first).toHaveTextContent("Sem sinal");
    expect(first).toHaveTextContent("Codex");
    expect(first).toHaveTextContent("há 2 h");
    expect(first).toHaveTextContent("Tela de login");
    expect(first).toHaveTextContent("Parou em: Passo E");
    expect(first).toHaveTextContent("4 de 5");
  });

  it("no celular Esperando você mantém os botões de resposta", () => {
    setViewport(true);
    mock.actions = actions([decide]);
    render(<AgoraPage />);
    expect(screen.getByRole("button", { name: "Stone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Responder com texto" })).toBeInTheDocument();
  });
});
