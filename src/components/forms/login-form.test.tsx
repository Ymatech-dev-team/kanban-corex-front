import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("renderiza os campos e o botão", () => {
    render(<LoginForm onSubmit={() => {}} />);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("valida email inválido e NÃO chama onSubmit", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "invalido");
    await userEvent.type(screen.getByLabelText("Senha"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submete com dados válidos", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "joao@x.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: "joao@x.com", password: "senha123" }));
  });

  it("mostra o erro (ex.: 429)", () => {
    render(<LoginForm onSubmit={() => {}} error="Muitas tentativas. Aguarde e tente de novo." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas");
  });
  it("alterna a visibilidade sem submeter o formulário", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    const password = screen.getByLabelText("Senha");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password).toHaveAttribute("type", "password");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("bloqueia edição e novo envio enquanto autentica", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} pending />);
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Entrando…" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

});
