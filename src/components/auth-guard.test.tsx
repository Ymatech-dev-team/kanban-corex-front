import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
const deps=vi.hoisted(()=>({replace:vi.fn(),refetch:vi.fn(),query:{} as Record<string,unknown>}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:deps.replace})}));
vi.mock("@/lib/hooks/use-me",()=>({useMe:()=>({...deps.query,refetch:deps.refetch})}));
import { AuthGuard } from "./auth-guard";
beforeEach(()=>{vi.clearAllMocks();deps.query={isLoading:false,isError:true,error:{response:{status:503}}};});
describe("session interruption",()=>{
 it("temporary outage shows recovery instead of login redirect",()=>{render(<AuthGuard>secret</AuthGuard>);expect(deps.replace).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Tentar novamente"}));expect(deps.refetch).toHaveBeenCalledOnce();expect(screen.queryByText("secret")).not.toBeInTheDocument();});
 it("cached identity is not shown after permission denial",()=>{deps.query.data={name:"João",mustChangePassword:false};deps.query.error={response:{status:403}};render(<AuthGuard>secret</AuthGuard>);expect(screen.queryByText("secret")).not.toBeInTheDocument();expect(deps.replace).not.toHaveBeenCalled();});
 it("actual unauthorized redirects",()=>{deps.query.error={response:{status:401}};render(<AuthGuard>secret</AuthGuard>);expect(deps.replace).toHaveBeenCalledWith("/login");});
 it("does not discard current page on background transient failure",()=>{deps.query.data={name:"João",mustChangePassword:false};render(<AuthGuard>current page</AuthGuard>);expect(screen.getByText("current page")).toBeInTheDocument();expect(deps.replace).not.toHaveBeenCalled();});
});
