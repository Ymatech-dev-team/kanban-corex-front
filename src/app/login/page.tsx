"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { api } from "@/lib/api";
import { setTempPassword } from "@/lib/temp-password-relay";
import { LoginForm } from "@/components/forms/login-form";
import type { LoginInput } from "@sistema-tasks/contracts";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: LoginInput) {
    setPending(true);
    setError(null);
    try {
      const { data } = await api.post<{ mustChangePassword: boolean }>("/auth/login", values);
      if (data.mustChangePassword) {
        // Leva a senha temporária pro 1º acesso via relay EM MEMÓRIA (não storage). [hardening T6]
        setTempPassword(values.password);
        router.push("/first-login");
      } else {
        router.push("/");
      }
    } catch (e) {
      const err = e as AxiosError<{ error?: { message?: string } }>;
      if (err.response?.status === 429) {
        setError("Muitas tentativas. Aguarde e tente de novo.");
      } else {
        setError(err.response?.data?.error?.message ?? "Não foi possível entrar.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    // Corex é dark-only e sóbrio: login limpo, grafite liso, form centrado (sem hero decorativo).
    <main className="login-dark flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-[384px]">
        {/* marca — wordmark COREX. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/corex-logo-wordmark.png" alt="Corex" className="mx-auto mb-12 block h-9 w-auto" />

        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
          Faça seu login<span className="text-primary">.</span>
        </h1>
        <p className="mt-1.5 mb-7 text-[13px] text-muted-foreground">Acesse sua conta para continuar</p>

        <LoginForm onSubmit={onSubmit} pending={pending} error={error} />
      </div>
    </main>
  );
}
