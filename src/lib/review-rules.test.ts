import { describe, expect, it } from "vitest";
import type { WorkflowFinding, WorkflowReview, WorkflowState } from "@sistema-tasks/contracts";
import { reviewRules, type ReviewCapabilities } from "./review-rules";

const NAMES = ["typecheck", "lint", "test", "build"];
const passed = NAMES.map(name => ({ name, required: true, status: "passed" as const }));
const failedLint = passed.map(c => (c.name === "lint" ? { ...c, status: "failed" as const } : c));
const pendingBuild = passed.map(c => (c.name === "build" ? { ...c, status: "pending" as const } : c));
const optionalFail = [...passed, { name: "extra", required: false, status: "failed" as const }];
const requiredExtraPending = [...passed, { name: "extra", required: true, status: "pending" as const }];

function review(over: Partial<WorkflowReview> = {}): WorkflowReview {
  return { cycle: 1, deliveryRevision: 1, submittedBy: "u1", submittedAt: "2026-11-12T10:00:00Z", summary: "s", evidence: [], checks: passed, decision: "pending", reviewMode: "HUMAN", ...over };
}
function finding(over: Partial<WorkflowFinding> = {}): WorkflowFinding {
  return { id: "f1", description: "d", severity: "high", criterion: "c", responsibleId: "u1", blocking: true, state: "open", openedInCycle: 1, fixEvidence: [], ...over };
}
function state(over: Partial<WorkflowState> = {}): WorkflowState {
  return { taskId: "t", orgId: "o", version: 3, stage: "IN_REVIEW", deliveryRevision: 1, responsibleId: "u1", criteria: [], context: "", executorIds: ["exec"], reviews: [review()], findings: [], ...over };
}
const caps = (over: Partial<ReviewCapabilities> = {}): ReviewCapabilities => ({ canWrite: true, canReview: true, canApprove: true, canReopen: false, ...over });

describe("reviewRules — casos nomeados", () => {
  it("revisor independente com 4 checks e sem achados pode aprovar", () => {
    const r = reviewRules({ state: state(), capabilities: caps(), userId: "other" });
    expect(r.independent).toBe(true);
    expect(r.reviewing).toBe(true);
    expect(r.canReview).toBe(true);
    expect(r.checksPassed).toBe(true);
    expect(r.showApprove).toBe(true);
    expect(r.approveBlocked).toBe(false);
    expect(r.showApproveAnyway).toBe(true);
    expect(r.showRequestChanges).toBe(true);
  });
  it("executor não é independente: sem Aprovar, sem Pedir ajuste, mas com Aprovar mesmo assim", () => {
    const r = reviewRules({ state: state(), capabilities: caps(), userId: "exec" });
    expect(r.independent).toBe(false);
    expect(r.canReview).toBe(false);
    expect(r.showApprove).toBe(false);
    expect(r.showRequestChanges).toBe(false);
    expect(r.showApproveAnyway).toBe(true);
    expect(r.showIndependenceHint).toBe(true);
  });
  it("check falho ou pendente desabilita Aprovar e mostra a dica de Aprovar mesmo assim", () => {
    for (const checks of [failedLint, pendingBuild, requiredExtraPending, optionalFail.slice(0, 3)]) {
      const r = reviewRules({ state: state({ reviews: [review({ checks })] }), capabilities: caps(), userId: "other" });
      expect(r.checksPassed).toBe(false);
      expect(r.approveBlocked).toBe(true);
      expect(r.showOverrideHint).toBe(true);
    }
  });
  it("check opcional falho é ignorado; só os obrigatórios contam", () => {
    // regra atual: os 4 nomes passam e nenhum check obrigatório fica fora de "passed"
    const r = reviewRules({ state: state({ reviews: [review({ checks: optionalFail })] }), capabilities: caps(), userId: "other" });
    expect(r.checksPassed).toBe(true);
  });
  it("achado bloqueante aberto, ou validado em outra entrega, bloqueia Aprovar", () => {
    const open = reviewRules({ state: state({ findings: [finding()] }), capabilities: caps(), userId: "other" });
    expect(open.unresolvedBlocking).toBe(true);
    expect(open.approveBlocked).toBe(true);
    const stale = reviewRules({ state: state({ deliveryRevision: 2, reviews: [review({ deliveryRevision: 2 })], findings: [finding({ state: "validated", resolvedDeliveryRevision: 1 })] }), capabilities: caps(), userId: "other" });
    expect(stale.unresolvedBlocking).toBe(true);
    const ok = reviewRules({ state: state({ findings: [finding({ state: "validated", resolvedDeliveryRevision: 1 }), finding({ id: "f2", state: "waived", resolvedDeliveryRevision: 1 }), finding({ id: "f3", blocking: false })] }), capabilities: caps(), userId: "other" });
    expect(ok.unresolvedBlocking).toBe(false);
    expect(ok.approveBlocked).toBe(false);
  });
  it("revisão do agente não oferece Aprovar regular, mas oferece Aprovar mesmo assim", () => {
    const r = reviewRules({ state: state({ reviews: [review({ reviewMode: "AGENT" })] }), capabilities: caps(), userId: "other" });
    expect(r.agentReview).toBe(true);
    expect(r.showApprove).toBe(false);
    expect(r.showApproveAnyway).toBe(true);
  });
  it("revisão legada sem reviewMode não vira revisão do agente", () => {
    const r = reviewRules({ state: state({ reviews: [review({ reviewMode: undefined })] }), capabilities: caps(), userId: "other" });
    expect(r.agentReview).toBe(false);
    expect(r.showApprove).toBe(true);
  });
  it("sem canApprove nada de aprovação aparece; sem canReview não há Pedir ajuste", () => {
    const r = reviewRules({ state: state(), capabilities: caps({ canApprove: false, canReview: false }), userId: "other" });
    expect(r.showApprove).toBe(false);
    expect(r.showApproveAnyway).toBe(false);
    expect(r.showRequestChanges).toBe(false);
  });
  it("fora de IN_REVIEW ou com decisão já tomada nada é oferecido", () => {
    for (const s of [state({ stage: "DOING" }), state({ stage: "DONE" }), state({ reviews: [review({ decision: "approved" })] }), state({ reviews: [review({ decision: "changes_requested" })] }), state({ reviews: [] })]) {
      const r = reviewRules({ state: s, capabilities: caps(), userId: "other" });
      expect(r.reviewing).toBe(false);
      expect(r.showApprove).toBe(false);
      expect(r.showApproveAnyway).toBe(false);
      expect(r.showRequestChanges).toBe(false);
    }
  });
  it("sem usuário carregado, sem estado ou sem capacidades: tudo recusado", () => {
    expect(reviewRules({ state: state(), capabilities: caps(), userId: undefined }).independent).toBe(false);
    expect(reviewRules({ state: state(), capabilities: caps(), userId: undefined }).showApprove).toBe(false);
    const none = reviewRules({ state: undefined, capabilities: undefined, userId: "other" });
    expect(none.showApprove).toBe(false);
    expect(none.showApproveAnyway).toBe(false);
    expect(none.showRequestChanges).toBe(false);
    expect(none.review).toBeUndefined();
    expect(reviewRules({ state: null, capabilities: undefined, userId: "other" }).reviewing).toBe(false);
  });
  it("usa a última revisão, mesmo de outra entrega (comportamento atual preservado)", () => {
    const r = reviewRules({ state: state({ deliveryRevision: 2, reviews: [review({ cycle: 1, checks: failedLint }), review({ cycle: 2, deliveryRevision: 1 })] }), capabilities: caps(), userId: "other" });
    expect(r.review?.cycle).toBe(2);
    expect(r.checksPassed).toBe(true);
  });
});

