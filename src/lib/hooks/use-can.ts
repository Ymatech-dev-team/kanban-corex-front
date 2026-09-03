import { useMe } from "./use-me";

/** Pura e testável: o conjunto de permissões contém a permissão pedida? */
export function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return !!permissions?.includes(permission);
}

/** Hook: o usuário logado pode fazer `permission`? */
export function useCan(permission: string): boolean {
  const { data } = useMe();
  return hasPermission(data?.permissions, permission);
}
