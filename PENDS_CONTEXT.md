# Contexto do projeto: Pends

Você vai me ajudar no **Pends**, meu app pessoal de produtividade e finanças (uso individual, usuário "Nicolas"). Leia este contexto antes de responder e siga os padrões descritos.

## O que é
Um "sistema operacional pessoal": tarefas em Kanban organizadas por **Módulos de Vida** (ex.: Faculdade, Trabalho, Casa), uma **visão Neural** (mapa orbital/grid dos módulos com progresso), **Analytics** (dashboard + relatório executivo com exportação CSV) e um **Hub Financeiro/CFO** (lançamentos, parcelamentos de cartão, contas recorrentes e projeção de faturas).

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (tema escuro: fundos `#050811` / `#0a0f1d` / `#070a12`, bordas `slate-800`, destaques emerald/blue, fonte mono em labels)
- **Prisma 5** + **PostgreSQL** (`DATABASE_URL`)
- `@dnd-kit` (drag and drop do Kanban), `recharts` (gráficos), `lucide-react` (ícones), `clsx` + `tailwind-merge`
- Idioma da interface e dos comentários: **português (BR)**

## Arquitetura
- `app/page.tsx` — componente cliente único (`PendsApp`) que controla auth, aba ativa (`"neural" | "dashboard" | "kanban" | "finances"`), mês/ano selecionado, filtro de módulo e modais. Carrega tudo via `loadAll()` com `Promise.all` e recarrega após cada mutação.
- `app/actions.ts` — **todas** as Server Actions (`"use server"`), divididas em seções numeradas: 0 Auth, 1 Módulos, Colunas, Board/Dashboard, Cards, Comentários, Rotinas recorrentes, 7 Finanças, 8 Reordenação de colunas. Toda mutação termina com `revalidatePath("/")`.
- `app/types/index.ts` + `app/types/finance.ts` — tipos derivados das actions (`Awaited<ReturnType<typeof ...>>`) e helpers (`isCardOverdue`, `getTaskOverallStatus`, `MONTH_NAMES`).
- `app/components/`
  - `auth/LoginScreen` · `layout/Sidebar`
  - `pipeline/` — `KanbanBoard`, `KanbanColumn`, `KanbanCard`, `KanbanTableView`
  - `neural/` — `NeuralView`, `NeuralOrbit`, `NeuralGrid`, `NeuralBottomSheet` (mobile)
  - `analytics/` — `AnalyticsDash`, `ExecutiveReportModal`
  - `finances/` — `FinancesHub` (KPIs, alertas, abas), `FinanceOverview` (agenda, orçamento por módulo, cartão, projeção), `FinanceLedger` (filtros + seleção em massa), `FinanceRecurring` (contas fixas), `FinanceInstallments`, `ui.tsx`, `format.ts`, `modals/` (`TransactionModal`, `DeleteTxModal`, `RecurringModal`)
  - `shared/` — `CardDetailModal`, `CreateCardModal`, `ModuleModal`, `ColumnModal`, `ConfirmModal`, `DateNavigator`
- `lib/prisma.ts` (client singleton) · `lib/mail.ts` (envio de e-mail ainda **simulado** com `console.log`)

## Modelo de dados (Prisma)
- **Module** — título, cor, `budget?` (teto mensal de gastos); tem Cards e RecurringTasks.
- **Board → Column** (`order`, `isDone`) **→ Card** (título, descrição, prioridade, `dueDate`, `completed/completedAt`, `order`, `moduleId?`, `recurringTaskId?`, `emailAlert`).
- **History** e **Comment** — ligados ao Card (cascade).
- **RecurringTask** — contas fixas: `amount?`, `dueDay?`, `active`, `type` (`INCOME`/`EXPENSE`), `paymentMethod`, módulo.
- **Transaction** — financeiro novo: `type` (`INCOME`/`EXPENSE`), `category`, `paymentMethod` (`PIX`/`BOLETO`/`CREDIT_CARD`), `dueDate`, `paid/paidAt`, parcelamento (`isInstallment`, `installmentCurrent`, `installmentTotal`, `installmentId` agrupa as parcelas), `notes?`, `recurringTaskId?` (conta fixa de origem), `cardId?` (card do Kanban).

## Regras e convenções importantes
- **Datas:** sempre gravar ao **meio-dia UTC** via `parseLocalDateToMidday()` para evitar o bug de fuso UTC-3. Filtros de mês usam `Date.UTC(year, month, 1)` até o último dia 23:59:59.
- **Meses são 0-indexados** (`selectedMonth` 0–11).
- **Finanças:** `getFinanceOverview(year, month)` devolve tudo do mês (lançamentos, atrasados de meses anteriores, resumo previsto/realizado, gasto livre por dia, gastos por módulo x teto, projeção de 6 meses, parcelamentos ativos e status das contas fixas). Não existem mais itens virtuais: contas fixas são lançadas de verdade por `launchRecurringForMonth` (idempotente) e só entram como *previsão* nos saldos/projeção.
- **Parcelamento:** `createTransaction` aceita `amountMode` `TOTAL` (divide, centavos na última) ou `PARCEL`; `updateTransaction`/`deleteTransaction` recebem escopo `one` | `future` | `all`.
- **Ponte Kanban ↔ Finanças:** `sendTransactionToKanban` cria card ligado; pagar o lançamento conclui o card e concluir o card marca os lançamentos ligados como pagos.
- **Pipeline:** drag & drop grava posição via `reorderColumnCards`; `quickCreateCard` para adição rápida; card sem data fica sem prazo (`parseOptionalDate`).
- **Auth:** login por `AUTH_EMAIL` / `AUTH_PASSWORD`; sessão em cookie httpOnly `pends_session` com token **assinado (HMAC)** por `AUTH_SECRET` (`lib/session.ts`). **Toda Server Action nova deve começar com `await requireAuth();`**. Login tem atraso e bloqueio após 5 erros.
- **Banco:** use migrations (`prisma/migrations`). Mudou o schema → gere o SQL com `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/N_nome/migration.sql` e aplique com `npm run db:migrate`. Não usar mais `db push`.
- **Lembretes:** `lib/reminders.ts` monta o resumo diário (contas e pendências de hoje/amanhã/atrasadas); `/api/cron/reminders` (Vercel Cron, 07h BRT, protegido por `CRON_SECRET`); envio via Resend (`RESEND_API_KEY`), sem chave vira log.
- **Rotinas:** `RecurringTask.kind` = `FINANCE` (conta fixa) ou `TASK` (gera card semanal/mensal, criado por `spawnDueRoutines` ao carregar o board).
- **Metas:** model `Goal` (alvo, guardado, aporte mensal, prazo); aporte/resgate vira lançamento pago na categoria "Metas".
- **Outros:** paleta `Ctrl/⌘+K` (`shared/CommandPalette`), importação CSV/OFX (`finances/importParser.ts` + `ImportModal`), backup JSON (`exportBackup`), PWA (`app/manifest.ts`, `public/sw.js`). Variáveis em `.env.example`.
- Novas lógicas de servidor vão em `app/actions.ts` na seção correspondente; novos componentes na pasta do domínio; tipos novos em `app/types`.
- Validar com `npx tsc --noEmit` (o `build` roda `prisma generate && next build`).

## Como quero que você responda
- Em português, direto ao ponto.
- Siga o visual escuro e os padrões já existentes; não troque bibliotecas sem motivo.
- Ao alterar o schema, lembre de `npx prisma migrate dev` / `prisma generate`.
- Mostre só os trechos alterados, indicando o arquivo e onde inserir.
