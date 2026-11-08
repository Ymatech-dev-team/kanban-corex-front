import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowHistory } from "./workflow-history";
const fixture = vi.hoisted(() => ({ payload: {} as Record<string, unknown>, channel: "WEB", type: "request_changes" }));
vi.mock("@/lib/hooks/use-workflow", () => ({ useWorkflowHistory: () => ({ data: { pages: [{ events: [{ id: "ev", actorId: "u", channel: fixture.channel, type: fixture.type, deliveryRevision: 1, createdAt: "2026-11-06T00:00:00Z", payload: fixture.payload }] }] } }) }));
describe("workflow persisted history shapes", () => {
  it.each([
    [{ command: { reason: "Ajuste solicitado", description: "Achado descrito", summary: "Entrega anterior", evidence: ["teste-anterior.log"] } }, ["Ajuste solicitado", "Achado descrito", "Entrega anterior", "teste-anterior.log"]],
    [{ action: { question: "Pergunta anterior" }, response: "Decisão registrada" }, ["Pergunta anterior", "Decisão registrada"]],
    [{ command: { summary: { objective: "Objetivo anterior", completed: ["Implementado"], remaining: ["Falta revisar"], blockers: ["Depende de decisão"], nextStep: "Retomar revisão", references: ["commit anterior"] } } }, ["Objetivo anterior", "Implementado", "Falta revisar", "Depende de decisão", "Retomar revisão", "commit anterior"]],
  ])("renders persisted user content without dumping raw JSON", async (payload, expected) => {
    fixture.payload = payload as Record<string, unknown>;
    const { container } = render(<WorkflowHistory taskId="t" members={{ u: "Revisor" }} />);
    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    for (const text of expected as string[]) expect(await screen.findByText(text, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/\{"command"/)).not.toBeInTheDocument();
  });
});

it.each([["WEB", "Painel"], ["MCP", "Assistente conectado"], ["LOCAL_SYNC", "Sincronização local"]])("labels persisted channel %s", (channel, label) => {
  fixture.channel = channel;
  fixture.payload = {};
  render(<WorkflowHistory taskId="t" members={{ u: "Revisor" }} expanded />);
  expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
});


it("identifies autonomous completion by the persisted event channel", () => {
  fixture.channel = "MCP"; fixture.type = "approve_review"; fixture.payload = {};
  render(<WorkflowHistory taskId="t" members={{ u: "João" }} expanded />);
  expect(screen.getByText("Concluído pelo assistente")).toBeInTheDocument();
  expect(screen.getByText(/João.*Assistente conectado/)).toBeInTheDocument();
});
it("keeps human approval label for WEB events", () => {
  fixture.channel = "WEB"; fixture.type = "approve_review"; fixture.payload = {};
  render(<WorkflowHistory taskId="t" members={{ u: "João" }} expanded />);
  expect(screen.getByText("Entrega aprovada")).toBeInTheDocument();
  expect(screen.queryByText("Concluído pelo assistente")).not.toBeInTheDocument();
});
it("renders appended delivery evidence as text in the same history", () => {
  fixture.channel = "MCP"; fixture.type = "record_evidence";
  fixture.payload = { command: { summary: "Deploy e merge concluídos", evidence: ["<img src=x onerror=alert(1)>", "commit abc123"] } };
  const { container } = render(<WorkflowHistory taskId="t" members={{ u: "João" }} expanded />);
  expect(screen.getByText("Evidências da entrega registradas")).toBeInTheDocument();
  expect(screen.getByText("Deploy e merge concluídos")).toBeInTheDocument();
  expect(screen.getByText("Evidência: <img src=x onerror=alert(1)>")).toBeInTheDocument();
  expect(container.querySelector("img")).toBeNull();
});
