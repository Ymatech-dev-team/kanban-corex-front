import { describe, expect, it } from "vitest";
import type { WorkflowFinding, WorkflowReview, WorkflowState } from "@sistema-tasks/contracts";
import { deriveLiveStatus, SILENT_AFTER_MS, URGENCY, type LiveKind } from "./live-status";

const NOW = new Date("2026-11-12T15:00:00Z"); // 12:00 BRT
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const NAMES = ["typecheck", "lint", "test", "build"];
const passed = NAMES.map(name => ({ name, required: true, status: "passed" as const }));

function review(over: Partial<WorkflowReview> = {}): WorkflowReview {
  return { cycle: 1, deliveryRevision: 1, submittedBy: "u1", submittedAt: at(60), summary: "s", evidence: [], checks: passed, decision: "pending", reviewMode: "HUMAN", ...over };
}
function summary(over: Partial<NonNullable<WorkflowState["summary"]>> = {}): NonNullable<WorkflowState["summary"]> {
  return { objective: "Integrar POS", completed: ["Ler contrato", "Criar rota"], remaining: ["Testar", "Documentar"], nextStep: "Escrever testes da rota", blockers: [], references: [], updatedAt: at(2), updatedBy: "u1", channel: "MCP", ...over };
}
function execution(over: Partial<NonNullable<WorkflowState["execution"]>> = {}): NonNullable<WorkflowState["execution"]> {
  return { id: "e1", agent: "Claude", ownerId: "u1", channel: "MCP", status: "RUNNING", lastUpdatedAt: at(2), ...over };
}
function state(over: Partial<WorkflowState> = {}): WorkflowState {
  return { taskId: "t1", orgId: "o", version: 4, stage: "DOING", deliveryRevision: 1, responsibleId: "u1", criteria: [], context: "", executorIds: [], reviews: [], findings: [], summary: summary(), execution: execution(), ...over };
}
const derive = (s: WorkflowState, extra: Partial<Parameters<typeof deriveLiveStatus>[0]> = {}) =>
  deriveLiveStatus({ state: s, updatedAt: at(1), responsibleName: "Marina", ...extra }, NOW);
const finding = (over: Partial<WorkflowFinding> = {}): WorkflowFinding => ({ id: "f1", description: "Falta validar entrada", severity: "high", criterion: "c", responsibleId: "u1", blocking: true, state: "open", openedInCycle: 1, fixEvidence: [], ...over });

