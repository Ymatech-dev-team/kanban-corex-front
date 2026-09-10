import { describe, it, expect } from "vitest";
import { nextTasks } from "./focus";
import type { Task } from "@/lib/types";

function t(id: string, priority: Task["priority"], dueDate: string | null): Task {
  return {
    id,
    projectId: "p1",
    title: id,
    description: null,
    status: "TODO",
    priority,
    dueDate,
    assigneeId: null,
    position: 1,
  };
}

describe("nextTasks (próximas a atacar)", () => {
  it("1º item é o de prazo mais próximo; do 2º em diante é a ordem normal por prioridade", () => {
    const A = t("A", "HIGH", "2026-09-14T12:00:00.000Z");
    const B = t("B", "MEDIUM", "2026-09-11T12:00:00.000Z"); // vence mais cedo
    const C = t("C", "HIGH", null); // sem prazo
    expect(nextTasks([A, B, C]).map((x) => x.id)).toEqual(["B", "A", "C"]);
  });

  it("todas sem prazo → só prioridade desc, desempate por id (determinístico)", () => {
    const x = t("x", "LOW", null);
    const y = t("y", "HIGH", null);
    const z = t("z", "HIGH", null);
    expect(nextTasks([x, z, y]).map((i) => i.id)).toEqual(["y", "z", "x"]);
  });

  it("mesmo prazo → desempata por prioridade no 1º item", () => {
    const a = t("a", "MEDIUM", "2026-09-11T09:00:00.000Z");
    const b = t("b", "HIGH", "2026-09-11T20:00:00.000Z"); // mesmo DIA
    expect(nextTasks([a, b])[0].id).toBe("b"); // mesma data → prioridade maior primeiro
  });

  it("retorna no máximo `limit` e nunca mais que o disponível", () => {
    const list = [t("a", "LOW", null), t("b", "MEDIUM", null)];
    expect(nextTasks(list)).toHaveLength(2); // só 2 disponíveis
    const many = ["a", "b", "c", "d"].map((id) => t(id, "LOW", null));
    expect(nextTasks(many)).toHaveLength(3); // limita a 3
    expect(nextTasks([])).toEqual([]);
  });

  it("prioridade desconhecida cai no menor peso, sem quebrar", () => {
    const weird = { ...t("w", "LOW", null), priority: "URGENTE" as unknown as Task["priority"] };
    const high = t("h", "HIGH", null);
    expect(nextTasks([weird, high]).map((i) => i.id)).toEqual(["h", "w"]);
  });
});
