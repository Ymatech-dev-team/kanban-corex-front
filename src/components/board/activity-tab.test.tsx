import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ActivityTab } from "./activity-tab";
import type { TaskActivity } from "@/lib/types";

const state: { items: TaskActivity[]; hasNextPage: boolean } = { items: [], hasNextPage: false };

vi.mock("@/lib/hooks/use-task-activity", () => ({
  activityKey: (id: string | null) => ["activity", id],
  useTaskActivity: () => ({
    data: { pages: [{ items: state.items, nextCursor: null }] },
    isLoading: false,
    isError: false,
    hasNextPage: state.hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));

function ev(partial: Partial<TaskActivity>): TaskActivity {
  return { id: Math.random().toString(36).slice(2), type: "CREATED", actorId: "u1", actorName: "Ana", payload: {}, createdAt: "2026-09-10T12:00:00.000Z", ...partial };
}

describe("ActivityTab", () => {
  it("descreve eventos em texto legível e resolve nomes de responsável", () => {
    state.items = [
      ev({ type: "STATUS_CHANGED", actorName: "Ana", payload: { from: "TODO", to: "DOING" } }),
      ev({ type: "ASSIGNEE_ADDED", actorName: "Ana", payload: { userId: "u2" } }),
      ev({ type: "CREATED", actorName: "Ana", payload: {} }),
    ];
    render(<ActivityTab taskId="t1" membersById={{ u2: "Bia Melo" }} enabled />);
    expect(screen.getByText(/moveu de/)).toBeInTheDocument();
    expect(screen.getByText(/A fazer/)).toBeInTheDocument();
    expect(screen.getByText(/Fazendo/)).toBeInTheDocument();
    expect(screen.getByText(/Bia Melo/)).toBeInTheDocument(); // nome resolvido pelo membersById
    expect(screen.getByText(/criou a tarefa/)).toBeInTheDocument();
  });

  it("estado vazio honesto", () => {
    state.items = [];
    render(<ActivityTab taskId="t1" membersById={{}} enabled />);
    expect(screen.getByText(/Sem atividade registrada/)).toBeInTheDocument();
  });

  it("responsável sem nome no mapa não quebra (fallback)", () => {
    state.items = [ev({ type: "ASSIGNEE_REMOVED", payload: { userId: "desconhecido" } })];
    render(<ActivityTab taskId="t1" membersById={{}} enabled />);
    expect(screen.getByText(/removeu/)).toBeInTheDocument();
    expect(screen.getByText(/sem acesso/)).toBeInTheDocument();
  });
});
