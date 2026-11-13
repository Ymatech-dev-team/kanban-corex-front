import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle com instâncias desktop e mobile", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.dataset.theme = "light";
  });
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("dark", "light");
    delete document.documentElement.dataset.theme;
    document.cookie = "sdt-theme=; path=/; max-age=0";
  });

  it("sincroniza rótulos e alterna de volta pela outra instância", async () => {
    render(<><ThemeToggle /><ThemeToggle /></>);
    const user = userEvent.setup();
    const [desktop, mobile] = screen.getAllByRole("button", { name: "Ativar modo escuro" });
    await user.click(mobile);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Ativar modo claro" })).toHaveLength(2));
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("light");
    expect(document.documentElement.dataset.theme).toBe("dark");

    await user.click(desktop);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Ativar modo escuro" })).toHaveLength(2));
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.cookie).toContain("sdt-theme=light");
  });
});
