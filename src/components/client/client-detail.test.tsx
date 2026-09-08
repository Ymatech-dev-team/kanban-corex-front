import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientDetail } from "./client-detail";
import { BoardNavProvider } from "@/lib/board-nav";
import { useProject } from "@/lib/hooks/use-projects";

vi.mock("@/lib/hooks/use-projects", () => ({ useProject: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const mockProject = vi.mocked(useProject);

function errState(status: number) {
  return {
    isLoading: false,
    isError: true,
    error: { response: { status } },
    data: undefined,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useProject>;
}

function renderWith(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <BoardNavProvider>
        <ClientDetail projectId="p1" />
      </BoardNavProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => mockProject.mockReset());

describe("ClientDetail — acesso/erro", () => {
  it("404 → 'cliente não encontrado' e purga o cache DAQUELE cliente (RF-55)", () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "removeQueries");
    mockProject.mockReturnValue(errState(404));

    renderWith(qc);

    expect(screen.getByText("Cliente não encontrado")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["tasks", "p1"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["members", "p1"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["project-cost", "p1"] });
    // não remove a própria chave do projeto (evita loop de refetch)
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ["project", "p1"] });
  });

  it("403 → também trata como não encontrado (não confirma existência)", () => {
    const qc = new QueryClient();
    mockProject.mockReturnValue(errState(403));
    renderWith(qc);
    expect(screen.getByText("Cliente não encontrado")).toBeInTheDocument();
  });

  it("erro de servidor (500) → estado de erro com retry, sem purgar cache", () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "removeQueries");
    mockProject.mockReturnValue(errState(500));

    renderWith(qc);

    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
