/**
 * Situação do membro — fonte única (antes: texto puro na tabela, dot no card). Só a EXCEÇÃO ganha
 * acento: "Senha temporária" = dot menta; "Ativo" = neutro. Um status colorido só. [redesign membros]
 */
export function MemberStatus({ mustChangePassword }: { mustChangePassword: boolean }) {
  if (mustChangePassword) {
    return (
      <span className="inline-flex items-center gap-1.5 text-primary">
        <span aria-hidden className="size-1.5 rounded-full bg-primary" />
        Senha temporária
      </span>
    );
  }
  return <span className="text-muted-foreground">Ativo</span>;
}
