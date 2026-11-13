import { Chip } from "@heroui/react";
/** Perfil de um membro: chip neutro pro perfil nomeado; "Sem perfil" muted (nunca cor de alerta) + "N extra". [redesign membros] */
export function RoleChip({ roleName, extraCount = 0 }: { roleName: string | null; extraCount?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {roleName ? (
        <Chip size="sm">{roleName}</Chip>
      ) : (
        <span className="text-muted-foreground">Sem perfil</span>
      )}
      {extraCount > 0 && (
        <Chip size="sm" className="text-muted-foreground">
          +{extraCount} extra
        </Chip>
      )}
    </span>
  );
}
