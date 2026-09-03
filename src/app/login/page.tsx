"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { api } from "@/lib/api";
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
        // Leva a senha temporária pro 1º acesso (só na sessão do navegador, apagada ao usar).
        try {
          sessionStorage.setItem("sdt_temp_pw", values.password);
        } catch {
          /* sem sessionStorage: a pessoa digita a senha de novo, sem problema */
        }
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      {/* Aurora de fundo: brilhos da marca flutuando devagar, baixa opacidade. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="sdt-aurora absolute -top-32 left-[15%] size-[420px] rounded-full blur-[100px]"
          style={{
            background: "radial-gradient(circle, rgba(255,198,0,0.18), transparent 70%)",
            animation: "sdt-drift-a 17s ease-in-out infinite",
          }}
        />
        <div
          className="sdt-aurora absolute -bottom-40 right-[10%] size-[460px] rounded-full blur-[110px]"
          style={{
            background: "radial-gradient(circle, rgba(255,176,0,0.12), transparent 70%)",
            animation: "sdt-drift-b 23s ease-in-out infinite",
          }}
        />
        <div
          className="sdt-aurora absolute left-1/2 top-1/3 size-[320px] -translate-x-1/2 rounded-full blur-[90px]"
          style={{
            background: "radial-gradient(circle, rgba(255,198,0,0.08), transparent 70%)",
            animation: "sdt-drift-c 19s ease-in-out infinite",
          }}
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      <div className="relative w-full max-w-[400px]">
        <div className="rounded-2xl border border-border bg-card/70 p-8 shadow-2xl shadow-black/40">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-4 grid size-12 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/20">
              Y
            </div>
            <h1 className="text-lg font-medium tracking-tight">Entrar no Sistema de Tasks</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Acesse sua conta para continuar</p>
          </div>

          <LoginForm onSubmit={onSubmit} pending={pending} error={error} />
        </div>

        <p className="mt-5 text-center text-[11px] tracking-wide text-muted-foreground/50">
          YMALOG · Sistema de Tasks
        </p>
      </div>
    </main>
  );
}
