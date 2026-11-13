import { describe, expect, it } from "vitest";
import type { WorkflowState } from "@sistema-tasks/contracts";
import { CHANNEL_LABEL, buildDoneToday, buildRows, endOfWeekSunday, filterRows, formatSituationDate, groupRows, parseGroup, parseView, startOfDayBrt, buildDeadlines, type FeedItem } from "./agora-model";
import type { Task } from "@/lib/types";

const at = (iso: string) => new Date(iso);
describe("startOfDayBrt", () => {
  it.each([
    ["00:30 BRT", "2026-11-12T03:30:00Z", "2026-11-12T03:00:00.000Z"],
    ["23:59 BRT", "2026-11-13T02:59:00Z", "2026-11-12T03:00:00.000Z"],
    ["02:00 UTC (23:00 BRT do dia anterior)", "2026-11-12T02:00:00Z", "2026-11-11T03:00:00.000Z"],
  ])("%s", (_name, now, expected) => expect(new Date(startOfDayBrt(at(now))).toISOString()).toBe(expected));
});

describe("datas", () => {
  it("formatSituationDate em BRT", () => expect(formatSituationDate(at("2026-11-12T17:32:00Z"))).toBe("qui 12 nov · 14:32"));
  it("endOfWeekSunday: fim do domingo da semana (segunda a domingo) em BRT, independente do fuso da máquina", () => {
    const end = (iso: string) => endOfWeekSunday(at(iso)).toISOString();
    expect(end("2026-11-12T13:00:00Z")).toBe("2026-11-16T02:59:59.999Z"); // quinta 12 10:00 BRT → domingo 15 23:59:59 BRT
    expect(end("2026-11-16T01:00:00Z")).toBe("2026-11-16T02:59:59.999Z"); // domingo 22:00 BRT, ainda a mesma semana
    expect(end("2026-11-16T03:30:00Z")).toBe("2026-11-23T02:59:59.999Z"); // segunda 00:30 BRT já abre a semana seguinte
    expect(end("2026-11-16T02:30:00Z")).toBe("2026-11-16T02:59:59.999Z"); // domingo 23:30 BRT (02:30 UTC de segunda)
  });
});

describe("parâmetros da URL", () => {
  it("valores inválidos caem no padrão", () => {
    expect(parseGroup("xyz")).toBe("estado");
    expect(parseGroup(null)).toBe("estado");
    expect(parseGroup("cliente")).toBe("cliente");
    expect(parseView("xyz")).toBeNull();
    expect(parseView("sinal")).toBe("sinal");
  });
});

const NOW = at("2026-11-12T17:32:00Z");
const ago = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const st = (taskId: string, over: Partial<WorkflowState> = {}) => ({ taskId, orgId: "o", version: 1, stage: "DOING", deliveryRevision: 1, responsibleId: "u", criteria: [], context: "", executorIds: [], reviews: [], findings: [], ...over }) as WorkflowState;
const item = (taskId: string, state: WorkflowState, over: Partial<FeedItem> = {}): FeedItem => ({ taskId, title: taskId, clientName: "IMA", projectName: "P", updatedAt: ago(1), state, ...over });
const run = (agent: string, minutes: number) => ({ execution: { id: "e", agent, ownerId: "o", channel: "MCP" as const, status: "RUNNING" as const, lastUpdatedAt: ago(minutes) } });

describe("buildRows / groupRows", () => {
  const items = [
    item("run-new", st("run-new", run("Claude", 2))), item("run-old", st("run-old", run("Claude", 10))),
    item("sil-b", st("sil-b", run("Codex", 90))), item("sil-a", st("sil-a", run("Codex", 300))),
    item("done", st("done", { stage: "DONE" })),
  ];
  const rows = buildRows(items, [], NOW);
  it("não inclui concluídas e ordena por urgência; sem sinal mais antigo primeiro, demais mais recente primeiro", () => {
    expect(rows.map(r => r.item.taskId)).toEqual(["sil-a", "sil-b", "run-new", "run-old"]);
  });
  it("pedido aberto para o usuário vira 'Esperando você' e ganha a linha", () => {
    const withAction = buildRows(items, [{ id: "a", taskId: "run-new", orgId: "o", recipientId: "me", kind: "DECIDE", state: "OPEN", question: "Q?", version: 1 }], NOW);
    expect(withAction[0].live.kind).toBe("silent");
    expect(withAction.find(r => r.item.taskId === "run-new")!.live.kind).toBe("you");
    expect(filterRows(withAction, "voce")).toHaveLength(1);
  });
  it("agrupa por estado na ordem de urgência, por pessoa e por cliente em ordem alfabética", () => {
    expect(groupRows(rows, "estado").map(g => g.label)).toEqual(["Sem sinal", "Rodando"]);
    expect(groupRows(rows, "pessoa").map(g => g.label)).toEqual(["Claude", "Codex"]);
    expect(groupRows(rows, "cliente").map(g => g.label)).toEqual(["IMA"]);
  });
});

describe("buildDoneToday", () => {
  it("só concluídas desde 00:00 BRT, mais recentes primeiro", () => {
    const list = buildDoneToday([
      item("d-old", st("d-old", { stage: "DONE" }), { updatedAt: "2026-11-12T02:59:00Z" }),
      item("d-1", st("d-1", { stage: "DONE" }), { updatedAt: "2026-11-12T10:00:00Z" }),
      item("d-2", st("d-2", { stage: "DONE" }), { updatedAt: "2026-11-12T16:00:00Z" }),
      item("run", st("run", run("Claude", 1))),
    ], NOW);
    expect(list.map(r => r.item.taskId)).toEqual(["d-2", "d-1"]);
  });
});

describe("buildDeadlines", () => {
  const task = (id: string, dueDate: string | null, status = "TODO") => ({ id, projectId: "c", title: id, status, dueDate }) as unknown as Task;
  it("o dia é o de BRT: prazo às 02:00 UTC de 13/11 é 12 nov em BRT e hoje não está vencido", () => {
    const list = buildDeadlines([task("n", "2026-11-13T02:00:00.000Z")], at("2026-11-12T13:00:00Z"));
    expect(list[0].label).toBe("12 nov");
    expect(list[0].overdue).toBe(false);
  });
  it("ignora concluídas, sem prazo e depois do domingo; marca vencidas", () => {
    const list = buildDeadlines([task("a", "2026-11-15T12:00:00.000Z"), task("b", "2026-11-10T12:00:00.000Z"), task("c", null), task("d", "2026-11-16T12:00:00.000Z"), task("e", "2026-11-11T12:00:00.000Z", "DONE")], at("2026-11-12T13:00:00Z"));
    expect(list.map(r => r.task.id)).toEqual(["b", "a"]);
    expect(list.map(r => r.overdue)).toEqual([true, false]);
    expect(list.map(r => r.label)).toEqual(["10 nov", "15 nov"]);
  });
});

describe("CHANNEL_LABEL", () => {
  it("mapa único e completo dos canais", () => expect(CHANNEL_LABEL).toEqual({ MCP: "MCP", WEB: "Painel", LOCAL_SYNC: "Sincronização local" }));
});
