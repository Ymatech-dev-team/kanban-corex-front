"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@sistema-tasks/contracts";

interface Props {
  onSubmit: (values: LoginInput) => void;
  pending?: boolean;
  error?: string | null;
}

/**
 * Form do login no visual do handoff Corex (label acima, input 48px, olho na senha, botão menta).
 * Cores login-scoped (hex do PROMPT.md). Valida no submit e revalida no blur. [login-redesign]
 */
export function LoginForm({ onSubmit, pending, error }: Props) {
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    reValidateMode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  const inputCls =
    "h-12 w-full rounded-lg border border-[#1C232D] bg-[#0F141B] px-4 text-[15px] text-[#E8ECEF] outline-none transition placeholder:text-[#737D8C] read-only:opacity-70 focus:border-[#34F5C5] focus:shadow-[0_0_0_3px_rgba(52,245,197,0.18)] aria-[invalid=true]:border-[#F87171] aria-[invalid=true]:focus:border-[#F87171]";

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v))} method="post" noValidate className="flex w-full flex-col">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-[13px] font-medium text-[#8A94A3]">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            readOnly={pending}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputCls}
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" className="text-[13px] text-[#F87171]">
              Informe um e-mail válido.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-[13px] font-medium text-[#8A94A3]">
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Sua senha"
              readOnly={pending}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={`${inputCls} pr-12`}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-md text-[#8A94A3] outline-none transition hover:text-[#E8ECEF] focus-visible:ring-2 focus-visible:ring-[#34F5C5]"
            >
              {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
          {/* placeholder: ainda não há rota de reset — evita rolar pro topo / sujar a URL [login-redesign] */}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="self-end text-[14px] text-[#8A94A3] outline-none transition hover:text-[#E8ECEF] hover:underline focus-visible:ring-2 focus-visible:ring-[#34F5C5]"
          >
            Esqueci a senha
          </a>
          {errors.password && (
            <p id="password-error" className="text-[13px] text-[#F87171]">
              Informe sua senha.
            </p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 text-[13px] text-[#F87171]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-7 flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-[#34F5C5] text-[15px] font-semibold text-[#0A0D12] outline-none transition hover:bg-[#5CF7D3] focus-visible:ring-2 focus-visible:ring-[#34F5C5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0D12] disabled:opacity-70"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
