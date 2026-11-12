// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const d=vi.hoisted(()=>({api:vi.fn(),refresh:vi.fn(),clear:vi.fn(),set:vi.fn()}));
vi.mock("@/lib/server/api",()=>({callApi:d.api}));
vi.mock("@/lib/server/refresh",()=>({refreshSession:d.refresh}));
vi.mock("@/lib/server/session",()=>({getAccess:async()=>undefined,getRefresh:async()=>"refresh",setSession:d.set,clearSession:d.clear}));
vi.mock("@/lib/server/csrf",()=>({assertCsrf:async()=>true}));
import { GET } from "./route";
const run=()=>GET(new NextRequest("http://localhost/api/me"),{params:Promise.resolve({path:["me"]})});
beforeEach(()=>{vi.clearAllMocks();d.api.mockResolvedValue({status:401,data:{error:{code:"NAO_AUTENTICADO"}}});});
describe("BFF refresh failures",()=>{
 it.each([409,429,500,503])("preserves cookies and propagates recoverable %i",async status=>{
  d.refresh.mockResolvedValue({status,data:{error:{code:status===409?"REFRESH_EM_ANDAMENTO":"INTERNO"}}});
  const r=await run();expect(r.status).toBe(status);expect(d.clear).not.toHaveBeenCalled();
 });
 it("network interruption is 503, not expired session",async()=>{d.refresh.mockRejectedValue(new Error("network"));const r=await run();expect(r.status).toBe(503);expect(d.clear).not.toHaveBeenCalled();});
 it("invalid refresh really clears session",async()=>{d.refresh.mockResolvedValue({status:401,data:{error:{code:"NAO_AUTENTICADO"}}});const r=await run();expect(r.status).toBe(401);expect(d.clear).toHaveBeenCalledOnce();});
 it("expired access refreshes and retries with fresh bearer",async()=>{d.api.mockResolvedValueOnce({status:401,data:{}}).mockResolvedValueOnce({status:200,data:{name:"João"}});d.refresh.mockResolvedValue({status:200,data:{accessToken:"new-a",refreshToken:"new-r"}});const r=await run();expect(r.status).toBe(200);expect(d.set).toHaveBeenCalledWith("new-a","new-r");expect(d.api).toHaveBeenLastCalledWith("GET","/me",expect.objectContaining({accessToken:"new-a"}));});
});
