import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowProvider } from "./task-workflow";
import { SheetNow } from "@/components/task-sheet/sheet-now";
import { SheetSteps } from "@/components/task-sheet/sheet-steps";
import { SheetReview } from "@/components/task-sheet/sheet-review";
import { deriveLiveStatus } from "@/lib/live-status";
import type { useWorkflow } from "@/lib/hooks/use-workflow";

// As regras de aprovação, as mutações e o formulário vivem no WorkflowProvider; a folha os apresenta em Agora, Passos e Revisão.
// Estes testes seguem provando as mesmas regras de antes (permissão, versão congelada, aprovar mesmo assim, atribuição do agente).
const mock = vi.hoisted(() => ({ write: vi.fn(), user: "reviewer" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/hooks/use-me", () => ({ useMe: () => ({ data: { userId: mock.user } }) }));
vi.mock("@/lib/hooks/use-workflow", async (actual) => ({ ...await actual<typeof import("@/lib/hooks/use-workflow")>(), useWorkflowWrite: () => ({ mutateAsync: mock.write, isPending: false }) }));
vi.mock("@/components/agora/action-response", () => ({ ActionResponse: ({ action }: { action: { id: string } }) => <div data-testid="action-response">{action.id}</div> }));
const state = { taskId: "t1", orgId: "o1", version: 3, stage: "IN_REVIEW", deliveryRevision: 1, responsibleId: "executor", executorIds: ["executor"], context: "Contexto real", criteria: ["Critério real"], findings: [], reviews: [{ cycle: 1, deliveryRevision: 1, summary: "Entrega real", evidence: ["teste.log"], checks: [{ name: "test", required: true, status: "passed" }], decision: "pending" }] };
function query(patch = {}) { return { data: { state, actions: [], capabilities: { canWrite: true, canReview: true, canApprove: true } }, ...patch } as unknown as ReturnType<typeof useWorkflow>; }
const dirty = vi.fn();
const members = { executor: "Executor", reviewer: "Revisor" };
function Harness({ snapshot }: { snapshot: ReturnType<typeof useWorkflow> }) {
  const data = snapshot.data;
  const live = data?.state ? deriveLiveStatus({ state: data.state, updatedAt: "2026-11-12T12:00:00Z", responsibleName: "Executor" }, new Date("2026-11-12T12:05:00Z")) : null;
  return <WorkflowProvider taskId="t1" query={snapshot} members={members} onDirtyChange={dirty}>
    {live && <><SheetNow taskTitle="Tarefa" live={live} /><SheetSteps live={live} /><SheetReview /></>}
  </WorkflowProvider>;
}
function view(snapshot = query()) { return render(<Harness snapshot={snapshot} />); }
beforeEach(() => { mock.write.mockReset(); mock.user = "reviewer"; });
describe("workflow visible authorization and recovery", () => {
  it("blocks self review and approval", () => { mock.user = "executor"; view(); expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Registrar achado" })).not.toBeInTheDocument(); expect(screen.getByText(/Quem executou esta entrega/)).toBeInTheDocument(); });
  it("keeps approval disabled when mandatory checks are missing", () => {
    view();
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeDisabled();
    expect(screen.getByText(/Aprovar mesmo assim conclui/)).toBeInTheDocument();
  });
  it("preserves finding contents and identity after failed save", async () => {
    mock.write.mockRejectedValueOnce(new Error("network")).mockResolvedValue({}); view();
    fireEvent.click(screen.getByRole("button", { name: "Registrar achado" }));
    fireEvent.change(screen.getByLabelText("O que precisa ser corrigido"), { target: { value: "Erro observado" } });
    fireEvent.change(screen.getByLabelText("Critério afetado"), { target: { value: "Critério real" } });
    fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("O que precisa ser corrigido")).toHaveValue("Erro observado");
    fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));
    await waitFor(() => expect(mock.write).toHaveBeenCalledTimes(2));
    expect(mock.write.mock.calls[0][0]).toEqual(mock.write.mock.calls[1][0]);
  });
  it("does not invent execution steps when none was reported, and shows the acceptance criteria", () => {
    view();
    expect(screen.getByText("O agente ainda não relatou passos.")).toBeInTheDocument();
    expect(screen.getByText("Critério real")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Relatório completo da execução" })).not.toBeInTheDocument();
  });
});

it("freezes draft version and review cycle through polling and conflict", async () => {
  mock.write.mockRejectedValue({ response: { status: 409 } });
  const { rerender } = view();
  fireEvent.click(screen.getByRole("button", { name: "Pedir ajuste" }));
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Corrigir entrega revisada" } });
  const newer = query({ data: { ...query().data, state: { ...state, version: 9, reviews: [{ ...state.reviews[0], cycle: 2 }] } } });
  rerender(<Harness snapshot={newer} />);
  fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));
  await screen.findByRole("alert");
  expect(mock.write.mock.calls[0][0]).toMatchObject({ expectedVersion: 3, command: { cycle: 1 } });
  expect(screen.getByLabelText("Justificativa")).toHaveValue("Corrigir entrega revisada");
  fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));
  await waitFor(() => expect(mock.write).toHaveBeenCalledTimes(2));
  expect(mock.write.mock.calls[1][0]).toMatchObject({ expectedVersion: 3, command: { cycle: 1 } });
});
it("freezes request action version while user composes a question", async () => {
  mock.write.mockResolvedValue({});
  const { rerender } = view();
  fireEvent.click(screen.getByRole("button", { name: "Solicitar ação" }));
  await userEvent.click(screen.getByRole("button", { name: /Destinatário/ }));
  await userEvent.click(await screen.findByRole("option", { name: "Revisor" }));
  fireEvent.change(screen.getByLabelText("Pergunta e contexto"), { target: { value: "Qual direção?" } });
  rerender(<Harness snapshot={query({ data: { ...query().data, state: { ...state, version: 9 } } })} />);
  fireEvent.click(screen.getByRole("button", { name: /^Registrar$/ }));
  await waitFor(() => expect(mock.write).toHaveBeenCalled());
  expect(mock.write.mock.calls[0][0].values.expectedVersion).toBe(3);
});