describe("deriveLiveStatus — as 9 linhas da tabela (design §3)", () => {
  it("1. DONE vence tudo, inclusive pedido aberto, sem sinal e bloqueios", () => {
    const s = state({ stage: "DONE", summary: summary({ blockers: ["x"] }), execution: execution({ lastUpdatedAt: at(500) }) });
    const out = derive(s, { openActionForMe: { kind: "DECIDE", question: "q?" } });
    expect(out.kind).toBe("done");
    expect(out.label).toBe("Concluída");
    expect(out.sentence).toBe("Entrega concluída. Evidências e histórico disponíveis.");
    expect(out.reason).toBeNull();
  });
  it("2. pedido aberto para mim: Esperando você, com a pergunta como motivo", () => {
    const out = derive(state(), { openActionForMe: { kind: "DECIDE", question: "Qual provedor usar?" } });
    expect(out.kind).toBe("you");
    expect(out.label).toBe("Esperando você");
    expect(out.reason).toBe("Qual provedor usar?");
    expect(out.sentence).toBe("Esperando sua resposta");
  });
  it("2b. pedido aberto vence sem sinal, bloqueio e revisão", () => {
    const s = state({ stage: "IN_REVIEW", reviews: [review()], summary: summary({ blockers: ["x"] }), execution: execution({ lastUpdatedAt: at(90) }) });
    expect(derive(s, { openActionForMe: { kind: "REVIEW", question: "Revisar" } }).kind).toBe("you");
  });
  it("3. RUNNING sem atualização há mais de 20 min: Sem sinal", () => {
    const out = derive(state({ summary: summary({ updatedAt: at(45) }), execution: execution({ lastUpdatedAt: at(45) }) }));
    expect(out.kind).toBe("silent");
    expect(out.label).toBe("Sem sinal");
    expect(out.sentence).toBe("Sem sinal do agente");
    expect(out.reason).toBe("Último relato às 11:15; nenhuma atualização desde então.");
    expect(out.doing).toBe("Escrever testes da rota");
  });
  it("4. blockers: Bloqueada, com o primeiro bloqueio como motivo", () => {
    const out = derive(state({ summary: summary({ blockers: ["Falta credencial da API", "Outro"] }) }));
    expect(out.kind).toBe("blocked");
    expect(out.label).toBe("Bloqueada");
    expect(out.reason).toBe("Falta credencial da API");
    expect(out.sentence).toBe("Bloqueada, aguardando desbloqueio");
  });
  it("5. CHANGES_REQUESTED: Ajustes pedidos, motivo é o primeiro achado bloqueante aberto", () => {
    const s = state({ stage: "CHANGES_REQUESTED", execution: execution({ status: "WAITING" }), findings: [finding({ id: "a", blocking: false, description: "estilo" }), finding({ id: "b", description: "Falta validar entrada" }), finding({ id: "c", description: "outro" })] });
    const out = derive(s);
    expect(out.kind).toBe("changes");
    expect(out.label).toBe("Ajustes pedidos");
    expect(out.reason).toBe("Falta validar entrada");
    expect(out.sentence).toBe("O agente deve corrigir os achados, repetir as verificações e retomar a revisão.");
  });
  it("5b. ajustes pedidos sem achado bloqueante: motivo nulo", () => {
    expect(derive(state({ stage: "CHANGES_REQUESTED", execution: undefined })).reason).toBeNull();
  });
  it("6. IN_REVIEW: Em revisão; com reviewMode AGENT ganha sufixo do agente", () => {
    const human = derive(state({ stage: "IN_REVIEW", execution: execution({ status: "WAITING" }), reviews: [review()] }));
    expect(human.kind).toBe("review");
    expect(human.label).toBe("Em revisão");
    const agent = derive(state({ stage: "IN_REVIEW", execution: execution({ status: "WAITING" }), reviews: [review({ reviewMode: "AGENT" })] }));
    expect(agent.kind).toBe("review");
    expect(agent.label).toBe("Em revisão do agente");
  });
  it("7. PAUSED, WAITING e FINISHED: Pausada, Aguardando, Aguardando retomada", () => {
    const pick = (status: "PAUSED" | "WAITING" | "FINISHED") => derive(state({ execution: execution({ status }) }));
    expect(pick("PAUSED")).toMatchObject({ kind: "paused", label: "Pausada" });
    expect(pick("WAITING")).toMatchObject({ kind: "paused", label: "Aguardando" });
    expect(pick("FINISHED")).toMatchObject({ kind: "paused", label: "Aguardando retomada" });
    expect(pick("PAUSED").sentence).toBe("Escrever testes da rota");
  });
  it("7b. pausada há horas continua pausada (sem sinal é só RUNNING)", () => {
    const out = derive(state({ summary: summary({ updatedAt: at(900) }), execution: execution({ status: "PAUSED", lastUpdatedAt: at(900) }) }));
    expect(out.kind).toBe("paused");
  });
  it("8. RUNNING recente: Rodando, fazendo agora é o próximo passo", () => {
    const out = derive(state());
    expect(out.kind).toBe("running");
    expect(out.label).toBe("Rodando");
    expect(out.doing).toBe("Escrever testes da rota");
    expect(out.reason).toBeNull();
    expect(out.sentence).toBe("Agente trabalhando");
  });
  it("8b. rodando sem próximo passo usa o objetivo como fazendo agora", () => {
    expect(derive(state({ summary: summary({ nextStep: "" }) })).doing).toBe("Integrar POS");
  });
  it("9. demais estágios: Backlog, Planejando, Pronta, Em execução manual", () => {
    const manual = (stage: WorkflowState["stage"]) => derive(state({ stage, execution: undefined, summary: undefined }));
    expect(manual("BACKLOG")).toMatchObject({ kind: "planning", label: "Backlog" });
    expect(manual("PLANNING")).toMatchObject({ kind: "planning", label: "Planejando" });
    expect(manual("READY")).toMatchObject({ kind: "planning", label: "Pronta" });
    expect(manual("DOING")).toMatchObject({ kind: "planning", label: "Em execução manual" });
    expect(manual("PLANNING").sentence).toBe("Aguardando o próximo registro de execução.");
  });
});

