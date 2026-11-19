// lib/pends/core.ts
// Camada de dados do Pends, SEM autenticação e SEM "use server".
// Quem chama é responsável por checar o acesso:
//  - app/actions.ts → requireAuth() (cookie de sessão)
//  - app/api/mcp    → token OAuth (lib/oauth.ts)
// Nunca transforme este arquivo em "use server": exportaria tudo sem login.

import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { invoiceDueDate, invoiceFor, shiftMonthKey } from "../invoice";

export const CURRENT_USER = "Nicolas";

// Helper com trava de ano seguro (impede qualquer ano bizarro tipo 2078)
export function parseLocalDateToMidday(dateStr?: string | null): Date {
  if (!dateStr || !dateStr.trim()) return new Date();
  const clean = dateStr.trim();
  let year: number, month: number, day: number;

  if (clean.includes("-")) {
    const parts = clean.split("-").map(Number);
    if (parts[0] > 1000) {
      [year, month, day] = parts;
    } else {
      [day, month, year] = parts;
    }
  } else if (clean.includes("/")) {
    const parts = clean.split("/").map(Number);
    if (parts[0] > 1000) {
      [year, month, day] = parts;
    } else {
      [day, month, year] = parts;
    }
  } else {
    const d = new Date(clean);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }

  // TRAVA DEFINITIVA: se o ano for 2078 ou qualquer coisa fora da realidade, crava 2026!
  if (year > 2035 || year < 2020) {
    year = 2026;
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/** Igual ao parseLocalDateToMidday, mas vazio vira null (pendência "sem prazo"). */
export function parseOptionalDate(dateStr?: string | null): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  return parseLocalDateToMidday(dateStr);
}

export type TxType = "INCOME" | "EXPENSE";

export type PayMethod = "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT";

export type TxScope = "one" | "future" | "all";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function safeYearMonth(year?: number, month?: number) {
  const now = new Date();
  const y = year && year >= 2020 && year <= 2035 ? year : now.getFullYear();
  const m = month !== undefined && !isNaN(month) && month >= 0 && month <= 11 ? month : now.getMonth();
  return { year: y, month: m };
}

export function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

/** Hoje (data local do servidor) cravado ao meio-dia UTC, igual às datas gravadas. */
export function todayMidday() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0));
}

export function stripInstallmentSuffix(desc: string) {
  return desc.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
}

export const txInclude = {
  card: {
    select: {
      id: true,
      title: true,
      completed: true,
      column: { select: { title: true, isDone: true } },
    },
  },
  recurringTask: { select: { id: true, title: true } },
} as const;

/** Ocorrência da rotina no período atual (mês ou semana) e o intervalo desse período. */
export function routineOccurrence(r: { frequency: string; dueDay: number | null; weekday: number | null }, today: Date) {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  if (r.frequency === "WEEKLY") {
    const weekStart = new Date(Date.UTC(y, m, today.getUTCDate() - today.getUTCDay(), 0, 0, 0));
    const date = new Date(weekStart.getTime() + (r.weekday ?? 1) * 86400000 + 12 * 3600000);
    return { date, start: weekStart, end: new Date(weekStart.getTime() + 7 * 86400000 - 1) };
  }
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(y, m, Math.min(r.dueDay || 1, lastDay), 12));
  return { date, start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)) };
}

/** Cria (uma vez por período) o card de cada rotina ativa. Idempotente. */
export async function spawnDueRoutines() {
  const routines = await prisma.recurringTask.findMany({ where: { kind: "TASK", active: true } });
  if (routines.length === 0) return 0;

  const today = todayMidday();
  const firstCol = await prisma.column.findFirst({ where: { isDone: false }, orderBy: { order: "asc" } });
  if (!firstCol) return 0;

  let created = 0;
  for (const r of routines) {
    const occ = routineOccurrence(r, today);
    // Não cria ocorrência que venceu antes de a rotina existir
    const createdDay = Date.UTC(r.createdAt.getUTCFullYear(), r.createdAt.getUTCMonth(), r.createdAt.getUTCDate(), 12);
    if (occ.date.getTime() < createdDay) continue;

    const exists = await prisma.card.findFirst({
      where: { recurringTaskId: r.id, dueDate: { gte: occ.start, lte: occ.end } },
      select: { id: true },
    });
    if (exists) continue;

    const count = await prisma.card.count({ where: { columnId: firstCol.id } });
    await prisma.card.create({
      data: {
        title: r.title,
        columnId: firstCol.id,
        moduleId: r.moduleId,
        priority: r.priority || "Normal",
        dueDate: occ.date,
        order: count,
        recurringTaskId: r.id,
        description: `Rotina ${r.frequency === "WEEKLY" ? "semanal" : "mensal"} gerada automaticamente.`,
        history: { create: { action: "Sistema", details: "Gerada pela rotina recorrente", user: CURRENT_USER } },
      },
    });
    created++;
  }
  return created;
}

