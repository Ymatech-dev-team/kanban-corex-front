"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { api } from "@/lib/api";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import type { FirstLoginInput } from "@sistema-tasks/contracts";

export default function FirstLoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-medium tracking-tight">Troque sua senha</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Este é seu primeiro acesso. Defina uma senha nova para continuar.
        </p>
      </div>
      <ChangePasswordForm onSubmit={onSubmit} pending={pending} error={error} />
    </main>
  );
}
