import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button (design system)", () => {
  it("renderiza como <button> acessível", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("a variante primária usa o token primary + foreground near-black (invariante do amarelo)", () => {
    const cls = buttonVariants({ variant: "default" });
    expect(cls).toContain("bg-primary");
    expect(cls).toContain("text-primary-foreground");
  });

  it("asChild compõe o elemento filho (Slot)", () => {
    render(
      <Button asChild>
        <a href="/x">Ir</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Ir" })).toBeInTheDocument();
  });
});
