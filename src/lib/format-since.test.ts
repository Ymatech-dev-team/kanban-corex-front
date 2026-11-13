import { describe, expect, it } from "vitest";
import { formatClock, formatSince } from "./format-since";

// 2026-11-12 12:00 BRT (UTC-3, sem horário de verão)
const now = new Date("2026-11-12T15:00:00Z");

describe("formatSince", () => {
  it('diz "agora" para menos de 1 min e para relógio no futuro', () => {
    expect(formatSince("2026-11-12T14:59:40Z", now)).toBe("agora");
    expect(formatSince("2026-11-12T15:00:00Z", now)).toBe("agora");
    expect(formatSince("2026-11-12T15:05:00Z", now)).toBe("agora");
  });

  it('diz "há N min" até 59 min', () => {
    expect(formatSince("2026-11-12T14:59:00Z", now)).toBe("há 1 min");
    expect(formatSince("2026-11-12T14:30:00Z", now)).toBe("há 30 min");
    expect(formatSince("2026-11-12T14:01:00Z", now)).toBe("há 59 min");
  });

  it('diz "há N h" de 1 h até o fim do mesmo dia BRT', () => {
    expect(formatSince("2026-11-12T14:00:00Z", now)).toBe("há 1 h");
    expect(formatSince("2026-11-12T13:30:00Z", now)).toBe("há 1 h");
    expect(formatSince("2026-11-12T10:00:00Z", now)).toBe("há 5 h");
    expect(formatSince("2026-11-12T03:00:00Z", now)).toBe("há 12 h"); // 00:00 BRT de hoje
  });

  it('diz "ontem HH:MM" (BRT) para o dia anterior', () => {
    expect(formatSince("2026-11-12T02:59:00Z", now)).toBe("ontem 23:59");
    expect(formatSince("2026-11-11T14:00:00Z", now)).toBe("ontem 11:00");
    expect(formatSince("2026-11-11T03:00:00Z", now)).toBe("ontem 00:00");
  });

  it('usa "DD mmm" pt-BR para dias anteriores a ontem', () => {
    expect(formatSince("2026-11-10T20:00:00Z", now)).toBe("10 nov");
    expect(formatSince("2026-09-30T20:00:00Z", now)).toBe("30 set");
    expect(formatSince("2026-01-05T12:00:00Z", now)).toBe("05 jan");
    expect(formatSince("2026-12-01T12:00:00Z", new Date("2027-02-01T12:00:00Z"))).toBe("01 dez");
  });

  it("decide o dia pelo fuso BRT, não por UTC", () => {
    const lateNight = new Date("2026-11-12T02:00:00Z"); // 23:00 BRT de 11/11
    expect(formatSince("2026-11-11T03:30:00Z", lateNight)).toBe("há 22 h"); // 00:30 BRT de 11/11: mesmo dia BRT
    expect(formatSince("2026-11-12T01:50:00Z", lateNight)).toBe("há 10 min");
    expect(formatSince("2026-11-11T02:59:00Z", lateNight)).toBe("ontem 23:59"); // 23:59 BRT de 10/11
    const justAfterMidnight = new Date("2026-11-12T03:10:00Z"); // 00:10 BRT de 12/11
    expect(formatSince("2026-11-12T02:50:00Z", justAfterMidnight)).toBe("há 20 min"); // minutos vencem "ontem"
    expect(formatSince("2026-11-12T01:00:00Z", justAfterMidnight)).toBe("ontem 22:00");
  });

  it("devolve traço para data inválida", () => {
    expect(formatSince("não é data", now)).toBe("—");
  });
});

describe("formatClock", () => {
  it("formata HH:MM em BRT", () => {
    expect(formatClock("2026-11-12T15:07:00Z")).toBe("12:07");
    expect(formatClock("2026-11-12T02:59:00Z")).toBe("23:59");
    expect(formatClock("2026-11-12T03:00:00Z")).toBe("00:00");
  });
  it("devolve traço para data inválida", () => {
    expect(formatClock("x")).toBe("—");
  });
});