describe("deriveLiveStatus — prioridade entre regras", () => {
  it("RUNNING com blockers e sem sinal: silent vence blocked", () => {
    const out = derive(state({ summary: summary({ blockers: ["x"], updatedAt: at(40) }), execution: execution({ lastUpdatedAt: at(40) }) }));
    expect(out.kind).toBe("silent");
  });
  it("RUNNING com blockers e com sinal recente: blocked", () => {
    expect(derive(state({ summary: summary({ blockers: ["x"] }) })).kind).toBe("blocked");
  });
  it("blockers vencem CHANGES_REQUESTED, IN_REVIEW e PAUSED", () => {
    const b = summary({ blockers: ["x"] });
    expect(derive(state({ stage: "CHANGES_REQUESTED", summary: b, execution: execution({ status: "WAITING" }) })).kind).toBe("blocked");
    expect(derive(state({ stage: "IN_REVIEW", summary: b, reviews: [review()], execution: execution({ status: "WAITING" }) })).kind).toBe("blocked");
    expect(derive(state({ summary: b, execution: execution({ status: "PAUSED" }) })).kind).toBe("blocked");
  });
  it("CHANGES_REQUESTED vence IN_REVIEW e PAUSED; IN_REVIEW vence PAUSED", () => {
    expect(derive(state({ stage: "CHANGES_REQUESTED", execution: execution({ status: "PAUSED" }) })).kind).toBe("changes");
    expect(derive(state({ stage: "IN_REVIEW", reviews: [review()], execution: execution({ status: "PAUSED" }) })).kind).toBe("review");
  });
  it("E1: IN_REVIEW + RUNNING + 25 min continua review (sem sinal não se aplica)", () => {
    const s = state({ stage: "IN_REVIEW", reviews: [review()], summary: summary({ updatedAt: at(25) }), execution: execution({ lastUpdatedAt: at(25) }) });
    expect(derive(s).kind).toBe("review");
  });
  it("E1: CHANGES_REQUESTED + RUNNING + 25 min é silent (o agente precisa retomar)", () => {
    const s = state({ stage: "CHANGES_REQUESTED", summary: summary({ updatedAt: at(25) }), execution: execution({ lastUpdatedAt: at(25) }) });
    expect(derive(s).kind).toBe("silent");
  });
  it("E1: CHANGES_REQUESTED + RUNNING recente continua changes", () => {
    const s = state({ stage: "CHANGES_REQUESTED", summary: summary({ updatedAt: at(5) }), execution: execution({ lastUpdatedAt: at(5) }) });
    expect(derive(s).kind).toBe("changes");
  });
  it("E1: CHANGES_REQUESTED + FINISHED antigo continua changes (sem sinal é só RUNNING)", () => {
    const s = state({ stage: "CHANGES_REQUESTED", summary: summary({ updatedAt: at(90) }), execution: execution({ status: "FINISHED", lastUpdatedAt: at(90) }) });
    expect(derive(s).kind).toBe("changes");
  });
  it("E1: DOING + RUNNING + 25 min continua silent", () => {
    const s = state({ stage: "DOING", summary: summary({ updatedAt: at(25) }), execution: execution({ lastUpdatedAt: at(25) }) });
    expect(derive(s).kind).toBe("silent");
  });
  it("E1: IN_REVIEW com RUNNING antigo e blockers ainda cai em blocked (regra 4)", () => {
    const b = summary({ blockers: ["x"], updatedAt: at(90) });
    expect(derive(state({ stage: "IN_REVIEW", reviews: [review()], summary: b, execution: execution({ lastUpdatedAt: at(90) }) })).kind).toBe("blocked");
  });
  it("URGENCY lista os 9 tipos na ordem de urgência", () => {
    expect(URGENCY).toEqual(["silent", "blocked", "changes", "you", "review", "paused", "running", "planning", "done"] satisfies LiveKind[]);
  });
});

describe("deriveLiveStatus — limite de sem sinal", () => {
  it("SILENT_AFTER_MS é 20 min", () => { expect(SILENT_AFTER_MS).toBe(20 * 60_000); });
  const withAge = (minutes: number, seconds = 0) => {
    const iso = new Date(NOW.getTime() - (minutes * 60 + seconds) * 1000).toISOString();
    return derive(state({ summary: summary({ updatedAt: iso }), execution: execution({ lastUpdatedAt: iso }) })).kind;
  };
  it("19:59 ainda roda", () => { expect(withAge(19, 59)).toBe("running"); });
  it("20:00 exato ainda roda (passou de 20 min é estritamente maior)", () => { expect(withAge(20)).toBe("running"); });
  it("20:01 é sem sinal", () => { expect(withAge(20, 1)).toBe("silent"); });
  it("usa o mais recente entre execution.lastUpdatedAt e summary.updatedAt", () => {
    const s = state({ summary: summary({ updatedAt: at(5) }), execution: execution({ lastUpdatedAt: at(60) }) });
    expect(derive(s).kind).toBe("running");
    expect(derive(s).lastSignalAt).toBe(at(5));
    const s2 = state({ summary: summary({ updatedAt: at(60) }), execution: execution({ lastUpdatedAt: at(3) }) });
    expect(derive(s2).kind).toBe("running");
    expect(derive(s2).lastSignalAt).toBe(at(3));
  });
  it("sem summary, usa execution.lastUpdatedAt; sem ambos, o updatedAt do item", () => {
    expect(derive(state({ summary: undefined, execution: execution({ lastUpdatedAt: at(30) }) })).kind).toBe("silent");
    const none = deriveLiveStatus({ state: state({ summary: undefined, execution: undefined, stage: "PLANNING" }), updatedAt: at(77) }, NOW);
    expect(none.lastSignalAt).toBe(at(77));
  });
  it("relógio da execução no futuro não gera sem sinal", () => {
    const iso = new Date(NOW.getTime() + 5 * 60_000).toISOString();
    expect(derive(state({ summary: summary({ updatedAt: iso }), execution: execution({ lastUpdatedAt: iso }) })).kind).toBe("running");
  });
});

