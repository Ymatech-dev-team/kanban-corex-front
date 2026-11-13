import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Task } from "@/lib/types";
import { useMoveTask, tasksKey } from "./use-tasks";
import { api } from "@/lib/api";
vi.mock("@/lib/api",()=>({api:{patch:vi.fn()}}));
vi.mock("@/components/ui/toast",()=>({toast:{error:vi.fn()}}));
const task={id:"a",status:"TODO",position:1,updatedAt:"2026-11-12T00:00:00Z"} as Task;
function setup(){const cache=new QueryClient({defaultOptions:{mutations:{retry:false},queries:{retry:false}}});cache.setQueryData(tasksKey("p"),[task,{...task,id:"b",title:"initial"}]);const invalidation=vi.spyOn(cache,"invalidateQueries");const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={cache}>{children}</QueryClientProvider>;return {...renderHook(()=>useMoveTask("p"),{wrapper}),cache,invalidation};}
it("sends concurrency/idempotency and reconciles canonical updatedAt plus workflow",async()=>{const fresh={...task,status:"DONE",updatedAt:"2026-11-12T00:01:00Z"};vi.mocked(api.patch).mockResolvedValueOnce({data:fresh});const {result,cache,invalidation}=setup();await act(()=>result.current.mutateAsync({id:"a",status:"DONE",position:2,updatedAt:task.updatedAt,operationId:"operation"}));expect(api.patch).toHaveBeenCalledWith("/tasks/a/move",{status:"DONE",position:2},{headers:{"idempotency-key":"operation","x-expected-updated-at":task.updatedAt}});expect(cache.getQueryData<Task[]>(tasksKey("p"))?.[0].updatedAt).toBe(fresh.updatedAt);expect(invalidation).toHaveBeenCalledWith({queryKey:["workflow","a"]});cache.clear();});
it("rolls back only moved task while preserving independent cache changes",async()=>{let reject!:(e:Error)=>void;vi.mocked(api.patch).mockImplementationOnce(()=>new Promise((_resolve,r)=>{reject=r;}));const {result,cache}=setup();let pending!:Promise<unknown>;act(()=>{pending=result.current.mutateAsync({id:"a",status:"DONE",position:2,updatedAt:task.updatedAt}).catch(()=>undefined);});await waitFor(()=>expect(cache.getQueryData<Task[]>(tasksKey("p"))?.[0].status).toBe("DONE"));cache.setQueryData<Task[]>(tasksKey("p"),old=>old?.map(t=>t.id==="b"?{...t,title:"external update"}:t));await act(async()=>{reject(new Error("network"));await pending;});expect(cache.getQueryData<Task[]>(tasksKey("p"))).toEqual([task,expect.objectContaining({id:"b",title:"external update"})]);cache.clear();});
