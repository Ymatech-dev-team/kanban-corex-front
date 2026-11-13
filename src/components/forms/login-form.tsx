"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const inputCls = "h-12 w-full text-base read-only:opacity-70";

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v))} method="post" noValidate className="flex w-full flex-col">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-[13px] font-medium text-muted-foreground">
            E-mail
          </Label>
          <Input
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
            <p id="email-error" className="text-[13px] text-destructive">
              Informe um e-mail válido.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-[13px] font-medium text-muted-foreground">
            Senha
          </Label>
          <div className="relative">
            <Input
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
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
            >
              {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </Button>
          </div>
          {/* placeholder: ainda não há rota de reset — evita rolar pro topo / sujar a URL [login-redesign] */}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="self-end text-[14px] text-muted-foreground outline-none transition hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-primary"
          >
            Esqueci a senha
          </a>
          {errors.password && (
            <p id="password-error" className="text-[13px] text-destructive">
              Informe sua senha.
            </p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 text-[13px] text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="mt-7 h-12 w-full text-base"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
