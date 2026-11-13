"use client";

import Image from "next/image";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { api } from "@/lib/api";
import { takeTempPassword } from "@/lib/temp-password-relay";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import type { FirstLoginInput } from "@sistema-tasks/contracts";

export default function FirstLoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Senha temporária vinda do login via relay em memória (lê-e-limpa, uso único). [hardening T6]
  const [tempPassword] = useState<string>(() => takeTempPassword());

  async function onSubmit(values: FirstLoginInput) {
    setPending(true);
    setError(null);
    try {
      await api.post("/auth/first-login", values);
      // senha trocada → sessão limpa no BFF → volta pro login com a senha nova
      router.push("/login");
    } catch (e) {
      const err = e as AxiosError<{ error?: { message?: string } }>;
      setError(err.response?.data?.error?.message ?? "Não foi possível trocar a senha.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <Image src="/brand/logo-light.svg" alt="Corex" width={150} height={45} className="h-10 w-auto dark:hidden" priority />
      <Image src="/brand/logo-dark.svg" alt="Corex" width={150} height={45} className="hidden h-10 w-auto dark:block" priority />
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Troque sua senha</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Este é seu primeiro acesso. Defina uma senha nova para continuar.
        </p>
      </div>
      <ChangePasswordForm
        onSubmit={onSubmit}
        pending={pending}
        error={error}
        defaultCurrentPassword={tempPassword}
      />
    </main>
  );
}
