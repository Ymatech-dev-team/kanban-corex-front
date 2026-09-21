"use client";

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
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-[#0A0D12] text-[#E8ECEF] md:block">
      {/* Foto de fundo (decorativa). Desktop: cobre tudo, âncora 80%. Mobile: faixa no topo. */}
      <div className="relative h-[40svh] min-h-[260px] w-full shrink-0 md:absolute md:inset-0 md:h-auto">
        <Image
          src="/login-bg.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover [object-position:8%_center] md:[object-position:right_center] lg:[object-position:80%_center]"
        />
        {/* scrim mobile: topo forte (logo não briga com o giz) + funde a base no fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 md:hidden"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,13,18,.88) 0%, rgba(10,13,18,0) 34%, rgba(10,13,18,0) 52%, #0A0D12 100%)",
          }}
        />
        {/* scrim desktop: leve no topo + vinheta na base */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,13,18,.55) 0%, rgba(10,13,18,0) 22%), linear-gradient(to top, rgba(10,13,18,.92) 0%, rgba(10,13,18,0) 40%)",
          }}
        />
      </div>

      {/* Logo — único elemento sobre a foto */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/corex-logo-wordmark.png"
        alt="Corex"
        className="absolute left-5 top-5 z-20 h-[30px] w-auto md:left-10 md:top-12 md:h-9 lg:left-16"
      />

      {/* Painel do formulário */}
      <section
        aria-labelledby="login-title"
        className="relative z-10 w-full bg-[#0A0D12] px-5 pb-[88px] pt-8 md:absolute md:inset-y-0 md:right-0 md:flex md:w-[440px] md:flex-col md:justify-center md:border-l md:border-[#141A22] md:px-10 md:py-12 lg:w-[clamp(420px,36vw,600px)] lg:px-16"
      >
        <div className="mx-auto w-full max-w-[400px]">
          <h1
            id="login-title"
            className="text-[32px] font-medium leading-[1.1] tracking-[-0.025em] [font-family:var(--font-display)] md:text-[40px]"
          >
            Entrar
          </h1>
          <p className="mt-2.5 text-[16px] text-[#8A94A3]">Acesse o quadro da sua equipe.</p>

          <div className="mt-7 md:mt-10">
            <LoginForm onSubmit={onSubmit} pending={pending} error={error} />
          </div>
        </div>

        <p className="mt-8 text-[12px] tracking-[0.02em] text-[#737D8C] md:absolute md:bottom-10 md:left-1/2 md:mt-0 md:w-[min(400px,calc(100%-5rem))] md:-translate-x-1/2 lg:w-[min(400px,calc(100%-8rem))]">
          pensar. construir. resolver.
        </p>
      </section>
    </main>
  );
}
