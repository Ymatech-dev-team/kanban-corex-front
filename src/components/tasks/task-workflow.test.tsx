import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskWorkflow } from "./task-workflow";
import { PendingActions } from "./pending-actions";
import type { useWorkflow } from "@/lib/hooks/use-workflow";
const mock = vi.hoisted(() => ({ write: vi.fn(), user: "reviewer", actions: {} as Record<string, unknown> }));
vi.mock("@/components/tasks/workflow-history", () => ({ WorkflowHistory: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/hooks/use-me", () => ({ useMe: () => ({ data: { userId: mock.user } }) }));
vi.mock("@/lib/hooks/use-workflow", async (actual) => ({ ...await actual<typeof import("@/lib/hooks/use-workflow")>(), useWorkflowWrite: () => ({ mutateAsync: mock.write, isPending: false }), useMyWorkflowActions: () => mock.actions }));
const state = { taskId: "t1", orgId: "o1", version: 3, stage: "IN_REVIEW", deliveryRevision: 1, responsibleId: "executor", executorIds: ["executor"], context: "Contexto real", criteria: ["Critério real"], findings: [], reviews: [{ cycle: 1, deliveryRevision: 1, summary: "Entrega real", evidence: ["teste.log"], checks: [{ name: "test", required: true, status: "passed" }], decision: "pending" }] };
function query(patch = {}) { return { data: { state, actions: [], capabilities: { canWrite: true, canReview: true, canApprove: true } }, ...patch } as unknown as ReturnType<typeof useWorkflow>; }
const dirty = vi.fn();
function view(snapshot = query()) { return render(<TaskWorkflow taskId="t1" query={snapshot} members={{ executor: "Executor", reviewer: "Revisor" }} onDirtyChange={dirty} />); }
beforeEach(() => { mock.write.mockReset(); mock.user = "reviewer"; mock.actions = { data: { pages: [{ actions: [] }] } }; });
describe("workflow visible authorization and recovery", () => {
  it("hides protected snapshot on permission failure", () => { view(query({ isError: true, error: { response: { status: 403 } } })); expect(screen.queryByText("Contexto real")).not.toBeInTheDocument(); expect(screen.getByRole("alert")).toBeInTheDocument(); });
  it("blocks self review and approval", () => { mock.user = "executor"; view(); expect(screen.queryByRole("button", { name: "Aprovar entrega" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Registrar achado" })).not.toBeInTheDocument(); expect(screen.getByText(/Quem executou esta entrega/)).toBeInTheDocument(); });
  it("keeps approval disabled when mandatory checks are missing", () => {
    view();
    expect(screen.getByRole("button", { name: "Aprovar entrega" })).toBeDisabled();
    expect(screen.getByText(/A aprovação exige/)).toBeInTheDocument();
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
  it("does not invent execution summary when none was reported", () => { view(); expect(screen.getByText(/O resumo aparecerá/)).toBeInTheDocument(); expect(screen.queryByText("Resumo da execução")).not.toBeInTheDocument(); });
  it("does not display stale action questions or empty success on failed inbox fetch", () => { mock.actions = { isError: true, error: { response: { status: 403 } }, data: { pages: [{ actions: [{ id: "a1", question: "Confidencial" }] }] } }; render(<PendingActions />); expect(screen.queryByText("Confidencial")).not.toBeInTheDocument(); expect(screen.queryByText("Nenhuma decisão pendente para você.")).not.toBeInTheDocument(); expect(screen.getByRole("alert")).toBeInTheDocument(); });
});

it("freezes draft version and review cycle through polling and conflict", async () => {
  mock.write.mockRejectedValue({ response: { status: 409 } });
  const { rerender } = view();
  fireEvent.click(screen.getByRole("button", { name: "Solicitar ajustes" }));
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Corrigir entrega revisada" } });
  const newer = query({ data: { ...query().data, state: { ...state, version: 9, reviews: [{ ...state.reviews[0], cycle: 2 }] } } });
  rerender(<TaskWorkflow taskId="t1" query={newer} members={{ executor: "Executor", reviewer: "Revisor" }} onDirtyChange={dirty} />);
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
  fireEvent.change(screen.getByLabelText("Destinatário"), { target: { value: "reviewer" } });
  fireEvent.change(screen.getByLabelText("Pergunta e contexto"), { target: { value: "Qual direção?" } });
  rerender(<TaskWorkflow taskId="t1" query={query({ data: { ...query().data, state: { ...state, version: 9 } } })} members={{ executor: "Executor", reviewer: "Revisor" }} onDirtyChange={dirty} />);
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

it("separates summary from review while retaining the review draft across views", () => {
  const props = { taskId: "t1", query: query(), members: { executor: "Executor", reviewer: "Revisor" }, onDirtyChange: dirty };
  const { rerender } = render(<TaskWorkflow {...props} view="review" />);
  expect(screen.getByText("Contexto real")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Solicitar ajustes" }));
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Rascunho de revisão" } });
  rerender(<TaskWorkflow {...props} view="summary" />);
  expect(screen.getByText("Contexto real")).toBeVisible();
  expect(screen.getByLabelText("Justificativa")).not.toBeVisible();
  expect(dirty).toHaveBeenLastCalledWith(true);
  rerender(<TaskWorkflow {...props} view="review" />);
  expect(screen.getByLabelText("Justificativa")).toHaveValue("Rascunho de revisão");
  expect(screen.getByLabelText("Justificativa")).toBeVisible();
});

it("marks only unresolved blocking findings and hides new action on completed task", () => {
  const findings = ["open", "fix_reported", "validated", "waived"].map((status) => ({ id: status, description: status, criterion: "Critério", responsibleId: "executor", blocking: true, state: status, fixEvidence: [] }));
  view(query({ data: { ...query().data, state: { ...state, stage: "DONE", findings }, actions: [{ id: "review", question: "Revisar entrega", kind: "REVIEW", recipientId: "reviewer" }] } }));
  expect(screen.getAllByText(/bloqueia aprovação/)).toHaveLength(2);
  expect(screen.getByText("Validado")).toBeInTheDocument();
  expect(screen.getByText("Dispensado com justificativa")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Solicitar ação" })).not.toBeInTheDocument();
  expect(screen.getByText("Abra a aba Revisão para concluir esta solicitação.")).toBeInTheDocument();
});
