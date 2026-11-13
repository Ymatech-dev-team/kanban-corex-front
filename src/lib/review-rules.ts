import type { WorkflowReview, WorkflowState } from "@sistema-tasks/contracts";

/**
 * Regras de habilitação da revisão — fonte única para a Folha (task-workflow) e para a Agora.
 * Extraídas sem mudança de comportamento de task-workflow.tsx; o teste de paridade compara
 * com a regra inline anterior em uma matriz de combinações.
 */
export interface ReviewCapabilities {
  canWrite: boolean;
  canReview: boolean;
  canApprove: boolean;
  canReopen: boolean;
}

export const REQUIRED_CHECKS = ["typecheck", "lint", "test", "build"] as const;

export interface ReviewRules {
  /** Última revisão registrada (qualquer entrega, como na folha atual). */
  review: WorkflowReview | undefined;
  /** O usuário não está entre os executores da entrega. */
  independent: boolean;
  agentReview: boolean;
  /** IN_REVIEW com a última revisão ainda pendente. */
  reviewing: boolean;
  /** Pode registrar achado, pedir ajuste e validar/dispensar achados. */
  canReview: boolean;
  checksPassed: boolean;
  unresolvedBlocking: boolean;
  /** Botão "Aprovar" aparece. */
  showApprove: boolean;
  /** Botão "Aprovar" aparece desabilitado (achado bloqueante aberto ou check fora de passed). */
  approveBlocked: boolean;
  showApproveAnyway: boolean;
  /** "Pedir ajuste" / "Solicitar ajustes". */
  showRequestChanges: boolean;
  /** Texto de apoio do "Aprovar mesmo assim". */
  showOverrideHint: boolean;
  /** Texto: executor só pode usar "Aprovar mesmo assim". */
  showIndependenceHint: boolean;
}

export function reviewRules(input: {
  state: WorkflowState | null | undefined;
  capabilities: ReviewCapabilities | null | undefined;
  userId: string | null | undefined;
}): ReviewRules {
  const state = input.state ?? undefined;
  const caps = input.capabilities ?? undefined;
  const review = state?.reviews.at(-1);
  const independent = !!input.userId && !state?.executorIds.includes(input.userId);
  const agentReview = review?.reviewMode === "AGENT";
  const reviewing = state?.stage === "IN_REVIEW" && review?.decision === "pending";
  const canReview = !!caps?.canReview && independent && reviewing;
  const checksPassed =
    !!review &&
    REQUIRED_CHECKS.every(name => review.checks.some(check => check.name === name && check.required && check.status === "passed")) &&
    !review.checks.some(check => check.required && check.status !== "passed");
  const unresolvedBlocking = !!state?.findings.some(
    finding => finding.blocking && (!["validated", "waived"].includes(finding.state) || finding.resolvedDeliveryRevision !== state.deliveryRevision),
  );
  return {
    review,
    independent,
    agentReview,
    reviewing,
    canReview,
    checksPassed,
    unresolvedBlocking,
    showApprove: !!(caps?.canApprove && independent && reviewing && !agentReview && review),
    approveBlocked: unresolvedBlocking || !checksPassed,
    showApproveAnyway: !!(caps?.canApprove && reviewing && review),
    showRequestChanges: canReview,
    showOverrideHint: reviewing && !checksPassed,
    showIndependenceHint: !independent && reviewing && !agentReview,
  };
}
