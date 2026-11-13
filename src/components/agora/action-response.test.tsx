import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowAction } from "@/lib/hooks/use-workflow";
import { ActionResponse } from "./action-response";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ toast }));

const action = (over: Partial<WorkflowAction> = {}): WorkflowAction => ({
  id: "act-1", taskId: "task-1", orgId: "org", recipientId: "me", kind: "DECIDE", state: "OPEN", version: 4,
  question: "Qual adquirente usar: Stone ou Cielo?", options: ["Stone", "Cielo"], ...over,
});
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
const view = (props: Partial<Parameters<typeof ActionResponse>[0]> = {}) =>
  render(<ActionResponse taskId="task-1" taskTitle="Integração POS" action={action()} compact {...props} />, { wrapper });
const conflict = () => Object.assign(new Error("conflict"), { response: { status: 409 } });

beforeEach(() => { api.get.mockReset(); api.post.mockReset(); toast.success.mockReset(); toast.error.mockReset(); });

describe("ActionResponse", () => {
  it("cada opção é um botão e resolve com o texto da opção e a versão atual do pedido", async () => {
    api.post.mockResolvedValue({ data: { state: { version: 5 } } });
    const onResolved = vi.fn();
    view({ onResolved });
    await userEvent.click(screen.getByRole("button", { name: "Stone" }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("Stone"));
    expect(api.post).toHaveBeenCalledTimes(1);
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe("/tasks/task-1/workflow/actions/act-1/resolve");
    expect(body).toMatchObject({ expectedVersion: 4, response: "Stone", resolution: "RESOLVED" });
    expect(typeof body.operationId).toBe("string");
    expect(body.operationId.length).toBeGreaterThan(8);
    expect(screen.getByRole("status")).toHaveTextContent("Resposta registrada: Stone");
    expect(screen.getByRole("status")).toHaveTextContent("o agente vê ao retomar");
    expect(screen.getByRole("button", { name: "Copiar pedido de retomada" })).toBeInTheDocument();
  });

  it("depois de responder, o foco vai para o recibo (o botão clicado some)", async () => {
    api.post.mockResolvedValue({ data: { state: { version: 5 } } });
    view();
    await userEvent.click(screen.getByRole("button", { name: "Stone" }));
    const receipt = await screen.findByRole("status");
    expect(receipt).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(receipt).toHaveFocus());
  });

  it("duplo clique envia uma vez e deixa os botões ocupados durante o envio", async () => {
    let finish!: (value: unknown) => void;
    api.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    view();
    await userEvent.dblClick(screen.getByRole("button", { name: "Stone" }));
    expect(api.post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cielo" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Stone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Responder com texto" })).toBeDisabled();
    finish({ data: { state: { version: 5 } } });
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("409 com o pedido ainda aberto recarrega o fluxo e avisa que a tarefa mudou, sem reenviar", async () => {
    api.post.mockRejectedValue(conflict());
    api.get.mockResolvedValue({ data: { state: null, events: [], actions: [action({ version: 5 })], capabilities: {} } });
    view();
    await userEvent.click(screen.getByRole("button", { name: "Cielo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A tarefa mudou. Confira antes de responder.");
    expect(api.get).toHaveBeenCalledWith("/tasks/task-1/workflow");
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cielo" })).toBeEnabled();
  });

  it("409 com o pedido já encerrado mostra Já respondido", async () => {
    api.post.mockRejectedValue(conflict());
    api.get.mockResolvedValue({ data: { state: null, events: [], actions: [], capabilities: {} } });
    view();
    await userEvent.click(screen.getByRole("button", { name: "Stone" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Já respondido");
  });

  it("Responder com texto exige texto (1 a 2000) e envia o texto aparado", async () => {
    api.post.mockResolvedValue({ data: { state: { version: 5 } } });
    view();
    await userEvent.click(screen.getByRole("button", { name: "Responder com texto" }));
    const field = screen.getByRole("textbox", { name: "Sua resposta" });
    expect(field).toHaveAttribute("maxlength", "2000");
    expect(screen.getByRole("button", { name: "Enviar resposta" })).toBeDisabled();
    await userEvent.type(field, "   ");
    expect(screen.getByRole("button", { name: "Enviar resposta" })).toBeDisabled();
    await userEvent.type(field, " Usar a Stone <b>por ora</b> ");
    await userEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1]).toMatchObject({ response: "Usar a Stone <b>por ora</b>", expectedVersion: 4 });
  });

  it("mostra a resposta como texto, nunca como HTML", async () => {
    api.post.mockResolvedValue({ data: { state: { version: 5 } } });
    const { container } = view({ action: action({ options: ["<img src=x onerror=alert(1)>"] }) });
    await userEvent.click(screen.getByRole("button", { name: "<img src=x onerror=alert(1)>" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("<img src=x onerror=alert(1)>"));
    expect(container.querySelector("img")).toBeNull();
  });

  it("erro de rede mantém o texto digitado e permite tentar de novo", async () => {
    api.post.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ data: { state: { version: 5 } } });
    view();
    await userEvent.click(screen.getByRole("button", { name: "Responder com texto" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Sua resposta" }), "Stone");
    await userEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Seu texto foi preservado");
    expect(screen.getByRole("textbox", { name: "Sua resposta" })).toHaveValue("Stone");
    await userEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Resposta registrada: Stone"));
    // erro desconhecido reenvia o mesmo envelope: mesma operationId, idempotente no servidor
    expect(api.post.mock.calls[1][1].operationId).toBe(api.post.mock.calls[0][1].operationId);
  });
});
