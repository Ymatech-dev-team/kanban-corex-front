"use client";

import { toast as heroToast } from "@heroui/react";
import type { ReactNode } from "react";

type Options = {
  id?: string | number;
  duration?: number;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
};
const active = new Map<string | number, string>();
function notify(message: ReactNode, options: Options = {}, variant: "default" | "success" | "danger" | "warning" = "default") {
  const existing = options.id == null ? undefined : active.get(options.id);
  let key = existing ?? "";
  const config = {
    variant,
    description: options.description,
    timeout: options.duration ?? 5000,
    onClose: () => { if (options.id != null && active.get(options.id) === key) active.delete(options.id); },
    ...(options.action ? { actionProps: {
      children: options.action.label,
      onPress: () => { heroToast.close(key); options.action?.onClick(); },
    } } : {}),
  };
  key = existing ? heroToast.update(existing, message, config) : heroToast(message, config);
  if (options.id != null) active.set(options.id, key);
  return key;
}
export const toast = Object.assign(notify, {
  message: notify,
  success: (message: ReactNode, options?: Options) => notify(message, options, "success"),
  error: (message: ReactNode, options?: Options) => notify(message, options, "danger"),
  warning: (message: ReactNode, options?: Options) => notify(message, options, "warning"),
});
