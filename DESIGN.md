# Corex Tasks — design system

## Identidade

Referência oficial: Corex Opção 2, kit v2, Refinamento 02; linguagem do site corexsistemas.com.br. Usar os SVG oficiais em public/brand, sem redesenhar ou remontar o logotipo. Manrope local em src/assets/fonts (400, 600 e 800), licença OFL incluída.

Paleta: azul #091E2B, petróleo #087F75, turquesa #15BFA5, grafite #344449 e papel #F5F5F0. Padrão claro com sidebar azul; escuro persistido por cookie sdt-theme e renderizado no servidor. Ambos usam os mesmos papéis semânticos, com contrastes próprios.

## Componentes

HeroUI React e styles 3.2.7, React 19 e Tailwind 4. Os wrappers em src/components/ui preservam as interfaces do domínio usando primitivas HeroUI reais. Radix e Sonner foram removidos. Menus com formulários usam Popover HeroUI para manter controles interativos. Alertas transitórios usam Toast.Provider e adaptador local que preserva Desfazer.

Dnd-kit continua responsável pelo arraste; não é uma biblioteca visual concorrente. Gráficos de domínio em SVG e inputs de arquivo ocultos continuam especializados. A página offline preserva HTML sem dependência de chunks para funcionar sem conexão.

## Composição

Home editorial com divisórias, títulos fortes e métricas abertas; cards reservados às tarefas e superfícies que exigem agrupamento. Relatórios longos usam disclosure. Abas da tarefa: Resumo, Revisão, Histórico. Preservar a ordem agenda/resumo → decisões → acompanhamento.

## Tokens e interação

Tokens em src/app/globals.css. Não redefinir --color-accent ou --color-muted como fundos legados: HeroUI usa esses nomes para estados ativos e texto. Fundos neutros usam bg-surface-secondary/tertiary; estados usam primary/success/warning/danger.

Espaçamento em múltiplos de 4px, raios moderados, sombras restritas aos overlays. Transições curtas de estado; respeitar prefers-reduced-motion. Sem animações decorativas contínuas. Mobile usa alvos confortáveis, bottom navigation e painel de tarefa de largura total. Preservar min-h-0 e overflow dos scroll owners do shell.

## Verificação

Testar os dois temas, reload com preferência salva, navegação teclado, overlays aninhados, retorno de foco, edição não salva, lista/seleção, DnD mouse/teclado e rollback de mutation. Evidências da migração: ../execucao/rebrand-heroui/.
