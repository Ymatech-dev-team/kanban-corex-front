import type { WorkflowChannel } from "@sistema-tasks/contracts";

/** Rótulos de canal iguais aos da Agora: WEB → Painel, MCP → MCP, LOCAL_SYNC → Sincronização local. */
export const CHANNEL_LABEL: Record<WorkflowChannel, string> = { WEB: "Painel", MCP: "MCP", LOCAL_SYNC: "Sincronização local" };
