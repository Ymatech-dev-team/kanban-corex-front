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
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            aria-invalid={!!errors.email}
            className="pl-9"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            className="px-9"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-md border-l-2 border-destructive bg-card px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
