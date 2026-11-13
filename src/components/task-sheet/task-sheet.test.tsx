import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskSheet } from "./task-sheet";
import { DIARY_PAGE } from "./sheet-diary";
import type { useWorkflow } from "@/lib/hooks/use-workflow";
import type { TaskActivity } from "@/lib/types";

const mock = vi.hoisted(() => ({
  write: vi.fn(),
  user: "reviewer",
  history: { events: [] as unknown[], hasNext: false, fetchNext: vi.fn(), refetch: vi.fn(), isError: false },
  activity: { items: [] as unknown[], hasNext: false, fetchNext: vi.fn(), isError: false },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/hooks/use-me", () => ({ useMe: () => ({ data: { userId: mock.user } }) }));
vi.mock("@/lib/hooks/use-now", () => ({ useNow: () => new Date("2026-11-12T15:00:00Z") }));
vi.mock("@/lib/hooks/use-workflow", async (actual) => ({
  ...await actual<typeof import("@/lib/hooks/use-workflow")>(),
  useWorkflowWrite: () => ({ mutateAsync: mock.write, isPending: false }),
  useWorkflowHistory: () => ({ data: { pages: [{ events: mock.history.events }] }, hasNextPage: mock.history.hasNext, isFetchingNextPage: false, fetchNextPage: mock.history.fetchNext, isLoading: false, isError: mock.history.isError, refetch: mock.history.refetch }),
}));
vi.mock("@/lib/hooks/use-task-activity", () => {
  const mut = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false });
  return {
    idemKey: () => "key", activityKey: (id: string | null) => ["activity", id],
    useTaskActivity: () => ({ data: { pages: [{ items: mock.activity.items, nextCursor: null }] }, hasNextPage: mock.activity.hasNext, isFetchingNextPage: false, fetchNextPage: mock.activity.fetchNext, isLoading: false, isError: mock.activity.isError, refetch: vi.fn() }),
    useAddComment: mut, useEditComment: mut, useDeleteComment: mut,
  };
});
vi.mock("@/components/agora/action-response", () => ({ ActionResponse: ({ action }: { action: { id: string } }) => <div data-testid="action-response">{action.id}</div> }));

const members = { executor: "Executor", reviewer: "Revisor" };
const baseState = { taskId: "t1", orgId: "o1", version: 3, stage: "DOING", deliveryRevision: 1, responsibleId: "executor", executorIds: ["executor"], context: "Contexto real", criteria: ["Critério real"], findings: [], reviews: [] };
const summary = { objective: "Integrar o POS", completed: ["Levantar fluxo", "Definir contrato"], remaining: ["Credenciais de homologação", "Smoke em dev"], nextStep: "Credenciais de homologação", blockers: [], references: [], updatedAt: "2026-11-12T14:58:00Z", updatedBy: "executor", channel: "MCP" };
const execution = { id: "e1", agent: "Claude", ownerId: "executor", channel: "MCP", status: "RUNNING", lastUpdatedAt: "2026-11-12T14:58:00Z" };
function flow(patch: { state?: object | null; actions?: object[]; extra?: object } = {}) {
  const state = patch.state === null ? null : { ...baseState, ...(patch.state ?? {}) };
  return { data: { state, actions: patch.actions ?? [], events: [], capabilities: { canWrite: true, canReview: true, canApprove: true, canReopen: false } }, ...patch.extra } as unknown as ReturnType<typeof useWorkflow>;
}
function sheet(workflow: ReturnType<typeof useWorkflow>) {
  return <TaskSheet taskId="t1" taskTitle="Integração POS" taskUpdatedAt="2026-11-12T10:00:00Z" workflow={workflow} members={members}
    onWorkflowDirtyChange={vi.fn()} header={<h1>Integração POS</h1>} file={<p>Corpo da ficha</p>} fileOpen={false} onFileOpenChange={vi.fn()} />;
}
function renderSheet(workflow: ReturnType<typeof useWorkflow>, options?: { container: HTMLElement }) {
  return render(sheet(workflow), options);
}
const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const activity = (partial: Partial<TaskActivity>): TaskActivity => ({ id: Math.random().toString(36).slice(2), type: "CREATED", actorId: "u1", actorName: "Ana", payload: {}, createdAt: "2026-11-12T12:00:00.000Z", ...partial });
const event = (partial: Record<string, unknown>) => ({ id: Math.random().toString(36).slice(2), actorId: "executor", channel: "MCP", type: "report_progress", version: 1, deliveryRevision: 1, createdAt: "2026-11-12T12:00:00.000Z", payload: {}, ...partial });

beforeEach(() => {
  mock.user = "reviewer"; mock.write.mockReset();
  mock.history = { events: [], hasNext: false, fetchNext: vi.fn(), refetch: vi.fn(), isError: false };
  mock.activity = { items: [], hasNext: false, fetchNext: vi.fn(), isError: false };
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; }); // sem espera de quadro nos testes
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe("folha: rolagem única (RF28)", () => {
  it("renders Agora, Passos, Revisão, Diário e Ficha in that order, with no tabs", () => {
    renderSheet(flow({ state: { summary, execution } }));
    expect(headings()).toEqual(["Agora", "Passos", "Revisão", "Diário", "Ficha"]);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("offers a fixed index in the same order, with exactly one section marked", () => {
    renderSheet(flow({ state: { summary, execution } }));
    const nav = screen.getByRole("navigation", { name: "Seções da tarefa" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Agora", "Passos", "Revisão", "Diário", "Ficha"]);
    expect(links.filter((l) => l.getAttribute("aria-current") === "location")).toHaveLength(1); // a posição exata é testada com layout simulado, abaixo
    expect(nav.className).toMatch(/hidden/); // some abaixo de 1024 px
    expect(nav.className).toMatch(/lg:block/);
  });

  it("scrolls to the section when an index link is used, without touching the URL hash", () => {
    renderSheet(flow({ state: { summary, execution } }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Seções da tarefa" })).getByRole("link", { name: "Diário" }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("task without workflow shows Ficha and Diário plus the existing activate action, with no empty Passos/Revisão", () => {
    renderSheet(flow({ state: null }));
    expect(headings()).toEqual(["Ficha", "Diário"]);
    expect(screen.queryByRole("heading", { name: "Passos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Revisão" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativar fluxo" })).toBeInTheDocument();
    const links = within(screen.getByRole("navigation", { name: "Seções da tarefa" })).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Ficha", "Diário"]);
  });

  it("does not offer to activate the workflow where it is unavailable (404) and hides stale data on other errors", () => {
    const { unmount } = renderSheet(flow({ state: null, extra: { isError: true, error: { response: { status: 404 } } } }));
    expect(screen.queryByRole("button", { name: "Ativar fluxo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    unmount();
    renderSheet(flow({ state: { summary, execution }, extra: { isError: true, error: { response: { status: 500 } }, refetch: vi.fn() } }));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível consultar o fluxo desta tarefa.");
    expect(screen.getByRole("button", { name: "Recarregar fluxo" })).toBeInTheDocument();
    expect(screen.queryByText("Integrar o POS")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Passos" })).not.toBeInTheDocument();
  });

  it("shows a skeleton while the workflow loads, without guessing which sections apply", () => {
    renderSheet({ data: undefined, isLoading: true } as unknown as ReturnType<typeof useWorkflow>);
    expect(screen.getByRole("status", { name: "Carregando fluxo da tarefa" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar fluxo" })).not.toBeInTheDocument();
  });
});

describe("Agora (RF30)", () => {
  it("shows the three fixed rows from the derived live status", () => {
    renderSheet(flow({ state: { summary, execution } }));
    const now = document.getElementById("sheet-agora")!;
    expect(within(now).getByText("Estado")).toBeInTheDocument();
    expect(within(now).getByText("Rodando")).toBeInTheDocument();
    expect(within(now).getByText("Fazendo agora")).toBeInTheDocument();
    expect(within(now).getByText("Próximo passo")).toBeInTheDocument();
    expect(within(now).getAllByText("Credenciais de homologação").length).toBeGreaterThan(0);
  });

  it("uses Parou porque with the blocker as reason when blocked", () => {
    renderSheet(flow({ state: { summary: { ...summary, blockers: ["Decisão da adquirente pendente"] }, execution: { ...execution, status: "WAITING" } } }));
    const now = document.getElementById("sheet-agora")!;
    expect(within(now).getByText("Bloqueada")).toBeInTheDocument();
    expect(within(now).getByText("Parou porque")).toBeInTheDocument();
    expect(within(now).getByText("Decisão da adquirente pendente")).toBeInTheDocument();
  });

  it("puts the decision box on top when a request is open for the user, via the shared response component", () => {
    renderSheet(flow({ state: { summary, execution }, actions: [{ id: "a1", taskId: "t1", kind: "DECIDE", state: "OPEN", recipientId: "reviewer", question: "Stone ou Cielo?", options: ["Stone", "Cielo"], version: 4 }] }));
    const now = document.getElementById("sheet-agora")!;
    expect(within(now).getByText("Espera você")).toBeInTheDocument();
    expect(within(now).getByText("Stone ou Cielo?")).toBeInTheDocument();
    expect(within(now).getByTestId("action-response")).toHaveTextContent("a1");
    expect(within(now).getByText("Esperando você")).toBeInTheDocument(); // estado vivo
  });

  it("has no decision box without an open request for the user", () => {
    renderSheet(flow({ state: { summary, execution }, actions: [{ id: "a2", taskId: "t1", kind: "DECIDE", state: "OPEN", recipientId: "executor", question: "Outra pessoa decide", version: 4 }] }));
    expect(screen.queryByTestId("action-response")).not.toBeInTheDocument();
  });
});

describe("Passos (RF31)", () => {
  it("strikes done steps, marks the current one as agora, counts n de total and lists blockers", () => {
    renderSheet(flow({ state: { summary: { ...summary, blockers: ["Falta a chave do POS"] }, execution } }));
    const steps = document.getElementById("sheet-passos")!;
    expect(within(steps).getByText("2 de 4")).toBeInTheDocument();
    expect(within(steps).getByRole("meter", { name: "2 de 4 passos" })).toBeInTheDocument();
    const items = within(steps).getAllByRole("listitem");
    expect(items.map((i) => i.getAttribute("data-step"))).toEqual(["done", "done", "now", "todo", null]);
    expect(within(steps).getByText("agora · bloqueado")).toBeInTheDocument();
    expect(within(steps).getByText("Bloqueio · Falta a chave do POS")).toBeInTheDocument();
    expect(within(steps).getByText(/Objetivo/)).toBeInTheDocument();
  });

  it("says the agent has not reported steps and shows the acceptance criteria", () => {
    renderSheet(flow({ state: {} }));
    const steps = document.getElementById("sheet-passos")!;
    expect(within(steps).getByText("O agente ainda não relatou passos.")).toBeInTheDocument();
    expect(within(steps).getByText("Critério real")).toBeInTheDocument();
    expect(within(steps).queryByRole("meter")).not.toBeInTheDocument();
  });
});

describe("Revisão (RF32) — ações com as mesmas condições", () => {
  const review = { cycle: 1, deliveryRevision: 1, summary: "Entrega real", evidence: [], checks: ["typecheck", "lint", "test", "build"].map((name) => ({ name, required: true, status: name === "lint" ? "failed" : "passed" })), decision: "pending" };
  it("shows the four checks, ciclo/entrega, and findings with severity, blocking, state and owner", () => {
    renderSheet(flow({ state: { stage: "IN_REVIEW", reviews: [review], findings: [{ id: "f1", description: "Valor negativo aceito", severity: "high", criterion: "C", responsibleId: "executor", blocking: true, state: "fix_reported", openedInCycle: 1, fixEvidence: [] }] } }));
    const section = document.getElementById("sheet-revisao")!;
    expect(within(section).getByText("ciclo 1 · entrega 1")).toBeInTheDocument();
    expect(within(section).getAllByRole("listitem").filter((li) => li.hasAttribute("data-status"))).toHaveLength(4);
    const row = within(section).getByText("Valor negativo aceito").closest("tr")!;
    expect(within(row).getByText("alta")).toBeInTheDocument();
    expect(within(row).getByText("sim")).toBeInTheDocument();
    expect(within(row).getByText("Correção informada")).toBeInTheDocument();
    expect(within(row).getByText("Executor")).toBeInTheDocument();
  });

  it("keeps Aprovar disabled while a check failed or a blocking finding is open, and offers Pedir ajuste and Aprovar mesmo assim", () => {
    renderSheet(flow({ state: { stage: "IN_REVIEW", reviews: [review] } }));
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pedir ajuste" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Aprovar mesmo assim" })).toBeEnabled();
  });

  it("enables Aprovar only when every required check passed and nothing blocks", () => {
    const ok = { ...review, checks: review.checks.map((c) => ({ ...c, status: "passed" })) };
    renderSheet(flow({ state: { stage: "IN_REVIEW", reviews: [ok] } }));
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeEnabled();
  });

  it("does not show Passos-style empty Revisão actions to someone without permission", () => {
    const view = flow({ state: { stage: "IN_REVIEW", reviews: [review] } });
    (view.data as { capabilities: object }).capabilities = { canWrite: false, canReview: false, canApprove: false, canReopen: false };
    renderSheet(view);
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pedir ajuste" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar mesmo assim" })).not.toBeInTheDocument();
  });
});

describe("Diário (RF33)", () => {
  it("interleaves flow events, activity and comments by time, newest first, grouped by day with mono clock", () => {
    mock.history.events = [event({ id: "h1", type: "start_execution", createdAt: "2026-11-12T13:02:00.000Z" }), event({ id: "h2", type: "submit_review", createdAt: "2026-11-11T20:55:00.000Z" })];
    mock.activity.items = [
      activity({ id: "a1", type: "COMMENT", actorName: "Bia", body: "Comentário no meio", createdAt: "2026-11-12T13:30:00.000Z" }),
      activity({ id: "a2", type: "STATUS_CHANGED", actorName: "Ana", payload: { from: "TODO", to: "DOING" }, createdAt: "2026-11-12T12:10:00.000Z" }),
    ];
    renderSheet(flow({ state: { summary, execution } }));
    const diary = document.getElementById("sheet-diario")!;
    const rows = within(diary).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Comentário no meio"),
      expect.stringContaining("Execução iniciada"),
      expect.stringContaining("moveu de"),
      expect.stringContaining("Entrega enviada para revisão"),
    ]);
    expect(within(rows[0]).getByText("10:30")).toHaveClass("mono"); // 13:30Z = 10:30 BRT
    const groups = within(diary).getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(groups).toEqual(["Hoje", "Ontem"]);
    expect(within(diary).getByRole("textbox", { name: "Novo comentário" })).toBeInTheDocument(); // comentar fica no fim
  });

  it("shows the 8 most recent and loads the rest on Ver tudo", () => {
    mock.activity.items = Array.from({ length: 11 }, (_, i) => activity({ id: `a${i}`, type: "CREATED", actorName: `Pessoa ${i}`, createdAt: `2026-11-12T1${i % 10}:00:00.000Z` }));
    mock.activity.hasNext = true;
    renderSheet(flow({ state: { summary, execution } }));
    const diary = document.getElementById("sheet-diario")!;
    expect(within(diary).getAllByRole("listitem")).toHaveLength(DIARY_PAGE);
    fireEvent.click(within(diary).getByRole("button", { name: "Ver tudo" }));
    expect(within(diary).getAllByRole("listitem")).toHaveLength(11);
    expect(mock.activity.fetchNext).toHaveBeenCalled(); // busca o restante
  });

  it("shows flow events as text only (no HTML) and keeps the details behind a disclosure", () => {
    mock.history.events = [event({ id: "h1", type: "request_changes", payload: { command: { reason: "<img src=x onerror=alert(1)>" } } })];
    const { container } = renderSheet(flow({ state: { summary, execution } }));
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: "Ver registro completo" })).toHaveAttribute("aria-expanded", "false");
  });

  it("explains partial failure and offers retry", () => {
    mock.history.isError = true;
    renderSheet(flow({ state: { summary, execution } }));
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Tentar de novo" }));
    expect(mock.history.refetch).toHaveBeenCalled();
  });
});

describe("Ficha (RF34)", () => {
  it("is collapsed or open from the parent choice and always carries the provided body", () => {
    renderSheet(flow({ state: { summary, execution } }));
    const trigger = within(document.getElementById("sheet-ficha")!).getByRole("button", { name: /Descrição, critérios, anexos e custo/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Corpo da ficha")).toBeInTheDocument();
  });
});

describe("índice: seção ativa por posição, no contêiner que rola (RF28, B4)", () => {
  afterEach(() => { document.querySelectorAll("body > div[style*=overflow]").forEach((el) => el.remove()); });
  // Medidas reais de um drawer aberto no navegador (1440x900): contêiner com 835 de altura visível, rolagem máxima 446.
  const BASE: Record<string, number> = { "sheet-agora": 152, "sheet-passos": 553, "sheet-revisao": 814, "sheet-diario": 955, "sheet-ficha": 1214 };
  const links = () => within(screen.getByRole("navigation", { name: "Seções da tarefa" })).getAllByRole("link");
  const current = () => links().find((link) => link.getAttribute("aria-current") === "location")?.textContent;

  /** jsdom não faz layout: contêiner, rolagem e topo das seções são definidos à mão, com os números do navegador. */
  function drawer({ scrollHeight = 1281, overflowing = true } = {}) {
    const el = document.createElement("div");
    el.style.overflowY = "auto";
    document.body.appendChild(el);
    const metrics = { scrollTop: 0, clientHeight: 835, scrollHeight: overflowing ? scrollHeight : 835 };
    for (const key of ["scrollTop", "clientHeight", "scrollHeight"] as const) {
      Object.defineProperty(el, key, { configurable: true, get: () => metrics[key], set: (value: number) => { metrics[key] = value; } });
    }
    const rect = (top: number) => ({ top, bottom: top + 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    el.getBoundingClientRect = () => rect(0);
    const host = document.createElement("div");
    el.appendChild(host);
    return {
      el, metrics,
      mount() {
        renderSheet(flow({ state: { summary, execution } }), { container: host });
        for (const [id, base] of Object.entries(BASE)) document.getElementById(id)!.getBoundingClientRect = () => rect(base - metrics.scrollTop);
      },
      scrollTo(y: number) { metrics.scrollTop = y; act(() => { el.dispatchEvent(new Event("scroll")); }); },
    };
  }

  it("rolagem 0 → Agora; 400 → Passos; 600 → Revisão; fim → Ficha (os números do navegador)", () => {
    const d = drawer({ scrollHeight: 2000 }); // 600 ainda não é o fim
    d.mount();
    d.scrollTo(0);
    expect(current()).toBe("Agora"); // agora:152 ≤ 250,5 e passos:553 não
    d.scrollTo(400);
    expect(current()).toBe("Passos"); // agora:-248, passos:153 ≤ 250,5, revisão:414 não
    d.scrollTo(600);
    expect(current()).toBe("Revisão"); // revisão:214 ≤ 250,5, diário:355 não
    d.scrollTo(1165); // 1165 + 835 = 2000
    expect(current()).toBe("Ficha");
    d.scrollTo(400);
    expect(current()).toBe("Passos"); // sair do fim volta à regra por posição
  });

  it("com a rolagem máxima do drawer medido (446), o fim marca a Ficha e 400 ainda é Passos", () => {
    const d = drawer({ scrollHeight: 1281 }); // 446 + 835
    d.mount();
    d.scrollTo(400);
    expect(current()).toBe("Passos");
    d.scrollTo(446);
    expect(current()).toBe("Ficha");
  });

  it("pula um overflow:auto que não rola e mede no ancestral que rola de verdade", () => {
    const d = drawer({ scrollHeight: 2000 });
    const inner = document.createElement("div"); // como o contêiner do detalhe: overflow-auto, mas sem transbordar
    inner.style.overflowY = "auto";
    d.el.appendChild(inner);
    renderSheet(flow({ state: { summary, execution } }), { container: inner });
    for (const [id, base] of Object.entries(BASE)) document.getElementById(id)!.getBoundingClientRect = () => ({ top: base - d.metrics.scrollTop }) as DOMRect;
    d.scrollTo(400);
    expect(current()).toBe("Passos");
  });

  it("corrige o dono da rolagem quando o scroll vem de outro contêiner (conteúdo que só passou a transbordar depois)", () => {
    const d = drawer({ scrollHeight: 2000, overflowing: false });
    d.mount();
    d.metrics.scrollHeight = 2000; // o diário carregou
    d.scrollTo(400);
    expect(current()).toBe("Passos");
  });

  it("sem ninguém transbordando, mede contra a janela (scroll do document)", () => {
    renderSheet(flow({ state: { summary, execution } }));
    const rect = (top: number) => ({ top }) as DOMRect;
    const tops: Record<string, number> = { "sheet-agora": -900, "sheet-passos": -400, "sheet-revisao": 100, "sheet-diario": 900, "sheet-ficha": 1400 };
    for (const [id, top] of Object.entries(tops)) document.getElementById(id)!.getBoundingClientRect = () => rect(top);
    act(() => { document.dispatchEvent(new Event("scroll")); });
    expect(current()).toBe("Revisão"); // janela de 768: linha em 230; revisão:100 ≤ 230, diário:900 não
  });

  it("recalcula no máximo uma vez por quadro (requestAnimationFrame)", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    const d = drawer({ scrollHeight: 2000 });
    d.mount();
    frames.splice(0).forEach((cb) => act(() => cb(0))); // quadro da montagem
    d.metrics.scrollTop = 400;
    act(() => { for (let i = 0; i < 5; i++) d.el.dispatchEvent(new Event("scroll")); });
    expect(frames).toHaveLength(1);
    act(() => frames[0](0));
    expect(current()).toBe("Passos");
  });

  it("clicar no índice rola a própria seção (scrollIntoView sobe pelos ancestrais, dentro do mesmo contêiner)", () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) { scrolled.push(this.id); });
    renderSheet(flow({ state: { summary, execution } }));
    fireEvent.click(links().find((link) => link.textContent === "Revisão")!);
    expect(scrolled).toEqual(["sheet-revisao"]);
  });
});

describe("ajustes de UX da folha", () => {
  it("com a tarefa concluída, Próximo passo não repete o último relato do agente", () => {
    renderSheet(flow({ state: { stage: "DONE", summary: { ...summary, nextStep: "Gerar credenciais" }, reviews: [{ cycle: 1, deliveryRevision: 1, summary: "s", evidence: [], checks: [], decision: "approved" }] } }));
    const row = within(document.getElementById("sheet-agora")!).getByText("Próximo passo").parentElement!;
    expect(row).not.toHaveTextContent("Gerar credenciais");
    expect(row).toHaveTextContent("—");
  });

  it("Esperando você não repete a frase no Estado e o canal usa os rótulos da Agora", () => {
    renderSheet(flow({ state: { summary, execution }, actions: [{ id: "a1", taskId: "t1", kind: "DECIDE", state: "OPEN", recipientId: "reviewer", question: "Qual?", version: 2 }] }));
    const now = document.getElementById("sheet-agora")!;
    expect(within(now).getByText("Esperando você")).toBeInTheDocument();
    expect(within(now).queryByText("Esperando sua resposta")).not.toBeInTheDocument();
    expect(within(now).getByText(/Claude · MCP/)).toBeInTheDocument();
  });

  it("canais: LOCAL_SYNC vira 'Sincronização local' no Estado e em Passos", () => {
    renderSheet(flow({ state: { summary: { ...summary, channel: "LOCAL_SYNC" }, execution: { ...execution, channel: "LOCAL_SYNC" } } }));
    expect(within(document.getElementById("sheet-agora")!).getByText(/Claude · Sincronização local/)).toBeInTheDocument();
    expect(within(document.getElementById("sheet-passos")!).getByText(/· Sincronização local/)).toBeInTheDocument();
  });

  it("explica por que Aprovar está indisponível, ligado ao botão", () => {
    const review = { cycle: 1, deliveryRevision: 1, summary: "s", evidence: [], checks: [{ name: "lint", required: true, status: "failed" }], decision: "pending" };
    renderSheet(flow({ state: { stage: "IN_REVIEW", reviews: [review] } }));
    const button = screen.getByRole("button", { name: "Aprovar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby", "sheet-approve-reason");
    expect(screen.getByText(/Aprovar fica indisponível: algum check não passou ou há achado bloqueante aberto\./)).toHaveAttribute("id", "sheet-approve-reason");
  });

  it("clicar no índice leva o foco à seção", () => {
    renderSheet(flow({ state: { summary, execution } }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Seções da tarefa" })).getByRole("link", { name: "Revisão" }));
    expect(document.activeElement).toBe(document.getElementById("sheet-revisao"));
    expect(document.getElementById("sheet-revisao")).toHaveAttribute("tabindex", "-1");
  });

  it("Ver tudo deixa o foco num elemento estável do Diário, não no corpo da página", () => {
    mock.activity.items = Array.from({ length: 10 }, (_, i) => activity({ id: `a${i}`, createdAt: `2026-11-12T1${i % 10}:00:00.000Z` }));
    renderSheet(flow({ state: { summary, execution } }));
    const diary = document.getElementById("sheet-diario")!;
    const button = within(diary).getByRole("button", { name: "Ver tudo" });
    button.focus();
    fireEvent.click(button);
    expect(within(diary).queryByRole("button", { name: "Ver tudo" })).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(diary.contains(document.activeElement)).toBe(true);
  });
});