export interface TransactionInput {
  description: string;
  amount: number;
  type: TxType;
  category: string;
  paymentMethod: PayMethod;
  dueDate: string;
  notes?: string | null;
  paid?: boolean;
  cardId?: string | null;
  /** Cartão de crédito: com ele, `dueDate` é a DATA DA COMPRA e o vencimento sai da fatura */
  creditCardId?: string | null;
  /** Fatura escolhida à mão ("2026-12"). Vazio = calcula pela data da compra */
  invoiceMonth?: string | null;
}

export type CardCycleRow = { id: string; closingDay: number; dueDay: number };

/** Fatura de uma parcela: a escolhida à mão (andando `k` meses) ou a calculada pela data. */
export function placeOnInvoice(card: CardCycleRow, purchase: Date, k: number, chosen?: string | null) {
  if (chosen && /^\d{4}-\d{2}$/.test(chosen)) {
    const key = shiftMonthKey(chosen, k);
    return { invoiceMonth: key, dueDate: invoiceDueDate(card, key) };
  }
  return invoiceFor(card, purchase, k);
}

/** Cartão da compra (só se a forma for cartão e o cartão existir). */
export async function cardFor(data: { paymentMethod: string; creditCardId?: string | null }) {
  if (data.paymentMethod !== "CREDIT_CARD" || !data.creditCardId) return null;
  return prisma.creditCard.findUnique({ where: { id: data.creditCardId } });
}

/** Pagou a conta → conclui o card ligado (move para a etapa final). */
export async function completeLinkedCard(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: { column: true } });
  if (!card || card.completed) return;
  const doneCol = await prisma.column.findFirst({ where: { isDone: true }, orderBy: { order: "asc" } });
  await prisma.card.update({
    where: { id: cardId },
    data: {
      completed: true,
      completedAt: new Date(),
      ...(doneCol ? { columnId: doneCol.id } : {}),
      history: { create: { action: "Conclusão", details: "Concluída automaticamente: lançamento pago no financeiro", user: CURRENT_USER } },
    },
  });
}

/** Concluiu o card → marca como pagos os lançamentos ligados a ele. */
export async function payLinkedTransactions(cardId: string) {
  await prisma.transaction.updateMany({
    where: { cardId, paid: false },
    data: { paid: true, paidAt: new Date() },
  });
}

export async function getModulesCore() {
  let modules = await prisma.module.findMany({ orderBy: { createdAt: "asc" } });

  if (modules.length === 0) {
    const defaultModules = [
      { title: "Trabalho", color: "#3B82F6" },
      { title: "Contas de Casa", color: "#10B981" },
      { title: "Faculdade", color: "#8B5CF6" },
      { title: "Geral / Pessoal", color: "#F59E0B" }
    ];

    for (const mod of defaultModules) {
      await prisma.module.create({ data: mod });
    }
    modules = await prisma.module.findMany({ orderBy: { createdAt: "asc" } });
  }

  return modules;
}

export async function createCardCore(
  columnId: string, 
  title: string, 
  moduleId: string, 
  priority: string, 
  description: string,
  dueDate?: string,
  projectId?: string | null
) {
  const count = await prisma.card.count({ where: { columnId } });
  const col = await prisma.column.findUnique({ where: { id: columnId } });
  const isCompleted = col?.isDone ?? false;

  await prisma.card.create({
    data: {
      title,
      columnId,
      priority,
      moduleId: moduleId ? moduleId : null,
      description,
      dueDate: parseOptionalDate(dueDate),
      projectId: projectId || null,
      order: count,
      completed: isCompleted,
      completedAt: isCompleted ? new Date() : null,
      history: {
        create: {
          action: "Criação",
          details: `Pendência cadastrada`,
          user: CURRENT_USER
        }
      }
    }
  });
}

