import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjetosSection } from "./projetos-section";
import { useEngagements } from "@/lib/hooks/use-engagements";
import { useCan } from "@/lib/hooks/use-can";
import type { Engagement } from "@/lib/types";

vi.mock("@/lib/hooks/use-engagements", () => ({
  useEngagements: vi.fn(),
  useCreateEngagement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateEngagement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteEngagement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConsultores: () => ({ data: [], isLoading: false }),
  useAddConsultor: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveConsultor: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/hooks/use-can", () => ({ useCan: vi.fn() }));
vi.mock("@/lib/hooks/use-members", () => ({ useProjectMembers: () => ({ data: [], isLoading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const mockList = vi.mocked(useEngagements);
const mockCan = vi.mocked(useCan);

function eng(p: Partial<Engagement>): Engagement {
  return { id: "e1", projectId: "p1", name: "Projeto", description: null, taskCount: 0, consultorCount: 0, isGeneral: false, ...p };
}
function state(data: Engagement[] | undefined, extra = {}) {
  return { isLoading: false, isError: false, data, refetch: vi.fn(), ...extra } as unknown as ReturnType<
    typeof useEngagements
  >;
}

beforeEach(() => {
  mockList.mockReset();
  mockCan.mockReset().mockReturnValue(true);
});

describe("ProjetosSection", () => {
  it("lista projetos com contagem de tarefas e consultores", () => {
    mockList.mockReturnValue(state([
      eng({ id: `gen-p1`, name: "Projeto geral", taskCount: 6, consultorCount: 2, isGeneral: true }),
      eng({ id: "e2", name: "Rebranding", taskCount: 12, consultorCount: 3 }),
    ]));
    render(<ProjetosSection projectId="p1" />);
    expect(screen.getByText("Rebranding")).toBeInTheDocument();
    expect(screen.getByText("12 tarefas")).toBeInTheDocument();
    expect(screen.getByText("3 consultores")).toBeInTheDocument();
  });

  it("Projeto geral não tem botão de excluir (só o aviso desabilitado)", () => {
    mockList.mockReturnValue(state([eng({ id: "gen-p1", name: "Projeto geral", isGeneral: true })]));
    render(<ProjetosSection projectId="p1" />);
    expect(screen.queryByLabelText(/^Excluir projeto/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/não pode ser excluído/i)).toBeInTheDocument();
  });

  it("projeto normal tem botão de excluir", () => {
    mockList.mockReturnValue(state([eng({ id: "e2", name: "Rebranding" })]));
    render(<ProjetosSection projectId="p1" />);
    expect(screen.getByLabelText("Excluir projeto Rebranding")).toBeInTheDocument();
  });

  it("sem permissão de criar → sem botão 'Novo projeto'", () => {
    mockCan.mockReturnValue(false);
    mockList.mockReturnValue(state([eng({ id: "e2", name: "Rebranding" })]));
    render(<ProjetosSection projectId="p1" />);
    expect(screen.queryByText("Novo projeto")).not.toBeInTheDocument();
  });
});
