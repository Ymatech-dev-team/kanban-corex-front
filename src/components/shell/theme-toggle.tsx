"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

/** Alterna claro/escuro. O tema inicial já foi aplicado pelo script anti-flash no <head>. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.dataset.theme = next;
    // Cookie (não localStorage): o servidor lê e já renderiza o tema certo no próximo SSR.
    document.cookie = `sdt-theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const label = theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro";

  return (
    <Button variant="unstyled"
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-lg:size-11"
    >
      {/* Antes de montar, mostra um ícone neutro para não divergir do SSR. */}
      {!mounted ? (
        <Moon className="size-[18px]" strokeWidth={1.8} />
      ) : theme === "dark" ? (
        <Sun className="size-[18px]" strokeWidth={1.8} />
      ) : (
        <Moon className="size-[18px]" strokeWidth={1.8} />
      )}
    </Button>
  );
}
