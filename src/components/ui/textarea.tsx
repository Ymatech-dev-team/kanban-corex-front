"use client";
import * as React from "react";
import { TextArea as HeroComponent } from "@heroui/react";
import { cn } from "@/lib/utils";
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({className, ...props}, ref) => <HeroComponent ref={ref} className={cn("corex-textarea", className)} {...props} />
);
Textarea.displayName = "Textarea";
export { Textarea };