describe("deriveLiveStatus — passos, quem, canal", () => {
  it("steps null sem summary", () => {
    expect(derive(state({ summary: undefined })).steps).toBeNull();
  });
  it("conta feitos, total = feitos + restantes, atual = nextStep", () => {
    expect(derive(state()).steps).toEqual({ done: 2, total: 4, current: "Escrever testes da rota" });
  });
  it("atual cai para o primeiro restante e depois para null", () => {
    expect(derive(state({ summary: summary({ nextStep: "" }) })).steps?.current).toBe("Testar");
    expect(derive(state({ summary: summary({ nextStep: "", remaining: [] }) })).steps).toEqual({ done: 2, total: 2, current: null });
  });
  it("who: agente MCP; senão responsável; senão Equipe", () => {
    expect(derive(state()).who).toBe("Claude");
    expect(derive(state({ execution: execution({ channel: "WEB" }) })).who).toBe("Marina");
    expect(derive(state({ execution: undefined }), { responsibleName: null }).who).toBe("Equipe");
    expect(derive(state({ execution: undefined }), { responsibleName: undefined }).who).toBe("Equipe");
  });
  it("channel vem da execução, ou null", () => {
    expect(derive(state()).channel).toBe("MCP");
    expect(derive(state({ execution: execution({ channel: "LOCAL_SYNC" }) })).channel).toBe("LOCAL_SYNC");
    expect(derive(state({ execution: undefined })).channel).toBeNull();
  });
  it("next é o nextStep do relato, ou null", () => {
    expect(derive(state()).next).toBe("Escrever testes da rota");
    expect(derive(state({ summary: undefined })).next).toBeNull();
    expect(derive(state({ summary: summary({ nextStep: "" }) })).next).toBeNull();
  });
  it("ausência de summary não quebra nenhum estado", () => {
    for (const stage of ["BACKLOG", "PLANNING", "READY", "DOING", "IN_REVIEW", "CHANGES_REQUESTED", "DONE"] as const) {
      const out = derive(state({ stage, summary: undefined, execution: undefined, reviews: stage === "IN_REVIEW" ? [review()] : [] }));
      expect(out.steps).toBeNull();
      expect(typeof out.sentence).toBe("string");
    }
  });
});

describe("deriveLiveStatus — DONE e suas variantes (textos de workflow-presentation)", () => {
  const done = (over: Partial<WorkflowState>) => derive(state({ stage: "DONE", ...over }));
  it("Concluída", () => { expect(done({ reviews: [review({ decision: "approved", decidedChannel: "WEB" })] }).label).toBe("Concluída"); });
  it("Concluída com exceção (approvalOverride)", () => {
    const r = review({ decision: "approved", approvalOverride: { approvedBy: "u", approvedAt: at(5), channel: "WEB", cycle: 1, deliveryRevision: 1 } });
    expect(done({ reviews: [r] }).label).toBe("Concluída com exceção");
  });
  it("Concluída com ressalvas (reservation)", () => {
    const r = review({ decision: "approved", reservation: { checkNames: ["lint"], reason: "r", approvedBy: "u", approvedAt: at(5), cycle: 1, deliveryRevision: 1 } });
    expect(done({ reviews: [r] }).label).toBe("Concluída com ressalvas");
  });
  it("Concluída pelo quadro (boardCompletion da entrega atual)", () => {
    expect(done({ boardCompletion: { approvedBy: "u", approvedAt: at(5), channel: "WEB", deliveryRevision: 1 } }).label).toBe("Concluída pelo quadro");
    expect(done({ deliveryRevision: 2, boardCompletion: { approvedBy: "u", approvedAt: at(5), channel: "WEB", deliveryRevision: 1 } }).label).toBe("Concluída");
  });
  it("Concluída pelo agente (decidedChannel MCP)", () => {
    expect(done({ reviews: [review({ decision: "approved", decidedChannel: "MCP", decidedAgent: "Codex" })] }).label).toBe("Concluída pelo agente");
  });
  it("kind é done em todas as variantes", () => {
    expect(done({}).kind).toBe("done");
  });
});
