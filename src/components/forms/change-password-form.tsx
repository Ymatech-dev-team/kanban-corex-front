"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { firstLoginSchema, type FirstLoginInput } from "@sistema-tasks/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onSubmit: (values: FirstLoginInput) => void;
  pending?: boolean;
  error?: string | null;
  defaultCurrentPassword?: string;
}

export function ChangePasswordForm({ onSubmit, pending, error, defaultCurrentPassword }: Props) {
  const prefilled = !!defaultCurrentPassword;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FirstLoginInput>({
    resolver: zodResolver(firstLoginSchema),
    defaultValues: { currentPassword: defaultCurrentPassword ?? "", newPassword: "", confirmPassword: "" },
  });

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v))} className="flex w-full max-w-sm flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current">Senha temporária</Label>
        <Input id="current" type="password" aria-invalid={!!errors.currentPassword} {...register("currentPassword")} />
        {prefilled ? (
          <p className="text-xs text-muted-foreground">Já preenchemos com a senha que você usou pra entrar.</p>
        ) : (
          errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new">Nova senha</Label>
        <Input
          id="new"
          type="password"
          autoFocus={prefilled}
          aria-invalid={!!errors.newPassword}
          {...register("newPassword")}
        />
        {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Confirmar nova senha</Label>
        <Input id="confirm" type="password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
      </div>
      {error && (
        <p role="alert" className="rounded-md border-l-2 border-destructive bg-card px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Salvando…" : "Trocar senha"}
      </Button>
    </form>
  );
}
