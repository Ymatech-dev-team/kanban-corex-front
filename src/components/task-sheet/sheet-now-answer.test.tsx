import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SheetNow } from "./sheet-now";
import { WorkflowProvider } from "@/components/tasks/task-workflow";
import { deriveLiveStatus } from "@/lib/live-status";
import { useWorkflow } from "@/lib/hooks/use-workflow";

// Sem mock do ActionResponse nem de useWorkflowWrite: a mutação real refaz o snapshot (onSettled) ANTES de resolver,
// e o servidor já não devolve o pedido. O recibo precisa sobreviver a isso. [B2, RF8, RF30]
const server = vi.hoisted(() => ({ actions: [] as unknown[], post: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/hooks/use-me", () => ({ useMe: () => ({ data: { userId: "me" } }) }));
vi.mock("@/components/ui/toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(async () => ({ data: { state: baseState, events: [], capabilities: { canWrite: true, canReview: true, canApprove: true, canReopen: false }, actions: server.actions } })),
    post: (...args: unknown[]) => server.post(...args),
  },
}));

const baseState = { taskId: "t1", orgId: "o1", version: 3, stage: "DOING", deliveryRevision: 1, responsibleId: "exec", executorIds: ["exec"], context: "c", criteria: [], findings: [], reviews: [], execution: { id: "e1", agent: "Claude", ownerId: "exec", channel: "MCP", status: "WAITING", lastUpdatedAt: "2026-11-12T14:58:00Z" } };
const decide = { id: "a1", taskId: "t1", orgId: "o1", recipientId: "me", kind: "DECIDE", state: "OPEN", question: "Stone ou Cielo?", version: 4, options: ["Stone", "Cielo"] };

function Page() {
  const query = useWorkflow("t1");
  const data = query.data;
  const live = data?.state ? deriveLiveStatus({ state: data.state, updatedAt: "2026-11-12T14:58:00Z" }, new Date("2026-11-12T15:00:00Z")) : null;
  return <WorkflowProvider taskId="t1" query={query} members={{ exec: "Executor", me: "Eu" }} onDirtyChange={() => undefined}>{live && <SheetNow taskTitle="Integração POS" live={live} />}</WorkflowProvider>;
}
let client: QueryClient;
function renderPage() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
}

beforeEach(() => {
  server.actions = [decide];
  server.post.mockReset();
  server.post.mockImplementation(async () => { server.actions = []; return { data: { state: baseState } }; }); // o servidor resolve e o pedido deixa de estar aberto
  vi.stubGlobal("crypto", { randomUUID: () => "op-1" });
});

describe("caixa de decisão na folha sobrevive ao refetch da mutação", () => {
  it("mostra 'Resposta registrada' e 'Copiar pedido de retomada' mesmo com o pedido já fora do snapshot", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Stone" }));
    expect(await screen.findByText(/Resposta registrada: Stone/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar pedido de retomada" })).toBeInTheDocument();
    expect(server.post).toHaveBeenCalledTimes(1);
    expect(server.post.mock.calls[0][0]).toBe("/tasks/t1/workflow/actions/a1/resolve");
    expect(server.post.mock.calls[0][1]).toMatchObject({ response: "Stone", resolution: "RESOLVED", expectedVersion: 4 });
    // o snapshot realmente já não tem o pedido: o recibo vem do estado local, não de a ação continuar aberta
    await waitFor(() => expect(server.actions).toEqual([]));
    expect(screen.getByText(/Resposta registrada: Stone/)).toBeInTheDocument();
  });

  it("vale também para resposta em texto", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Responder com texto" }));
    fireEvent.change(screen.getByLabelText("Sua resposta"), { target: { value: "Usar Stone" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    expect(await screen.findByText(/Resposta registrada: Usar Stone/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar pedido de retomada" })).toBeInTheDocument();
  });

  it("sem interação do usuário, pedido resolvido por outra pessoa simplesmente some", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Stone" });
    server.actions = [];
    await client.invalidateQueries({ queryKey: ["workflow", "t1"] });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stone" })).not.toBeInTheDocument());
  });
});
