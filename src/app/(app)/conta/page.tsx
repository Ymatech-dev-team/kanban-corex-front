"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { Loader2, UserRound, ShieldCheck, AlertTriangle } from "lucide-react";
import { useMe } from "@/lib/hooks/use-me";
import { useUpdateProfile, useChangePassword, useDeleteAccount } from "@/lib/hooks/use-account";
import { api } from "@/lib/api";
import { initials } from "@/lib/initials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { cn } from "@/lib/utils";

function apiMessage(e: unknown, fallback: string): string {
  return (e as AxiosError<{ error?: { message?: string } }>)?.response?.data?.error?.message ?? fallback;
}

type Tab = "perfil" | "seguranca" | "conta";

const NAV: { key: Tab; label: string; icon: typeof UserRound }[] = [
  { key: "perfil", label: "Perfil", icon: UserRound },
  { key: "seguranca", label: "Segurança", icon: ShieldCheck },
  { key: "conta", label: "Excluir conta", icon: AlertTriangle },
];

export default function ContaPage() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>("perfil");

  if (me.isLoading || !me.data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-8 lg:py-10">
        <header>
          <h1 className="text-xl font-medium tracking-tight">Minha conta</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Gerencie seu perfil, senha e conta.</p>
        </header>

        <div className="mt-6 flex flex-col gap-6 md:flex-row md:gap-10 lg:mt-8">
          <nav className="flex gap-1 overflow-x-auto pb-1 md:w-56 md:shrink-0 md:flex-col md:self-start md:overflow-visible md:pb-0 md:sticky md:top-8">
            {NAV.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              const danger = key === "conta";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors",
                    active
                      ? cn("bg-accent text-foreground", danger ? "[&_svg]:text-amber" : "[&_svg]:text-primary")
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1">
            {tab === "perfil" && <ProfileSection name={me.data.name} email={me.data.email} />}
            {tab === "seguranca" && <PasswordSection />}
            {tab === "conta" && <DangerSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  danger,
  children,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-6",
        danger ? "border-amber/30" : "border-border",
      )}
    >
      <h2 className="text-[15px] font-medium tracking-tight">{title}</h2>
      {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
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
    <Section title="Perfil" description="Seu nome aparece para os outros membros.">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent text-lg font-medium text-foreground">
          {initials(value || name || "?")}
        </span>
        <div className="flex-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} />
          </div>
        </div>
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
    </Section>
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
    <Section title="Segurança" description="Ao trocar a senha, sua sessão é encerrada e você entra de novo.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
    </Section>
  );
}

function DangerSection() {
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
    <Section title="Excluir conta" description="Remove seu acesso e desvincula você das tarefas. Não dá para desfazer." danger>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        className="border border-amber/40 text-amber hover:bg-amber/10"
      >
        Excluir minha conta
      </Button>
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
    </Section>
  );
}
