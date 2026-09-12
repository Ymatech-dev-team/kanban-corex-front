"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput } from "@sistema-tasks/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v))} className="flex w-full flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="group relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-12 rounded-xl border-border/60 bg-card/50 pl-10 text-[14px] transition-colors placeholder:text-muted-foreground/40 hover:border-border"
            {...register("email")}
          />
        </div>
        {errors.email && <p id="email-error" className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <div className="group relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="h-12 rounded-xl border-border/60 bg-card/50 pl-10 pr-11 text-[14px] transition-colors placeholder:text-muted-foreground/40 hover:border-border"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && <p id="password-error" className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-md border-l-2 border-destructive bg-card px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="mt-1.5 h-12 w-full rounded-xl text-[14px] font-medium shadow-lg shadow-primary/25 transition active:scale-[0.99]"
      >
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