export async function toggleCardCompletionCore(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: { column: true } });
  if (!card) return;

  const nextState = !card.completed;
  let targetColumnId = card.columnId;

  if (nextState) {
    const doneCol = await prisma.column.findFirst({ where: { isDone: true }, orderBy: { order: "asc" } });
    if (doneCol) targetColumnId = doneCol.id;
  } else {
    if (card.column.isDone) {
      const firstCol = await prisma.column.findFirst({ orderBy: { order: "asc" } });
      if (firstCol) targetColumnId = firstCol.id;
    }
  }

  await prisma.card.update({
    where: { id: cardId },
    data: {
      completed: nextState,
      completedAt: nextState ? new Date() : null,
      columnId: targetColumnId,
      history: {
        create: {
          action: nextState ? "Conclusão" : "Reabertura",
          details: nextState ? "Marcou como concluída" : "Reabriu a pendência",
          user: CURRENT_USER
        }
      }
    }
  });
  if (nextState) await payLinkedTransactions(cardId);
}

export async function updateCardDetailsCore(
  id: string, 
  title: string, 
  description: string, 
  priority: string,
  dueDate: string,
  moduleId: string
) {
  await prisma.card.update({
    where: { id },
    data: {
      title,
      description,
      priority,
      dueDate: parseOptionalDate(dueDate),
      moduleId: moduleId ? moduleId : null
    }
  });
}

export async function createTransactionCore(
  data: TransactionInput & {
    isInstallment?: boolean;
    installmentsCount?: number;
    startInstallment?: number;
    /** "PARCEL": valor digitado é de cada parcela · "TOTAL": valor total dividido */
    amountMode?: "PARCEL" | "TOTAL";
  }
) {
  const description = data.description.trim();
  if (!description) throw new Error("Descrição obrigatória.");
  if (!(data.amount > 0)) throw new Error("Valor precisa ser maior que zero.");

  const parsedDate = parseLocalDateToMidday(data.dueDate);
  const total = Math.floor(data.installmentsCount || 1);
  const card = await cardFor(data);
  // Com cartão: a data digitada é a da compra; o vencimento é o da fatura em que cai
  const cardFields = (k: number) => {
    if (!card) return {};
    const inv = placeOnInvoice(card, parsedDate, k, data.invoiceMonth);
    return { creditCardId: card.id, purchaseDate: parsedDate, invoiceMonth: inv.invoiceMonth, dueDate: inv.dueDate };
  };
  const firstDue = card ? placeOnInvoice(card, parsedDate, 0, data.invoiceMonth).dueDate : parsedDate;

  if (data.isInstallment && total > 1) {
    const installmentId = randomUUID();
    const current = Math.min(Math.max(Math.floor(data.startInstallment || 1), 1), total);

    // Valor de cada parcela (centavos de ajuste vão para a última)
    let parcel = round2(data.amount);
    let lastParcel = parcel;
    if (data.amountMode === "TOTAL") {
      parcel = Math.floor((data.amount / total) * 100) / 100;
      lastParcel = round2(data.amount - parcel * (total - 1));
    }

    const records = [];
    for (let i = current; i <= total; i++) {
      const d = new Date(parsedDate);
      const targetMonth = d.getUTCMonth() + (i - current);
      const day = d.getUTCDate();
      const lastDayOfTarget = new Date(Date.UTC(d.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
      const due = new Date(Date.UTC(d.getUTCFullYear(), targetMonth, Math.min(day, lastDayOfTarget), 12));

      records.push({
        description: `${description} (${i}/${total})`,
        amount: i === total ? lastParcel : parcel,
        type: data.type,
        category: data.category,
        paymentMethod: data.paymentMethod,
        dueDate: due,
        notes: data.notes || null,
        paid: i === current ? Boolean(data.paid) : false,
        paidAt: i === current && data.paid ? new Date() : null,
        isInstallment: true,
        installmentCurrent: i,
        installmentTotal: total,
        installmentId,
        ...cardFields(i - current),
      });
    }
    await prisma.transaction.createMany({ data: records });
  } else {
    await prisma.transaction.create({
      data: {
        description,
        amount: round2(data.amount),
        type: data.type,
        category: data.category,
        paymentMethod: data.paymentMethod,
        dueDate: parsedDate,
        notes: data.notes || null,
        paid: Boolean(data.paid),
        paidAt: data.paid ? new Date() : null,
        cardId: data.cardId || null,
        ...cardFields(0),
      },
    });
  }
  return { success: true, year: firstDue.getUTCFullYear(), month: firstDue.getUTCMonth() };
}

/**
 * Tudo que pede atenção, num lugar só: contas a pagar, entradas a receber e
 * pendências com prazo — atrasadas, de hoje e dos próximos dias — e o resumo do mês.
 */
export async function getTodayOverviewCore() {
  await spawnDueRoutines();

  const today = todayMidday();
  const in30 = new Date(today.getTime() + 30 * 86400000);
  const in14 = new Date(today.getTime() + 14 * 86400000);
  const { start, end } = monthRange(today.getUTCFullYear(), today.getUTCMonth());

  const [bills, incomes, cards, monthTxs] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: { not: "INCOME" }, paid: false, dueDate: { lte: in30 } },
      include: txInclude,
      orderBy: { dueDate: "asc" },
      take: 200,
    }),
    prisma.transaction.findMany({
      where: { type: "INCOME", paid: false, dueDate: { lte: in30 } },
      include: txInclude,
      orderBy: { dueDate: "asc" },
      take: 100,
    }),
    prisma.card.findMany({
      where: { completed: false, column: { isDone: false }, dueDate: { not: null, lte: in14 } },
      include: { module: true, project: true, column: { select: { title: true } } },
      orderBy: [{ dueDate: "asc" }, { order: "asc" }],
      take: 200,
    }),
    prisma.transaction.findMany({
      where: { dueDate: { gte: start, lte: end } },
      select: { amount: true, type: true, paid: true },
    }),
  ]);

  let income = 0, incomeReceived = 0, expense = 0, expensePaid = 0;
  for (const t of monthTxs) {
    if (t.type === "INCOME") {
      income += t.amount;
      if (t.paid) incomeReceived += t.amount;
    } else {
      expense += t.amount;
      if (t.paid) expensePaid += t.amount;
    }
  }

  return {
    today,
    bills,
    incomes,
    cards,
    month: {
      year: today.getUTCFullYear(),
      month: today.getUTCMonth(),
      income: round2(income),
      incomeReceived: round2(incomeReceived),
      expense: round2(expense),
      expensePaid: round2(expensePaid),
      balance: round2(income - expense),
    },
  };
}

