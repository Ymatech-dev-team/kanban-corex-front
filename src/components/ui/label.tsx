"use client";
import * as React from "react";
import { Label as HeroComponent } from "@heroui/react";
import { cn } from "@/lib/utils";
const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({className, ...props}, ref) => <HeroComponent ref={ref} className={cn("corex-label", className)} {...props} />
);
Label.displayName = "Label";
export { Label };
