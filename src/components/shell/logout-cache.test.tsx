import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// [produto-telas S1] Logout must drop the React Query cache: it is per browser, not per user.
const deps = vi.hoisted(() => ({ push: vi.fn(), post: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: deps.push }) }));
vi.mock("@/lib/api", () => ({ api: { post: deps.post } }));
vi.mock("@/lib/hooks/use-me", () => ({ useMe: () => ({ data: { name: "Pessoa A", permissions: [] } }) }));
vi.mock("./use-nav-items", () => ({ useNavItems: () => ({ primary: [], admin: [] }), isNavActive: () => false }));
vi.mock("./notifications-bell", () => ({ NotificationsBell: () => null }));
vi.mock("./theme-toggle", () => ({ ThemeToggle: () => null }));

import { Sidebar } from "./sidebar";

function setup() {
  const client = new QueryClient();
  client.setQueryData(["workflow-monitoring", "team"], { pages: [{ items: [{ taskId: "secret" }] }] });
  client.setQueryData(["me"], { name: "Pessoa A" });
  render(<QueryClientProvider client={client}><Sidebar /></QueryClientProvider>);
  return client;
}

describe("Sidebar logout", () => {
  beforeEach(() => { deps.push.mockReset(); deps.post.mockReset(); });

  it("clears the query cache before going to /login", async () => {
    deps.post.mockResolvedValue({});
    const client = setup();
    fireEvent.click(screen.getByRole("button", { name: /sair/i }));
    await waitFor(() => expect(deps.push).toHaveBeenCalledWith("/login"));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it("still clears the cache when the logout request fails", async () => {
    deps.post.mockRejectedValue(new Error("network"));
    const client = setup();
    fireEvent.click(screen.getByRole("button", { name: /sair/i }));
    await waitFor(() => expect(deps.push).toHaveBeenCalledWith("/login"));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
