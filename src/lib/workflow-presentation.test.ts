import { expect, it } from "vitest";
import type { WorkflowState } from "@sistema-tasks/contracts";
import { workflowPresentation } from "./workflow-presentation";
const state = { stage: "IN_REVIEW", deliveryRevision: 2, reviews: [{ deliveryRevision: 2, reviewMode: "AGENT", checks: ["typecheck", "lint", "test", "build"].map(name => ({ name, required: true, status: "passed" })) }], findings: [], execution: { channel: "MCP", agent: "Claude" } } as unknown as WorkflowState;
it("allows the connected agent to finish legacy reviews", () => { expect(workflowPresentation({ ...state, reviews: [{ ...state.reviews[0], reviewMode: undefined }] }).label).toBe("Revisão do agente"); });
it("treats validation from another delivery as blocking", () => { const result = workflowPresentation({ ...state, findings: [{ id: "f", blocking: true, state: "validated", resolvedDeliveryRevision: 1 } as WorkflowState["findings"][number]] }); expect(result.blocking).toHaveLength(1); expect(result.next).toMatch(/1 achado/); });
it("missing checks do not appear ready to conclude", () => { const result = workflowPresentation({ ...state, reviews: [{ ...state.reviews[0], checks: [] }] }); expect(result.label).toBe("Verificação pendente"); });
it("does not assert a running process from persisted DOING", () => { expect(workflowPresentation({ ...state, stage: "DOING" }).label).toBe("Execução registrada"); });
it("does not ask for final human acceptance when checks are ready", () => { expect(workflowPresentation(state).next).toMatch(/concluir pelo MCP/); });

it("uses persisted approver identity rather than a later execution", () => { const result = workflowPresentation({ ...state, stage: "DONE", reviews: [{ ...state.reviews[0], decidedChannel: "MCP", decidedAgent: "Codex" }] }); expect(result.agent).toBe("Codex"); });
it("does not attribute a human approval to the previous agent", () => { expect(workflowPresentation({ ...state, stage: "DONE", reviews: [{ ...state.reviews[0], decidedChannel: "WEB" }] }).agent).toBeNull(); });

it("labels direct board completion without reusing an older review",()=>{const result=workflowPresentation({...state,stage:"DONE",boardCompletion:{approvedBy:"u",approvedAt:"2026-11-12T00:00:00Z",channel:"WEB",deliveryRevision:2},reviews:[{...state.reviews[0],deliveryRevision:1,decidedChannel:"MCP",decidedAgent:"Old"}]});expect(result.label).toBe("Concluída pelo quadro");expect(result.agent).toBeNull();});
it("does not reuse board completion from older delivery",()=>{expect(workflowPresentation({...state,stage:"DONE",boardCompletion:{approvedBy:"u",approvedAt:"2026-11-12T00:00:00Z",channel:"WEB",deliveryRevision:1}}).label).toBe("Concluída");});
