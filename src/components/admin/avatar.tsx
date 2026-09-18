import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-[11px]",
  md: "size-9 text-[11px]",
  lg: "size-10 text-[13px]",
} as const;

/** Avatar de iniciais — fonte única (antes estava triplicado em tabela/card/dialog). [redesign membros] */
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent font-medium text-foreground",
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
