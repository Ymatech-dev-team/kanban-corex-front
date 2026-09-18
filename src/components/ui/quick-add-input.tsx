"use client";

import { useRef, useState, type KeyboardEvent, type FocusEvent } from "react";
import { Loader2, Maximize2 } from "lucide-react";

/**
 * Composer de 1 linha pra criar rápido (quick-add). Burro: só resolve teclado/foco/pending.
 * Enter cria (mantém aberto+focado pra próxima), Esc fecha, blur vazio colapsa, duplo-Enter barrado
 * enquanto envia. Erro mantém o texto pra reenvio. Sem lógica de domínio. [criar-mais-rapido]
 */
export function QuickAddInput({
  onSubmit,
  onExpand,
  onClose,
  placeholder,
  ariaLabel,
  maxLength = 200,
}: {
  onSubmit: (value: string) => Promise<void>;
  onExpand?: (value: string) => void;
  onClose?: () => void;
  placeholder?: string;
  ariaLabel: string;
  maxLength?: number;
}) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const v = value.trim();
    if (!v || pending) return; // vazio ou já enviando → ignora (barra duplo-Enter)
    setPending(true);
    try {
      await onSubmit(v);
      setValue(""); // limpa e mantém o foco pra criar a próxima em série
      inputRef.current?.focus();
    } catch {
      // mantém o texto pra reenvio; o erro já vira toast no hook
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
    }
  }

  function onBlurCapture(e: FocusEvent<HTMLDivElement>) {
    if (pending) return;
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return; // foco foi pro "Criar"/expandir → segura
    if (!value.trim()) onClose?.(); // saiu vazio → colapsa de volta pro "+"
  }

  return (
    <div
      onBlur={onBlurCapture}
      className="flex flex-col gap-1.5 rounded-xl border border-primary/60 bg-card p-2 ring-1 ring-primary/20"
    >
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={value}
          autoFocus
          maxLength={maxLength}
          disabled={pending}
          enterKeyHint="done"
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
        />
        {pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
        {onExpand && (
          <button
            type="button"
            aria-label="Abrir completo"
            disabled={pending}
            onClick={() => onExpand(value.trim())}
            className="shrink-0 rounded p-1.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Maximize2 className="size-4" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-1.5">
        <span className="text-[11px] text-muted-foreground">
          <span className="text-foreground/80">Enter</span> cria e continua ·{" "}
          <span className="text-foreground/80">Esc</span> fecha
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || pending}
          className="rounded-md bg-primary px-3 py-1 text-[11.5px] font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          Criar
        </button>
      </div>
    </div>
  );
}
