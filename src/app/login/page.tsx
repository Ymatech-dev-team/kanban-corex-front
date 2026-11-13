"use client";

import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
      const status = err.response?.status;
      if (status === 429) {
        setError("Muitas tentativas. Tente de novo em alguns minutos.");
      } else if (status === 401) {
        // Credencial: msg FIXA (não ecoa o server) — não revela se o e-mail existe. [PROMPT §estados]
        setError("E-mail ou senha incorretos.");
      } else {
        setError(err.response?.data?.error?.message ?? "E-mail ou senha incorretos.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-svh bg-background text-foreground lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-[#091E2B] px-7 py-8 text-[#F5F5F0] sm:px-12 lg:min-h-svh lg:px-16 lg:py-12">
        <Image src="/brand/logo-dark.svg" alt="Corex" width={160} height={48} priority className="h-10 w-auto self-start" />
        <div className="relative z-10 max-w-xl py-12 lg:py-20">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#15BFA5]">Corex Tasks</p>
          <h2 className="max-w-lg text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">Clareza para pensar.<br />Espaço para construir.</h2>
          <p className="mt-7 max-w-md text-base leading-relaxed text-white/65">Planos, tarefas e entregas em um só lugar. Acompanhe o trabalho da sua equipe e dos seus agentes.</p>
        </div>
        <p className="text-xs tracking-wide text-white/50">pensar. construir. resolver.</p>
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-28 size-80 rounded-full border border-white/10" />
      </section>
      <section aria-labelledby="login-title" className="flex items-center justify-center px-7 py-14 sm:px-12 lg:py-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-end"><ThemeToggle /></div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Seu espaço de trabalho</p>
          <h1 id="login-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Bom ter você aqui.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Entre para acompanhar o que está acontecendo.</p>
          <div className="mt-9"><LoginForm onSubmit={onSubmit} pending={pending} error={error} /></div>
        </div>
      </section>
    </main>
  );
}