/**
 * O que ocupa o limite do cartão: tudo em aberto, menos cobranças de contas fixas
 * (assinaturas) que ainda não caíram — essas só entram no limite no dia da cobrança.
 */
export function cardLimitWhere(today: Date) {
  return {
    paid: false,
    OR: [{ recurringTaskId: null }, { purchaseDate: null }, { purchaseDate: { lte: today } }],
  };
}

/**
 * Contas fixas no cartão (assinaturas): quando chega o dia da cobrança, lança a compra
 * no cartão, na fatura certa. Uma vez por mês por conta; idempotente.
 * Roda ao abrir o app e no cron diário.
 */
export async function spawnDueCardCharges(today: Date = todayMidday()) {
  const recs = await prisma.recurringTask.findMany({
    where: { kind: "FINANCE", active: true, paymentMethod: "CREDIT_CARD", creditCardId: { not: null }, amount: { gt: 0 } },
    include: { creditCard: true, module: { select: { title: true } } },
  });
  if (recs.length === 0) return 0;

  let created = 0;
  for (const r of recs) {
    if (!r.creditCard || !r.amount) continue;
    const occ = routineOccurrence({ frequency: "MONTHLY", dueDay: r.dueDay, weekday: null }, today);
    if (occ.date.getTime() > today.getTime()) continue; // ainda não caiu
    // Não cria cobrança de um dia anterior à conta existir
    const createdDay = Date.UTC(r.createdAt.getUTCFullYear(), r.createdAt.getUTCMonth(), r.createdAt.getUTCDate(), 12);
    if (occ.date.getTime() < createdDay) continue;

    const exists = await prisma.transaction.findFirst({
      where: { recurringTaskId: r.id, purchaseDate: { gte: occ.start, lte: occ.end } },
      select: { id: true },
    });
    if (exists) continue;

    const { invoiceMonth, dueDate } = invoiceFor(r.creditCard, occ.date);
    await prisma.transaction.create({
      data: {
        description: r.title,
        amount: round2(r.amount),
        type: r.type === "INCOME" ? "INCOME" : "EXPENSE",
        category: r.module?.title ?? "Geral",
        paymentMethod: "CREDIT_CARD",
        dueDate,
        paid: false,
        creditCardId: r.creditCard.id,
        purchaseDate: occ.date,
        invoiceMonth,
        recurringTaskId: r.id,
      },
    });
    created++;
  }
  return created;
}