it("prevents switching findings while correction evidence is being drafted", () => {
  const findings = ["a", "b"].map((id) => ({ id, description: id, criterion: "Critério", responsibleId: "executor", blocking: true, state: "open", fixEvidence: [] }));
  view(query({ data: { ...query().data, state: { ...state, stage: "DOING", findings } } }));
  fireEvent.click(screen.getAllByRole("button", { name: "Informar correção" })[0]);
  fireEvent.change(screen.getByLabelText("Evidências — uma por linha"), { target: { value: "Evidência em elaboração" } });
  const other = screen.getAllByRole("button", { name: "Informar correção" })[1];
  expect(other).toBeDisabled();
  fireEvent.click(other);
  expect(screen.getByLabelText("Evidências — uma por linha")).toHaveValue("Evidência em elaboração");
});

it("reports the workflow as dirty while a form is open and keeps the draft through polling (single scroll has no tabs to hide it)", () => {
  const { rerender } = view();
  fireEvent.click(screen.getByRole("button", { name: "Pedir ajuste" }));
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Rascunho de revisão" } });
  expect(dirty).toHaveBeenLastCalledWith(true);
  rerender(<Harness snapshot={query({ data: { ...query().data, state: { ...state, version: 4 } } })} />);
  expect(screen.getByLabelText("Justificativa")).toHaveValue("Rascunho de revisão");
  expect(screen.getByLabelText("Justificativa")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(dirty).toHaveBeenLastCalledWith(false);
});

it("marks only unresolved blocking findings and hides new action on completed task", () => {
  const findings = ["open", "fix_reported", "validated", "waived"].map((status) => ({ id: status, description: status, criterion: "Critério", responsibleId: "executor", blocking: true, state: status, fixEvidence: [] }));
  view(query({ data: { ...query().data, state: { ...state, stage: "DONE", findings }, actions: [{ id: "review", question: "Revisar entrega", kind: "REVIEW", recipientId: "reviewer" }] } }));
  expect(screen.getAllByText(/bloqueante preservado/)).toHaveLength(2);
  expect(screen.getByText("Validado")).toBeInTheDocument();
  expect(screen.getByText("Dispensado com justificativa")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Solicitar ação" })).not.toBeInTheDocument();
  expect(screen.getByText("Veja a seção Revisão para consultar o modo de revisão e o próximo passo.")).toBeInTheDocument();
});


it.each(["Claude", "Codex", "<script>alert(1)</script>"])("attributes MCP completion to the recorded agent %s, not the latest execution", (agent) => {
  const approved = { ...state.reviews[0], decision: "approved", decidedChannel: "MCP", decidedAgent: agent };
  const { container } = view(query({ data: { ...query().data, state: { ...state, stage: "DONE", reviews: [approved], execution: { agent: "Agente posterior", status: "RUNNING", lastUpdatedAt: "2026-11-08T12:00:00Z" } } } }));
  expect(screen.getByText(`Concluído por ${agent} via MCP`)).toBeInTheDocument();
  expect(screen.queryByText("Concluído por Agente posterior via MCP")).not.toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
  expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
});
it("uses a neutral assistant label when persisted MCP completion lacks agent name", () => {
  view(query({ data: { ...query().data, state: { ...state, stage: "DONE", reviews: [{ ...state.reviews[0], decision: "approved", decidedChannel: "MCP" }] } } }));
  expect(screen.getByText("Concluído por Assistente conectado via MCP")).toBeInTheDocument();
});
it.each([undefined, "WEB"])("does not invent assistant attribution for human or legacy approvals (%s)", (decidedChannel) => {
  view(query({ data: { ...query().data, state: { ...state, stage: "DONE", reviews: [{ ...state.reviews[0], decision: "approved", decidedChannel, decidedAgent: "Claude" }] } } }));
  expect(screen.queryByText(/Concluído por .* via MCP/)).not.toBeInTheDocument();
});

it("shows the human decision as a stamp with name, time and channel", () => {
  view(query({ data: { ...query().data, state: { ...state, stage: "DONE", reviews: [{ ...state.reviews[0], decision: "approved", decidedBy: "reviewer", decidedAt: "2026-11-12T15:40:00Z", decidedChannel: "WEB" }] } } }));
  expect(screen.getByText("Aprovada")).toBeInTheDocument();
  expect(screen.getByText("Revisor · 12/11 12:40 · Painel")).toBeInTheDocument();
});

it("keeps autonomous review with the agent without a final acceptance button", () => {
  view(query({ data: { ...query().data, state: { ...state, reviews: [{ ...state.reviews[0], reviewMode: "AGENT" }] } } }));
  expect(screen.getByText(/Nenhum aceite final seu é necessário/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
  expect(screen.getByText(/Aprovar mesmo assim conclui/)).toBeInTheDocument();
});
it("keeps the full technical report behind a disclosure", () => {
  view(query({ data: { ...query().data, state: { ...state, reviews: [{ ...state.reviews[0], summary: "Relatório técnico extenso" }] } } }));
  const report = screen.getByText("Relatório técnico extenso");
  expect(screen.getByRole("button", { name: "Relatório da revisão e evidências" })).toHaveAttribute("aria-expanded", "false");
  expect(report).not.toBeVisible();
  fireEvent.click(screen.getByText("Relatório da revisão e evidências"));
  expect(screen.getByRole("button", { name: "Relatório da revisão e evidências" })).toHaveAttribute("aria-expanded", "true");
  expect(report).toBeInTheDocument();
});
it("keeps short human questions fully readable in the decision box and hands them to the shared response component", () => {
  const question = "Confirmar a regra de arredondamento e as unidades afetadas antes de continuar com a mudança aprovada no plano.";
  view(query({ data: { ...query().data, actions: [{ id: "a", taskId: "t1", question, kind: "DECIDE", recipientId: "reviewer", state: "OPEN" }] } }));
  expect(screen.getByText(question)).not.toHaveClass("line-clamp-2");
  expect(screen.getByTestId("action-response")).toHaveTextContent("a");
  expect(screen.getByText("Espera você")).toBeInTheDocument();
});
it("lists requests addressed to someone else in Decisões e bloqueios, not in the decision box", () => {
  const question = "Qual adquirente usar?";
  view(query({ data: { ...query().data, actions: [{ id: "a", taskId: "t1", question, kind: "DECIDE", recipientId: "executor", state: "OPEN" }] } }));
  expect(screen.getByText(question)).toBeInTheDocument();
  expect(screen.getByText("Para Executor")).toBeInTheDocument();
  expect(screen.queryByTestId("action-response")).not.toBeInTheDocument();
});

describe("approve anyway", () => {
  const failedReview = { ...state.reviews[0], reviewMode: "HUMAN", checks: ["typecheck", "lint", "test", "build"].map(name => ({ name, required: true, status: ["lint", "test"].includes(name) ? "failed" : "pending" })) };
  const finding = { id: "f1", description: "Falha bloqueante original", criterion: "C", responsibleId: "executor", blocking: true, state: "open", fixEvidence: [] };
  function failedView(patch = {}) { return view(query({ data: { ...query().data, state: { ...state, reviews: [failedReview], findings: [finding], ...patch } } })); }
  it.each(["HUMAN", "AGENT", undefined])("completes in one click without input despite failed and pending checks and blockers (%s)", async reviewMode => {
    mock.user = "executor"; mock.write.mockResolvedValue({});
    failedView({ reviews: [{ ...failedReview, reviewMode }] });
    fireEvent.click(screen.getByRole("button", { name: "Aprovar mesmo assim" }));
    await waitFor(() => expect(mock.write).toHaveBeenCalledWith({ kind: "commands", expectedVersion: 3, command: { type: "approve_anyway", cycle: 1 } }));
    expect(screen.queryByLabelText("Justificativa")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByText("falhou")).toHaveLength(2);
    expect(screen.getByText("Falha bloqueante original")).toBeInTheDocument();
  });
  it("allows missing mandatory checks but never without approval permission", () => {
    const { unmount } = failedView({ reviews: [{ ...failedReview, checks: [] }] });
    expect(screen.getByRole("button", { name: "Aprovar mesmo assim" })).toBeEnabled();
    unmount(); view(query({ data: { ...query().data, capabilities: { canWrite: true, canReview: true, canApprove: false } } }));
    expect(screen.queryByRole("button", { name: "Aprovar mesmo assim" })).not.toBeInTheDocument();
  });
  it("prevents duplicate submission while a request is unresolved and shows failure", async () => {
    let reject!: (cause: unknown) => void;
    mock.write.mockReturnValue(new Promise((_, fail) => { reject = fail; })); failedView();
    const button = screen.getByRole("button", { name: "Aprovar mesmo assim" });
    fireEvent.click(button); fireEvent.click(button);
    expect(mock.write).toHaveBeenCalledTimes(1);
    reject({ response: { status: 409 } });
    await screen.findByRole("alert");
    expect(screen.queryByText("Alteração registrada nesta tarefa.")).not.toBeInTheDocument();
  });
  it("shows original failures and blockers alongside explicit completion audit", () => {
    failedView({ stage: "DONE", reviews: [{ ...failedReview, decision: "approved", approvalOverride: { approvedBy: "reviewer", approvedAt: "2026-11-12T12:00:00Z", cycle: 1, deliveryRevision: 1, channel: "MCP" } }] });
    expect(screen.getByText("Concluída com exceção")).toBeInTheDocument();
    expect(screen.getByText("Aprovada mesmo assim")).toBeInTheDocument();
    expect(screen.getByText(/Checks e achados foram preservados/)).toBeInTheDocument();
    expect(screen.getAllByText("falhou")).toHaveLength(2);
    expect(screen.getByText(/bloqueante preservado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar mesmo assim" })).not.toBeInTheDocument();
  });
  it("still renders old reservation audit", () => {
    failedView({ stage: "DONE", reviews: [{ ...failedReview, decision: "approved", reservation: { checkNames: ["lint"], reason: "Problemas anteriores documentados", approvedBy: "reviewer", approvedAt: "2026-11-12T12:00:00Z", cycle: 1, deliveryRevision: 1 } }] });
    expect(screen.getByText("Concluída com ressalvas")).toBeInTheDocument();
    expect(screen.getByText("Problemas anteriores documentados")).toBeInTheDocument();
  });
});

it("hands agent execution back to autonomous review without selecting a human reviewer",async()=>{
  mock.write.mockResolvedValue({});
  view(query({data:{...query().data,state:{...state,stage:"DOING",execution:{channel:"MCP",agent:"Claude",status:"FINISHED"}}}}));
  fireEvent.click(screen.getByRole("button",{name:"Enviar para revisão"}));
  expect(screen.queryByLabelText("Revisor responsável")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Resumo do que foi entregue"),{target:{value:"Implementado e testado"}});
  fireEvent.change(screen.getByLabelText(/Evidências/),{target:{value:"teste.log"}});
  fireEvent.click(screen.getByRole("button",{name:/^Registrar$/}));
  await waitFor(()=>expect(mock.write).toHaveBeenCalled());
  const command=mock.write.mock.calls[0][0].command;
  expect(command.reviewMode).toBe("AGENT"); expect(command).not.toHaveProperty("reviewerId");
});

it("labels the blocking finding checkbox and preserves the selected boolean in the command", async () => {
  mock.write.mockResolvedValue({}); view();
  await userEvent.click(screen.getByRole("button", {name: "Registrar achado"}));
  const checkbox = screen.getByRole("checkbox", {name: "Bloqueia aprovação"});
  expect(checkbox).toBeChecked();
  await userEvent.click(screen.getByText("Bloqueia aprovação"));
  expect(checkbox).not.toBeChecked();
  fireEvent.change(screen.getByLabelText("O que precisa ser corrigido"), {target: {value: "Ajuste visual"}});
  fireEvent.change(screen.getByLabelText("Critério afetado"), {target: {value: "Interface legível"}});
  await userEvent.click(screen.getByRole("button", {name: /^Registrar$/}));
  await waitFor(() => expect(mock.write).toHaveBeenCalledWith(expect.objectContaining({command: expect.objectContaining({type: "record_finding", blocking: false})})));
});
