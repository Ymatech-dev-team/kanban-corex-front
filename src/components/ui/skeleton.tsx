"use client";
import { Skeleton as HeroSkeleton } from "@heroui/react";
import { cn } from "@/lib/utils";
export function Skeleton({className, ...props}: React.ComponentProps<"div">) {
  return <HeroSkeleton aria-hidden="true" className={cn("rounded-md", className)} {...props} />;
}