/** Cópia literal da regra inline anterior em task-workflow.tsx (referência de paridade). */
function legacy(s: WorkflowState | undefined, c: ReviewCapabilities | undefined, me: { userId: string } | undefined) {
  const rv = s?.reviews.at(-1);
  const independent = !!me && !s?.executorIds.includes(me.userId);
  const agentReview = rv?.reviewMode === "AGENT";
  const reviewing = s?.stage === "IN_REVIEW" && rv?.decision === "pending";
  const canReview = c?.canReview && independent && reviewing;
  const checksPassed = !!rv && ["typecheck", "lint", "test", "build"].every(name => rv.checks.some(check => check.name === name && check.required && check.status === "passed")) && !rv.checks.some(check => check.required && check.status !== "passed");
  const unresolvedBlocking = !!s?.findings.some(finding => finding.blocking && (!["validated", "waived"].includes(finding.state) || finding.resolvedDeliveryRevision !== s.deliveryRevision));
  return {
    independent, agentReview, reviewing: !!reviewing, canReview: !!canReview, checksPassed, unresolvedBlocking,
    showApprove: !!(c?.canApprove && independent && reviewing && !agentReview && rv),
    approveBlocked: unresolvedBlocking || !checksPassed,
    showApproveAnyway: !!(c?.canApprove && reviewing && rv),
    showRequestChanges: !!canReview,
    showOverrideHint: !!(reviewing && !checksPassed),
    showIndependenceHint: !!(!independent && reviewing && !agentReview),
  };
}

describe("reviewRules — paridade com a regra inline anterior", () => {
  it("produz o mesmo resultado em toda a matriz de combinações", () => {
    const stages = ["DOING", "IN_REVIEW", "DONE"] as const;
    const decisions = ["pending", "approved", "changes_requested"] as const;
    const modes = [undefined, "AGENT", "HUMAN"] as const;
    const checkSets = [passed, failedLint, pendingBuild, optionalFail, requiredExtraPending, []];
    const findingSets: WorkflowFinding[][] = [[], [finding()], [finding({ state: "fix_reported" })], [finding({ state: "validated", resolvedDeliveryRevision: 1 })], [finding({ state: "validated", resolvedDeliveryRevision: 0 })], [finding({ blocking: false })]];
    const users = [undefined, "exec", "other"];
    const capSets = [undefined, caps(), caps({ canApprove: false }), caps({ canReview: false }), caps({ canApprove: false, canReview: false })];
    let n = 0;
    for (const stage of stages) for (const decision of decisions) for (const reviewMode of modes) for (const checks of checkSets) for (const findings of findingSets) for (const userId of users) for (const c of capSets) for (const withReview of [true, false]) {
      const s = state({ stage, findings, reviews: withReview ? [review({ decision, reviewMode, checks })] : [] });
      const r = reviewRules({ state: s, capabilities: c, userId });
      const l = legacy(s, c, userId ? { userId } : undefined);
      expect({ independent: r.independent, agentReview: r.agentReview, reviewing: r.reviewing, canReview: r.canReview, checksPassed: r.checksPassed, unresolvedBlocking: r.unresolvedBlocking, showApprove: r.showApprove, approveBlocked: r.approveBlocked, showApproveAnyway: r.showApproveAnyway, showRequestChanges: r.showRequestChanges, showOverrideHint: r.showOverrideHint, showIndependenceHint: r.showIndependenceHint }).toEqual(l);
      n++;
    }
    expect(n).toBeGreaterThan(5000);
  });
});
