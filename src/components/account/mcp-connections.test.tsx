import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpConnections } from "./mcp-connections";
const api = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api", () => ({ api }));
const connection = { id: "connection", clientId: "Claude", scopes: ["tasks:read"], expiresAt: 4102444800, revokedAt: null };
function view() { const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={cache}><McpConnections /></QueryClientProvider>); }
beforeEach(() => { api.get.mockReset().mockResolvedValue({ data: { connections: [connection] } }); api.delete.mockReset(); });
describe("MCP connection management", () => {
  it("requires confirmation, preserves failure, and retries revocation", async () => {
    api.delete.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ data: { revoked: true } });
    view(); fireEvent.click(await screen.findByRole("button", { name: /^Revogar$/ }));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Revogar conexão" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revogar conexão" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.delete).toHaveBeenCalledTimes(2);
    expect(api.delete).toHaveBeenLastCalledWith("/mcp/connections/connection");
  });
  it("hides feature-off response without an empty success message", async () => {
    api.get.mockRejectedValue({ response: { status: 404 } }); view();
    await waitFor(() => expect(screen.queryByRole("status", { name: "Carregando conexões" })).not.toBeInTheDocument());
    expect(screen.queryByText("Conexões Claude")).not.toBeInTheDocument();
  });
  it("shows retry on permission error without exposing connection data", async () => {
    api.get.mockRejectedValue({ response: { status: 403 } }); view();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revogar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
