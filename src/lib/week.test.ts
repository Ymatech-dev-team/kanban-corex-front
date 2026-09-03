import { describe, it, expect } from "vitest";
import { startOfWeekMonday, weekDaysMonday } from "./week";

describe("startOfWeekMonday", () => {
  it("de uma quarta volta pra segunda", () => {
    const wed = new Date(2026, 8, 9); // qua, 09/set/2026
    const s = startOfWeekMonday(wed);
    expect(s.getDay()).toBe(1); // segunda
    expect(s.getDate()).toBe(7); // 07/set
  });
  it("de um domingo volta pra segunda anterior", () => {
    const sun = new Date(2026, 8, 13); // dom, 13/set
    const s = startOfWeekMonday(sun);
    expect(s.getDay()).toBe(1);
    expect(s.getDate()).toBe(7);
  });
  it("de uma segunda fica na própria segunda", () => {
    const mon = new Date(2026, 8, 7);
    expect(startOfWeekMonday(mon).getDate()).toBe(7);
  });
});

describe("weekDaysMonday", () => {
  it("devolve 7 dias, segunda→domingo, contendo o dia", () => {
    const days = weekDaysMonday(new Date(2026, 8, 9));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0);
    expect(days.map((d) => d.getDate())).toContain(9);
  });
});
