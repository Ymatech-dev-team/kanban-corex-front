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
    <main className="login-dark grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[42fr_58fr]">
      {/* PAINEL DO FORM (esquerda no desktop, abaixo no mobile) — tema-aware por tokens. */}
      <section className="relative order-2 flex items-center justify-center px-6 py-12 lg:order-1">
        <div className="w-full max-w-[384px]">
          {/* marca — logo YMALOG (public/logo-ymalog.png) — centrada e um pouco mais acima */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ymalog.png" alt="YMALOG" className="mx-auto mb-12 block h-9 w-auto" />

          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
            Faça seu login<span className="text-primary">.</span>
          </h1>
          <p className="mt-1.5 mb-7 text-[13px] text-muted-foreground">Acesse sua conta para continuar</p>

          <LoginForm onSubmit={onSubmit} pending={pending} error={error} />
        </div>
      </section>

      {/* HERO com imagem — SÓ no desktop; no mobile some e o form ocupa a tela inteira. */}
      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-background lg:order-2 lg:block lg:h-auto"
      >
        {/* imagem de fundo — public/login-hero.webp */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/login-hero.webp)" }} />
        {/* leve escurecimento geral pra dar profundidade e não brigar com o form */}
        <div className="absolute inset-0 bg-black/20" />
        {/* DESKTOP — costura da borda esquerda: dissolve a imagem EXATAMENTE na cor do painel (var(--background)),
            opaca o suficiente pra cobrir o brilho do pôr do sol na borda, + desfoque; some pra direita. */}
        <div
          className="absolute inset-y-0 left-0 hidden w-2/3 backdrop-blur-2xl lg:block"
          style={{
            maskImage: "linear-gradient(to right, black 0%, black 22%, transparent 78%)",
            WebkitMaskImage: "linear-gradient(to right, black 0%, black 22%, transparent 78%)",
            background: "linear-gradient(to right, var(--background) 0%, var(--background) 18%, transparent 72%)",
          }}
        />
      </aside>
    </main>
  );
}
