"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ComboBox, InputGroup, Kbd, ListBox, Tag, TagGroup } from "@heroui/react";
import { MAX_QUERY_LENGTH } from "@/lib/global-filters";
import { cn } from "@/lib/utils";

/** Filtro ativo mostrado como ficha removível dentro do campo. `key` identifica o filtro (ex.: "cliente"). */
export interface QueryChip {
  key: string;
  label: string; // "cliente"
  value: string; // "IMA"
}

/** Valores sugeridos quando o texto começa com `prefix:` (ex.: `cliente:`). */
export interface QuerySuggestionGroup {
  prefix: string; // "cliente", "projeto", "responsável", "estado"
  options: { id: string; label: string }[];
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** `cliente:ima` → { group, rest: "ima" }; texto sem prefixo conhecido → null (é busca por título). */
export function parsePrefix<G extends { prefix: string }>(text: string, groups: G[]): { group: G; rest: string } | null {
  const match = /^\s*([^\s:]+):(.*)$/.exec(text);
  if (!match) return null;
  const name = norm(match[1]);
  const group = groups.find((g) => norm(g.prefix) === name);
  return group ? { group, rest: match[2].trim() } : null;
}

/** Separador entre o prefixo e o id de uma sugestão (`cliente|c1`). */
const SEP = "|";

/**
 * Filtro das sugestões, aplicado pelo ComboBox à coleção inteira: `textValue` é `prefixo:rótulo`.
 * Só casa quando o texto digitado começa com o mesmo prefixo e o rótulo contém o que vem depois dele.
 * Texto sem prefixo (busca por título) não casa com nada, então a lista não abre.
 */
export function matchesSuggestion(textValue: string, input: string): boolean {
  const typed = /^\s*([^\s:]+):(.*)$/.exec(input);
  if (!typed) return false;
  const at = textValue.indexOf(":");
  if (at < 0) return false;
  return norm(textValue.slice(0, at)) === norm(typed[1]) && norm(textValue.slice(at + 1)).includes(norm(typed[2].trim()));
}

const isEditable = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
};

/**
 * Campo de consulta único (RF20): busca por título (debounce 300 ms) + filtros ativos como fichas removíveis dentro do campo.
 * Digitar `cliente:`, `projeto:`, `responsável:` ou `estado:` sugere valores; `/` foca o campo fora de outros campos de texto.
 * Apresentação pura: o estado é de quem usa.
 */
