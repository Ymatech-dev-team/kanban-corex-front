import { describe, expect, it } from "vitest";
import { mergeDiary } from "./diary-model";
import type { WorkflowHistoryEvent } from "@/lib/hooks/use-workflow";
import type { TaskActivity } from "@/lib/types";

const flow = (id: string, type: string, createdAt: string, payload: Record<string, unknown> = {}): WorkflowHistoryEvent => ({ id, actorId: "u1", channel: "WEB", type, version: 1, deliveryRevision: 1, createdAt, payload });
const act = (id: string, type: string, createdAt: string, payload: Record<string, unknown> = {}): TaskActivity => ({ id, type, actorId: "u1", actorName: "Ana", payload, createdAt } as TaskActivity);
const keys = (items: ReturnType<typeof mergeDiary>) => items.map((item) => item.key);

describe("mergeDiary: movimento pelo quadro aparece uma vez", () => {
  const move = flow("m1", "board_move", "2026-11-12T12:00:00.000Z", { from: "TODO", to: "DOING" });
  it("descarta o STATUS_CHANGED com o mesmo destino dentro de 5 s do board_move", () => {
    const merged = mergeDiary([move], [act("s1", "STATUS_CHANGED", "2026-11-12T12:00:03.000Z", { from: "TODO", to: "DOING" }), act("s2", "STATUS_CHANGED", "2026-11-12T11:59:57.000Z", { from: "TODO", to: "DOING" })]);
    expect(keys(merged)).toEqual(["f:m1"]);
  });
  it("mantém o STATUS_CHANGED fora da janela, com outro destino ou sem board_move", () => {
    const merged = mergeDiary([move], [
      act("late", "STATUS_CHANGED", "2026-11-12T12:00:06.000Z", { to: "DOING" }),
      act("other", "STATUS_CHANGED", "2026-11-12T12:00:01.000Z", { to: "DONE" }),
      act("edit", "FIELD_EDITED", "2026-11-12T12:00:01.000Z", { to: "DOING" }),
    ]);
    expect(keys(merged).sort()).toEqual(["a:edit", "a:late", "a:other", "f:m1"]);
    expect(keys(mergeDiary([], [act("alone", "STATUS_CHANGED", "2026-11-12T12:00:00.000Z", { to: "DOING" })]))).toEqual(["a:alone"]);
  });
  it("só um board_move equivalente vale; outros eventos do fluxo não escondem a atividade", () => {
    const merged = mergeDiary([flow("t1", "transition", "2026-11-12T12:00:00.000Z", { to: "DOING" })], [act("s1", "STATUS_CHANGED", "2026-11-12T12:00:01.000Z", { to: "DOING" })]);
    expect(keys(merged).sort()).toEqual(["a:s1", "f:t1"]);
  });
});
