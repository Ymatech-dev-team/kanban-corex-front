"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, UserRound, ShieldCheck, AlertTriangle } from "lucide-react";
import { PERMISSIONS } from "@sistema-tasks/contracts";
import { useMe } from "@/lib/hooks/use-me";
import {
  useUpdateProfile,
  useChangePassword,
  useDeleteAccount,
  useSetAvatar,
  useRemoveAvatar,
} from "@/lib/hooks/use-account";
import { AVATAR_ACCEPT } from "@/lib/image";
import { api } from "@/lib/api";
import { initials } from "@/lib/initials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

export default function ContaPage() {
  const me = useMe();

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-8 sm:px-6 lg:py-10">
        <header>
          <h1 className="text-xl font-medium tracking-tight">Minha conta</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Gerencie seu perfil, senha e conta.</p>
        </header>

        {me.isError ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Não foi possível carregar sua conta.</p>
            <Button variant="secondary" onClick={() => me.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : me.isLoading || !me.data ? (
          <HeaderSkeleton />
        ) : (
          <>
            <ProfileHeader name={me.data.name} email={me.data.email} avatarUrl={me.data.avatarUrl} permissions={me.data.permissions} />

            <Tabs defaultValue="perfil" className="flex flex-col gap-4">
              <TabsList>
                <TabsTrigger value="perfil">
                  <UserRound className="size-[15px]" strokeWidth={1.8} /> Perfil
                </TabsTrigger>
                <TabsTrigger value="seguranca">
                  <ShieldCheck className="size-[15px]" strokeWidth={1.8} /> Segurança
                </TabsTrigger>
              </TabsList>

              <TabsContent value="perfil">
                <ProfileSection name={me.data.name} email={me.data.email} />
              </TabsContent>
              <TabsContent value="seguranca">
                <PasswordSection />
              </TabsContent>
            </Tabs>

            <DangerZone />
          </>
        )}
      </div>
    </div>
  );
}

function Card({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`rounded-2xl border bg-card p-5 sm:p-6 ${danger ? "border-amber/30" : "border-border"}`}>
      {children}
    </section>
  );
}

/** Cabeçalho de perfil: avatar (com controle de foto) + nome + email + chip do papel. */
function ProfileHeader({
  name,
  email,
  avatarUrl,
  permissions,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  permissions: string[];
}) {
  const setAvatar = useSetAvatar();
  const removeAvatar = useRemoveAvatar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const busy = setAvatar.isPending;
  const isAdmin = permissions.includes(PERMISSIONS.membros_gerenciar);

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (file) setAvatar.mutate(file);
  }

  return (
    <Card>
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
        <div className="relative shrink-0" aria-busy={busy}>
          <span
            className="flex size-24 items-center justify-center overflow-hidden rounded-full border border-muted-foreground/25 bg-accent text-2xl font-medium text-foreground sm:size-28"
            aria-label={avatarUrl ? `Foto de ${name}` : `Iniciais de ${name}`}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={`Foto de ${name}`} className="size-full object-cover" />
            ) : (
              <span aria-hidden>{initials(name || "?")}</span>
            )}
          </span>

          {busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/65">
              <Loader2 className="size-6 animate-spin text-primary" />
            </span>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Trocar foto de perfil"
            className="absolute -bottom-0.5 -right-0.5 flex size-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground outline-none transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Camera className="size-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-medium">{name}</div>
          <div className="truncate text-[13px] text-muted-foreground">{email}</div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[11.5px] text-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden /> {isAdmin ? "Administrador" : "Membro"}
            </span>
            {avatarUrl && !busy && (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="size-3.5" /> Remover foto
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {busy ? "Enviando foto…" : ""}
      </p>

      <ConfirmDialog
        open={confirmRemove}
        title="Remover foto de perfil?"
        description="Você volta a aparecer com as iniciais."
        confirmLabel="Remover"
        danger
        pending={removeAvatar.isPending}
        onConfirm={() => removeAvatar.mutate(undefined, { onSettled: () => setConfirmRemove(false) })}
        onOpenChange={setConfirmRemove}
      />
    </Card>
  );
}

function HeaderSkeleton() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
        <Skeleton className="size-24 rounded-full sm:size-28" />
        <div className="flex w-full flex-col items-center gap-2 sm:items-start">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

function ProfileSection({ name, email }: { name: string; email: string }) {
  const update = useUpdateProfile();
  const [value, setValue] = useState(name);
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) {
      setValue(name);
      seeded.current = true;
    }
  }, [name]);

  const dirty = value.trim() !== name && value.trim().length > 0;

  return (
    <Card>
      <h2 className="text-[15px] font-medium tracking-tight">Perfil</h2>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">Seu nome e foto aparecem para os outros membros.</p>

      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} readOnly disabled />
        <p className="text-xs text-muted-foreground">O email de acesso não pode ser alterado por aqui.</p>
      </div>

      {dirty && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setValue(name)}>
            Descartar
          </Button>
          <Button onClick={() => update.mutate({ name: value.trim() })} disabled={update.isPending}>
            {update.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function PasswordSection() {
  const router = useRouter();
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = current && next.length >= 8 && confirm === next && !change.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next !== confirm) {
      setErr("As senhas não conferem.");
      return;
    }
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next, confirmPassword: confirm });
      toast.success("Senha alterada. Entre novamente.");
      router.push("/login");
    } catch (e) {
      setErr(apiMessage(e, "Não foi possível alterar a senha."));
    }
  }

  return (
    <Card>
      <h2 className="text-[15px] font-medium tracking-tight">Segurança</h2>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        Ao alterar a senha, sua sessão é encerrada e você precisa entrar de novo.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current">Senha atual</Label>
          <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new">Nova senha</Label>
            <Input id="new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirmar nova senha</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        {next.length > 0 && next.length < 8 && (
          <p className="text-xs text-muted-foreground">A nova senha deve ter ao menos 8 caracteres.</p>
        )}
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit}>
            {change.isPending ? "Alterando…" : "Alterar senha"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DangerZone() {
  const router = useRouter();
  const del = useDeleteAccount();
  const [open, setOpen] = useState(false);

  async function confirmDelete() {
    try {
      await del.mutateAsync();
      setOpen(false);
      try {
        await api.post("/auth/logout");
      } catch {
        /* já sem sessão, tudo bem */
      }
      toast.success("Conta excluída.");
      router.push("/login");
    } catch (e) {
      setOpen(false);
      toast.error(apiMessage(e, "Não foi possível excluir a conta."));
    }
  }

  return (
    <Card danger>
      <div className="flex items-center gap-2 text-[15px] font-medium tracking-tight">
        <AlertTriangle className="size-[17px] text-amber" strokeWidth={1.8} /> Excluir conta
      </div>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        Remove seu acesso e desvincula você das tarefas. Não dá para desfazer.
      </p>
      <div className="mt-4">
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          className="border border-amber/40 text-amber hover:bg-amber/10"
        >
          Excluir minha conta
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        title="Excluir sua conta?"
        description="Você perde o acesso imediatamente e deixa de ser responsável pelas tarefas. Esta ação não pode ser desfeita."
        confirmLabel="Excluir conta"
        danger
        pending={del.isPending}
        onConfirm={confirmDelete}
        onOpenChange={setOpen}
      />
    </Card>
  );
}