export function QueryField({
  value,
  onValueChange,
  chips,
  onRemoveChip,
  groups,
  onPick,
  placeholder = "Buscar pelo título ou digite cliente:, projeto:, estado:",
  ariaLabel = "Buscar tarefas",
  debounceMs = 300,
  hotkey = true,
  className,
}: {
  /** Texto de busca vigente (vem da URL ou do estado local). */
  value: string;
  /** Chamado com o texto aparado, depois do debounce. */
  onValueChange: (text: string) => void;
  chips: QueryChip[];
  onRemoveChip: (key: string) => void;
  groups: QuerySuggestionGroup[];
  onPick: (prefix: string, optionId: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  debounceMs?: number;
  hotkey?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const emitted = useRef(value.trim());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  // Mudança externa (voltar/avançar do navegador, "limpar filtros"): o campo acompanha.
  useEffect(() => {
    if (value.trim() !== emitted.current) {
      clearTimeout(timer.current);
      emitted.current = value.trim();
      setText(value);
    }
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function schedule(next: string) {
    clearTimeout(timer.current);
    // O texto do campo é a fonte do `q`. Texto com prefixo conhecido (`estado:`…) é escolha de filtro, não busca por título:
    // conta como vazio, então o `q` anterior sai (depois do mesmo debounce) em vez de ficar congelado.
    const isFacet = !!parsePrefix(next, groups);
    const trimmed = isFacet ? "" : next.trim().slice(0, MAX_QUERY_LENGTH); // o backend responde 400 acima de 100 caracteres
    if (trimmed === emitted.current) return;
    timer.current = setTimeout(() => {
      emitted.current = trimmed;
      onValueChangeRef.current(trimmed);
    }, debounceMs);
  }

  function changeText(next: string) {
    setText(next);
    schedule(next);
  }

  // `/` foca o campo quando nenhum campo de texto está focado.
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isEditable(event.target)) return;
      const input = wrap.current?.querySelector("input");
      if (!input) return;
      event.preventDefault();
      input.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hotkey]);

  // A coleção de sugestões é a lista inteira e estável; quem decide o que aparece é `matchesSuggestion`, na mesma renderização
  // em que o texto muda. (Com `items` derivados do texto, a lista só ficava pronta uma renderização depois e nunca abria.)
  const signature = JSON.stringify(groups);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const collection = useMemo(() => groups.flatMap((g) => g.options.map((o) => ({ id: `${g.prefix}${SEP}${o.id}`, label: o.label, textValue: `${g.prefix}:${o.label}` }))), [signature]);

  function pick(key: string | number | null) {
    if (key == null) return;
    const [prefix, ...rest] = String(key).split(SEP);
    onPick(prefix, rest.join(SEP));
    clearTimeout(timer.current);
    setText("");
    if (emitted.current !== "") {
      emitted.current = "";
      onValueChangeRef.current("");
    }
  }

  return (
    <div ref={wrap} className={cn("min-w-0 flex-1", className)}>
      <InputGroup fullWidth className="h-auto min-h-[38px] flex-wrap gap-1.5 px-2 py-1">
        {chips.length > 0 && (
          <InputGroup.Prefix className="flex min-w-0 max-w-full flex-wrap p-0">
            <TagGroup aria-label="Filtros ativos" size="sm" onRemove={(keys) => keys.forEach((k) => onRemoveChip(String(k)))}>
              <TagGroup.List items={chips} className="gap-1.5">
                {(chip: QueryChip) => (
                  <Tag id={chip.key} textValue={`${chip.label}: ${chip.value}`} className="gap-1.5 border border-border bg-surface-secondary py-1 pl-2 pr-1 text-[12px]">
                    <span className="text-muted">{chip.label}</span>
                    <b className="font-semibold text-foreground">{chip.value}</b>
                    <Tag.RemoveButton aria-label={`Remover filtro ${chip.label}`} className="max-md:relative max-md:before:absolute max-md:before:-inset-3.5 max-md:before:content-['']" />
                  </Tag>
                )}
              </TagGroup.List>
            </TagGroup>
          </InputGroup.Prefix>
        )}
        {/* O ComboBox só envolve o input: as fichas (TagGroup) vivem fora dele para não herdar o contexto de coleção da lista de sugestões. */}
        <ComboBox
          aria-label={ariaLabel}
          menuTrigger="input"
          defaultItems={collection}
          defaultFilter={matchesSuggestion}
          allowsCustomValue
          selectedKey={null}
          onSelectionChange={pick}
          inputValue={text}
          onInputChange={changeText}
          className="min-w-[160px] flex-1"
        >
          <InputGroup.Input
            placeholder={placeholder}
            maxLength={MAX_QUERY_LENGTH}
            className="w-full bg-transparent px-1 text-[13px]"
            onKeyDown={(event) => {
              // Backspace em campo vazio remove a última ficha.
              if (event.key === "Backspace" && text === "" && chips.length > 0) onRemoveChip(chips[chips.length - 1].key);
            }}
          />
          <ComboBox.Popover className="z-[80]" triggerRef={wrap}>
            <ListBox aria-label="Sugestões" renderEmptyState={() => null}>
              {(o: { id: string; label: string; textValue: string }) => <ListBox.Item id={o.id} textValue={o.textValue}>{o.label}</ListBox.Item>}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        <InputGroup.Suffix className="hidden shrink-0 pr-0 sm:flex">
          <Kbd variant="light" aria-hidden="true" className="h-5 px-1.5 font-mono text-[11px]"><Kbd.Content>/</Kbd.Content></Kbd>
        </InputGroup.Suffix>
      </InputGroup>
    </div>
  );
}
