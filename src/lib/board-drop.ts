import type { TaskStatus } from "@sistema-tasks/contracts";
import { positionForIndex } from "./position";

export interface BoardItem { id: string; status: TaskStatus; position: number }
/** Resolve insertion around the target midpoint, not always before it. */
export function boardDrop(items: BoardItem[], activeId: string, overId: string, after: boolean) {
  const active = items.find(item => item.id === activeId);
  if (!active || overId === activeId) return null;
  const status = overId.startsWith("col:") ? overId.slice(4) as TaskStatus : items.find(item => item.id === overId)?.status;
  if (!status || !["TODO", "DOING", "DONE"].includes(status)) return null;
  const destination = items.filter(item => item.status === status && item.id !== activeId).sort((a,b)=>a.position-b.position || a.id.localeCompare(b.id));
  const target = destination.findIndex(item => item.id === overId);
  const index = target < 0 ? destination.length : target + Number(after);
  const original = items.filter(item=>item.status === status).sort((a,b)=>a.position-b.position || a.id.localeCompare(b.id));
  if (active.status === status && original.findIndex(item=>item.id === activeId) === index) return null;
  return { status, index, position: positionForIndex(destination.map(item=>item.position),index), beforeId: destination[index]?.id ?? null };
}
