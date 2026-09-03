import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("renderiza os campos e o botão", () => {
    render(<LoginForm onSubmit={() => {}} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("valida email inválido e NÃO chama onSubmit", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Email"), "invalido");
    await userEvent.type(screen.getByLabelText("Senha"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submete com dados válidos", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Email"), "joao@x.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: "joao@x.com", password: "senha123" }));
  });

  it("mostra o erro (ex.: 429)", () => {
    render(<LoginForm onSubmit={() => {}} error="Muitas tentativas. Aguarde e tente de novo." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas");
  });
});
