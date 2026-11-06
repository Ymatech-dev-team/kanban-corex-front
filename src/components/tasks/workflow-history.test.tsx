import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowHistory } from "./workflow-history";
const fixture = vi.hoisted(() => ({ payload: {} as Record<string, unknown>, channel: "WEB" }));
vi.mock("@/lib/hooks/use-workflow", () => ({ useWorkflowHistory: () => ({ data: { pages: [{ events: [{ id: "ev", actorId: "u", channel: fixture.channel, type: "request_changes", deliveryRevision: 1, createdAt: "2026-11-06T00:00:00Z", payload: fixture.payload }] }] } }) }));
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
