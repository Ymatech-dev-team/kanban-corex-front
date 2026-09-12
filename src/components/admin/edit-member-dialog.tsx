"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, KeyRound, Trash2, Check } from "lucide-react";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { META_PERMISSIONS, type CompensationType } from "@sistema-tasks/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateMember, useSetCompensation, type AdminMember, type AdminRole } from "@/lib/hooks/use-admin";
import { initials } from "@/lib/initials";
import { parseReaisToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

type TabKey = "dados" | "acesso" | "remuneracao";

interface Props {
  member: AdminMember | null;
  roles: AdminRole[];
  /** o próprio usuário logado — não pode alterar o próprio perfil nem se remover */
  isSelf: boolean;
  /** quem gerencia vê/edita remuneração (a entrada do modal já é gated por isso) */
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  /** fecha o modal e delega o fluxo próprio (senha de uso único não empilha sobre o modal) */
  onResetPassword: (m: AdminMember) => void;
  onDelete: (m: AdminMember) => void;
}

const COMP_TYPES: { value: CompensationType; label: string; suffix: string }[] = [
  { value: "MONTHLY", label: "Salário mensal", suffix: "por mês" },
  { value: "HOURLY", label: "Valor por hora", suffix: "por hora" },
];

function centsToAmount(cents: number | null): string {
  return cents != null ? String(cents / 100).replace(".", ",") : "";
}

export function EditMemberDialog({
  member,
  roles,
  isSelf,
  canManage,
  onOpenChange,
  onResetPassword,
  onDelete,
}: Props) {
  const update = useUpdateMember();
  const setComp = useSetCompensation();

  const [tab, setTab] = useState<TabKey>("dados");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [confirmMeta, setConfirmMeta] = useState(false);
  const [compType, setCompType] = useState<CompensationType>("MONTHLY");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<Partial<Record<TabKey, string>>>({});
  const [pendingClose, setPendingClose] = useState(false);

  // baseline do "já salvo" — o que está sujo é comparado contra ISTO, e cada etapa
  // salva com sucesso rebaseia aqui. Assim uma falha parcial não reenvia o que já
  // passou nem faz o Cancelar avisar sobre algo já persistido. [rev-fase4]
  const [baseName, setBaseName] = useState("");
  const [baseRoleId, setBaseRoleId] = useState<string | null>(null);
  const [baseType, setBaseType] = useState<CompensationType>("MONTHLY");
  const [baseCents, setBaseCents] = useState<number | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const roleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const closePrompted = useRef(false);

  // (re)inicializa o formulário quando abre um membro — o estado mora aqui na raiz,
  // não em cada aba, senão trocar de aba apagaria o que foi digitado.
  useEffect(() => {
    if (!member) return;
    setTab("dados");
    setName(member.name);
    setRoleId(member.roleId);
    setConfirmMeta(false);
    setCompType(member.compensationType ?? "MONTHLY");
    setAmount(centsToAmount(member.compensationCents));
    setBaseName(member.name);
    setBaseRoleId(member.roleId);
    setBaseType(member.compensationType ?? "MONTHLY");
    setBaseCents(member.compensationCents);
    setErrors({});
    setPendingClose(false);
    closePrompted.current = false;
  }, [member]);

  // Ao abrir/fechar o rodapé "descartar", leva o foco pro botão certo (teclado). [rev-fase4]
  useEffect(() => {
    if (pendingClose) {
      closePrompted.current = true;
      requestAnimationFrame(() => discardRef.current?.focus());
    } else if (closePrompted.current) {
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [pendingClose]);

  // meta-permissão que o novo perfil concede além do que a pessoa já tem
  const currentMeta = useMemo(() => {
    if (!member) return new Set<string>();
    const currentRole = roles.find((r) => r.id === member.roleId);
    const eff = new Set([...(currentRole?.permissions ?? []), ...member.extraPermissions]);
    return new Set(META_PERMISSIONS.filter((m) => eff.has(m)));
  }, [member, roles]);
  const newRole = roles.find((r) => r.id === roleId) ?? null;
  const addsMeta = useMemo(() => {
    const perms = new Set(newRole?.permissions ?? []);
    return META_PERMISSIONS.some((m) => perms.has(m) && !currentMeta.has(m));
  }, [newRole, currentMeta]);

  if (!member) return null;

  // há valor salvo para "Limpar" (usa o baseline, não o snapshot original)
  const hasComp = baseCents != null;
  // dirty da remuneração comparado em CENTAVOS — "40,5" e "40,50" não contam como mudança. [rev-fase4]
  const curCents = parseReaisToCents(amount);

  const nameDirty = name.trim() !== baseName;
  const accessDirty = !isSelf && roleId !== baseRoleId;
  const compDirty = canManage && (curCents !== baseCents || (curCents !== null && compType !== baseType));
  const anyDirty = nameDirty || accessDirty || compDirty;
  const saving = update.isPending || setComp.isPending;

  // opções de perfil (radiogroup) — "Sem perfil" primeiro
  const roleOptions: { id: string | null; name: string; hint: string }[] = [
    { id: null, name: "Sem perfil", hint: "acesso mínimo" },
    ...roles.map((r) => ({ id: r.id, name: r.name, hint: `${r.permissions.length} permissões` })),
  ];
  const selectedIdx = roleOptions.findIndex((o) => o.id === roleId);

  function onRoleKeyDown(e: React.KeyboardEvent) {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const next = (selectedIdx + dir + roleOptions.length) % roleOptions.length;
    setRoleId(roleOptions[next].id);
    roleRefs.current[next]?.focus();
  }

  function requestClose() {
    if (anyDirty) {
      setPendingClose(true);
      return;
    }
    onOpenChange(false);
  }

  async function save() {
    if (!member) return;
    const m = member;
    setErrors({});

    // validações — ativa a aba do primeiro problema e foca o campo
    if (nameDirty && name.trim() === "") {
      setTab("dados");
      setErrors({ dados: "Informe o nome." });
      requestAnimationFrame(() => nameRef.current?.focus());
      return;
    }
    if (accessDirty && addsMeta && !confirmMeta) {
      setTab("acesso");
      setErrors({ acesso: "Confirme a concessão de permissões de administração." });
      return;
    }
    let compCents: number | null = null;
    if (compDirty && amount.trim() !== "") {
      const cents = parseReaisToCents(amount);
      if (cents == null) {
        setTab("remuneracao");
        setErrors({ remuneracao: "Informe um valor válido (ex.: 2500 ou 40,50)." });
        requestAnimationFrame(() => amountRef.current?.focus());
        return;
      }
      compCents = cents;
    }

    // 1) membro (nome + perfil) — PATCH único e atômico
    if (nameDirty || accessDirty) {
      try {
        await update.mutateAsync({
          id: m.id,
          patch: {
            ...(nameDirty ? { name: name.trim() } : {}),
            ...(accessDirty ? { roleId } : {}),
            ...(accessDirty && addsMeta ? { confirmMetaPermission: true } : {}),
          },
        });
        if (nameDirty) setBaseName(name.trim());
        if (accessDirty) setBaseRoleId(roleId);
      } catch (e) {
        const where: TabKey = nameDirty ? "dados" : "acesso";
        setTab(where);
        setErrors({ [where]: apiMessage(e, "Não foi possível salvar.") });
        return; // falha parcial: o que passou já foi rebaseado; mantém o modal aberto
      }
    }

    // 2) remuneração — endpoint separado; roda depois pra falha parcial não perder o resto
    if (compDirty) {
      try {
        await setComp.mutateAsync({
          id: m.id,
          input:
            amount.trim() === "" ? { type: null, amountCents: null } : { type: compType, amountCents: compCents! },
        });
        setBaseType(compType);
        setBaseCents(compCents);
      } catch (e) {
        setTab("remuneracao");
        setErrors({ remuneracao: apiMessage(e, "Não foi possível salvar a remuneração.") });
        return;
      }
    }

    toast.success("Alterações salvas");
    onOpenChange(false);
  }

  const compSuffix = COMP_TYPES.find((t) => t.value === compType)!.suffix;

  return (
    <Dialog open onOpenChange={(o) => !o && requestClose()}>
      <DialogContent className="max-w-lg">
        <div className="flex items-center gap-3 pr-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-[13px] font-medium text-foreground">
            {initials(member.name)}
          </span>
          <DialogHeader className="gap-0.5">
            <DialogTitle>Editar membro</DialogTitle>
            <DialogDescription>
              {member.name} · {member.email}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="acesso" disabled={isSelf} title={isSelf ? "Você não pode alterar o próprio perfil" : undefined}>
              Acesso e permissões
            </TabsTrigger>
            {canManage && <TabsTrigger value="remuneracao">Remuneração</TabsTrigger>}
          </TabsList>

          <div className="min-h-[298px] pt-4">
            {/* ------- DADOS ------- */}
            <TabsContent value="dados" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="em-name">Nome</Label>
                <Input
                  id="em-name"
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  aria-invalid={!!errors.dados}
                  aria-describedby={errors.dados ? "em-name-err" : undefined}
                />
                {errors.dados && (
                  <p id="em-name-err" role="alert" className="text-[12.5px] text-destructive">
                    {errors.dados}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="em-email">Email</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="em-email"
                    value={member.email}
                    readOnly
                    aria-readonly="true"
                    aria-describedby="em-email-note"
                    className="pl-9 text-muted-foreground"
                  />
                </div>
                <p id="em-email-note" className="text-[11.5px] text-muted-foreground">
                  O email não pode ser alterado.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border pt-3.5">
                <div className="leading-tight">
                  <div className="text-[13px]">Senha</div>
                  <div className="text-[12px] text-muted-foreground">
                    {member.mustChangePassword ? "Senha temporária ativa" : "Definida pela pessoa"}
                  </div>
                </div>
                <Button type="button" variant="secondary" disabled={anyDirty} onClick={() => onResetPassword(member)}>
                  <KeyRound className="size-4" />
                  Redefinir senha
                </Button>
              </div>

              {!isSelf && (
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3.5">
                  <div className="leading-tight">
                    <div className="text-[13px]">Remover membro</div>
                    <div className="text-[12px] text-muted-foreground">Perde o acesso e deixa de ser responsável.</div>
                  </div>
                  <Button type="button" variant="secondary" disabled={anyDirty} onClick={() => onDelete(member)}>
                    <Trash2 className="size-4" />
                    Remover
                  </Button>
                </div>
              )}

              {anyDirty && (
                <p className="text-[11.5px] text-muted-foreground">
                  Salve ou descarte as alterações para redefinir a senha ou remover o membro.
                </p>
              )}
            </TabsContent>

            {/* ------- ACESSO E PERMISSÕES ------- */}
            <TabsContent value="acesso" className="flex flex-col gap-3">
              {isSelf ? (
                <p className="text-[13px] text-muted-foreground">Você não pode alterar o próprio perfil.</p>
              ) : (
                <>
                  <p className="text-[12.5px] text-muted-foreground">O perfil define o que a pessoa pode fazer no sistema.</p>
                  <div role="radiogroup" aria-label="Perfil" onKeyDown={onRoleKeyDown} className="flex flex-col gap-1.5">
                    {roleOptions.map((opt, i) => {
                      const selected = roleId === opt.id;
                      return (
                        <button
                          key={opt.id ?? "none"}
                          ref={(el) => {
                            roleRefs.current[i] = el;
                          }}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          tabIndex={selected || (selectedIdx === -1 && i === 0) ? 0 : -1}
                          onClick={() => setRoleId(opt.id)}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-muted-foreground/40 bg-accent"
                              : "border-border hover:border-muted-foreground/30",
                          )}
                        >
                          <span>
                            <span className="font-medium">{opt.name}</span>
                            <span className="ml-2 text-muted-foreground">{opt.hint}</span>
                          </span>
                          {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>

                  {addsMeta && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber/40 bg-amber/5 px-3 py-2.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={confirmMeta}
                        aria-label="Confirmo conceder permissões de administração"
                        aria-describedby="em-meta-desc"
                        onClick={() => setConfirmMeta((v) => !v)}
                        className={cn(
                          "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          confirmMeta
                            ? "border-amber bg-amber text-primary-foreground"
                            : "border-muted-foreground/50 text-transparent",
                        )}
                      >
                        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                      </button>
                      <span id="em-meta-desc" className="text-[12.5px] text-muted-foreground">
                        Este perfil concede <span className="text-foreground">permissões de administração</span>.
                        Confirmo que quero dar esse nível de acesso a {member.name}.
                      </span>
                    </div>
                  )}

                  {errors.acesso && (
                    <p role="alert" className="text-[12.5px] text-destructive">
                      {errors.acesso}
                    </p>
                  )}
                </>
              )}
            </TabsContent>

            {/* ------- REMUNERAÇÃO ------- */}
            {canManage && (
              <TabsContent value="remuneracao" className="flex flex-col gap-4">
                <p className="text-[12.5px] text-muted-foreground">
                  Usado para calcular o custo de alocar a pessoa nos projetos. Só quem gerencia membros vê este valor.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label>Tipo</Label>
                  <div role="group" aria-label="Tipo de remuneração" className="flex gap-0.5 rounded-lg border border-border bg-card p-[3px]">
                    {COMP_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={compType === t.value}
                        onClick={() => setCompType(t.value)}
                        className={cn(
                          "flex-1 rounded-md px-3 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          compType === t.value ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="em-amount">Valor</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="em-amount"
                      ref={amountRef}
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={compType === "MONTHLY" ? "2500,00" : "40,00"}
                      className="pl-9"
                      aria-invalid={!!errors.remuneracao}
                      aria-describedby={errors.remuneracao ? "em-amount-err" : "em-amount-note"}
                    />
                  </div>
                  {errors.remuneracao ? (
                    <p id="em-amount-err" role="alert" className="text-[12.5px] text-destructive">
                      {errors.remuneracao}
                    </p>
                  ) : (
                    <p id="em-amount-note" className="text-[11.5px] text-muted-foreground">
                      {amount.trim() === "" ? "Deixe em branco para não definir remuneração." : compSuffix}
                    </p>
                  )}
                </div>
                {hasComp && (
                  <button
                    type="button"
                    onClick={() => setAmount("")}
                    className="self-start rounded text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Limpar valor
                  </button>
                )}
              </TabsContent>
            )}
          </div>
        </Tabs>

        {pendingClose ? (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3.5">
            <span className="text-[12.5px] text-muted-foreground">Você tem alterações não salvas.</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setPendingClose(false)}>
                Continuar editando
              </Button>
              <Button
                ref={discardRef}
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-amber text-primary-foreground hover:bg-amber/90"
              >
                Descartar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 border-t border-border pt-3.5">
            <Button ref={cancelRef} type="button" variant="secondary" onClick={requestClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={save} disabled={!anyDirty || saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
