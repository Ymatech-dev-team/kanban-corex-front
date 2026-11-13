import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ActivityTab, CommentComposer } from "./activity-tab";
import type { TaskActivity } from "@/lib/types";

const state: { items: TaskActivity[]; hasNextPage: boolean } = { items: [], hasNextPage: false };
const addMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hooks/use-task-activity", () => {
  const mut = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false });
  return {
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
    idemKey: () => "k1",
    useAddComment: () => ({ mutate: vi.fn(), mutateAsync: addMock, isPending: false }),
    useEditComment: mut,
    useDeleteComment: mut,
  };
});

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
    expect(screen.getByText(/Sem atividade ainda/)).toBeInTheDocument();
  });

  it("responsável sem nome no mapa não quebra (fallback)", () => {
    state.items = [ev({ type: "ASSIGNEE_REMOVED", payload: { userId: "desconhecido" } })];
    render(<ActivityTab taskId="t1" membersById={{}} enabled />);
    expect(screen.getByText(/removeu/)).toBeInTheDocument();
    expect(screen.getByText(/sem acesso/)).toBeInTheDocument();
  });

  it("comentário mostra corpo, marca 'editado' e sempre há composer", () => {
    state.items = [ev({ type: "COMMENT", actorName: "Bia", body: "olá mundo", editedAt: "2026-09-10T13:00:00.000Z", canManage: false })];
    render(<ActivityTab taskId="t1" membersById={{}} enabled />);
    expect(screen.getByText("olá mundo")).toBeInTheDocument();
    expect(screen.getByText(/editado/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Escrever um comentário/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Editar comentário")).not.toBeInTheDocument(); // canManage false
  });

  it("comentário removido vira tombstone; canManage mostra controles", () => {
    state.items = [
      ev({ type: "COMMENT", actorName: "X", body: null }),
      ev({ type: "COMMENT", actorName: "Eu", body: "meu", canManage: true }),
    ];
    render(<ActivityTab taskId="t1" membersById={{}} enabled />);
    expect(screen.getByText(/comentário removido/)).toBeInTheDocument();
    expect(screen.getByLabelText("Editar comentário")).toBeInTheDocument();
    expect(screen.getByLabelText("Remover comentário")).toBeInTheDocument();
  });
});

describe("CommentComposer (formulário extraído, usado também no Diário da folha)", () => {
  it("mantém o rascunho e reenvia com a MESMA chave de idempotência depois de falha", async () => {
    localStorage.clear();
    addMock.mockReset();
    addMock.mockRejectedValueOnce(new Error("rede")).mockResolvedValue({});
    render(<CommentComposer taskId="t9" />);
    const box = screen.getByLabelText("Novo comentário");
    fireEvent.change(box, { target: { value: "Primeiro texto" } });
    await waitFor(() => expect(localStorage.getItem("sdt_cdraft_t9")).toBe("Primeiro texto"));
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }));
    expect(await screen.findByText(/Não enviado/)).toBeInTheDocument();
    expect(box).toHaveValue("Primeiro texto");
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));
    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(2));
    expect(addMock.mock.calls[0][0]).toEqual({ body: "Primeiro texto", key: "k1" });
    expect(addMock.mock.calls[1][0]).toEqual({ body: "Primeiro texto", key: "k1" });
    await waitFor(() => expect(box).toHaveValue(""));
    expect(localStorage.getItem("sdt_cdraft_t9")).toBeNull();
  });
});
