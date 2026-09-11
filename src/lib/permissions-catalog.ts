import { PERMISSIONS, META_PERMISSIONS } from "@sistema-tasks/contracts";

export interface PermItem {
  perm: string;
  label: string;
  hint?: string;
  meta: boolean;
}
export interface PermGroup {
  title: string;
  items: PermItem[];
}

const isMeta = (p: string) => (META_PERMISSIONS as string[]).includes(p);

/** Catálogo em pt-BR agrupado por área, para os checkboxes do editor de perfil. */
export const PERMISSION_GROUPS: PermGroup[] = [
  {
    title: "Clientes",
    items: [
      { perm: PERMISSIONS.projetos_criar, label: "Criar clientes", meta: false },
      { perm: PERMISSIONS.projetos_editar, label: "Editar clientes", meta: false },
      { perm: PERMISSIONS.projetos_excluir, label: "Excluir clientes", meta: false },
      {
        perm: PERMISSIONS.projetos_acessar_todos,
        label: "Acessar todos os clientes",
        hint: "Vê qualquer cliente sem precisar de acesso concedido",
        meta: true,
      },
    ],
  },
  {
    title: "Tarefas",
    items: [
      { perm: PERMISSIONS.tarefas_criar, label: "Criar tarefas", meta: false },
      { perm: PERMISSIONS.tarefas_editar, label: "Editar tarefas", meta: false },
      { perm: PERMISSIONS.tarefas_mover, label: "Mover tarefas no Kanban", meta: false },
      { perm: PERMISSIONS.tarefas_excluir, label: "Excluir tarefas", meta: false },
      { perm: PERMISSIONS.subtarefas_gerenciar, label: "Gerenciar subtarefas", meta: false },
      {
        perm: PERMISSIONS.tarefas_ver_globais,
        label: "Ver todas as tarefas (aba Tarefas)",
        hint: "Abre a aba Tarefas com todas as tarefas dos clientes que a pessoa acessa (Kanban/Lista/Calendário)",
        meta: false,
      },
    ],
  },
  {
    title: "Projetos",
    items: [
      { perm: PERMISSIONS.engagements_criar, label: "Criar projetos", meta: false },
      { perm: PERMISSIONS.engagements_editar, label: "Editar projetos", meta: false },
      { perm: PERMISSIONS.engagements_excluir, label: "Excluir projetos", meta: false },
      {
        perm: PERMISSIONS.engagements_consultores,
        label: "Gerenciar consultores",
        hint: "Adiciona/remove consultores dos projetos (dentre quem já acessa o cliente)",
        meta: false,
      },
    ],
  },
  {
    title: "Custos",
    items: [
      {
        perm: PERMISSIONS.custos_ver,
        label: "Ver custos",
        hint: "Vê o custo de alocação (derivado da remuneração) nos clientes com acesso",
        meta: false,
      },
    ],
  },
  {
    title: "Administração",
    items: [
      { perm: PERMISSIONS.membros_ver, label: "Ver membros", meta: false },
      { perm: PERMISSIONS.membros_gerenciar, label: "Gerenciar membros", meta: false },
      { perm: PERMISSIONS.perfis_ver, label: "Ver perfis", meta: false },
      { perm: PERMISSIONS.perfis_gerenciar, label: "Gerenciar perfis", meta: false },
      {
        perm: PERMISSIONS.permissoes_conceder,
        label: "Conceder acesso a clientes",
        hint: "Pode dar/tirar o acesso de outras pessoas aos clientes",
        meta: true,
      },
    ],
  },
];

export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.perm, i.label])),
);

export { isMeta };
