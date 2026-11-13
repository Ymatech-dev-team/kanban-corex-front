import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toast, toast as heroToast } from "@heroui/react";
import { toast } from "./toast";

afterEach(() => { act(() => heroToast.clear()); });
describe("Corex toast HeroUI", () => {
  it("mantém a ação Desfazer acessível e executa somente ao acioná-la", async () => {
    const undo = vi.fn();
    render(<Toast.Provider />);
    act(() => { toast("Tarefa excluída", { duration: 8000, action: { label: "Desfazer", onClick: undo } }); });
    expect(await screen.findByText("Tarefa excluída")).toBeVisible();
    expect(undo).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(undo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Tarefa excluída")).not.toBeInTheDocument());
  });
});
