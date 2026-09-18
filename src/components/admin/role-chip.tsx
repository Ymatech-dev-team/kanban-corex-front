/** Perfil de um membro: chip neutro pro perfil nomeado; "Sem perfil" muted (nunca cor de alerta) + "N extra". [redesign membros] */
export function RoleChip({ roleName, extraCount = 0 }: { roleName: string | null; extraCount?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {roleName ? (
        <span className="rounded-md border border-border px-2 py-0.5 text-[11.5px] text-foreground/85">{roleName}</span>
      ) : (
        <span className="text-muted-foreground">Sem perfil</span>
      )}
      {extraCount > 0 && (
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
          +{extraCount} extra
        </span>
      )}
    </span>
  );
}
