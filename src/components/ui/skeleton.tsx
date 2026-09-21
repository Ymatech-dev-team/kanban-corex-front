import { cn } from "@/lib/utils";

/** Placeholder de carregamento (shadcn). Pulso suave sobre o tom neutro. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
