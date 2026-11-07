"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../lib/prisma";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const CURRENT_USER = "Nicolas";

// Helper com trava de ano seguro (impede qualquer ano bizarro tipo 2078)
function parseLocalDateToMidday(dateStr?: string | null): Date {
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
function parseOptionalDate(dateStr?: string | null): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  return parseLocalDateToMidday(dateStr);
}

// ==========================================
// 0. AUTENTICAÇÃO SEGURA (SERVER-SIDE)
// ==========================================

export async function loginAction(email: string, pass: string) {
  const validEmail = process.env.AUTH_EMAIL;
  const validPass = process.env.AUTH_PASSWORD;

  if (!validEmail || !validPass) {
    return { 
      success: false, 
      error: "Variáveis de ambiente AUTH_EMAIL ou AUTH_PASSWORD não foram configuradas no servidor." 
    };
  }

  if (email.trim().toLowerCase() === validEmail.trim().toLowerCase() && pass === validPass) {
    const cookieStore = await cookies();
    cookieStore.set("pends_session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 dias de sessão ativa
    });
    return { success: true };
  }

  return { success: false, error: "Credenciais inválidas. Verifique usuário e senha." };
}

export async function checkAuthSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("pends_session");
  return session?.value === "authenticated";
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("pends_session");
  revalidatePath("/");
}

// ==========================================
// 1. MÓDULOS DE VIDA
// ==========================================

export async function getModules() {
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

export async function createModule(title: string, color: string) {
  await prisma.module.create({ data: { title, color: color.toUpperCase() } });
  revalidatePath("/");
}

export async function updateModule(id: string, title: string, color: string) {
  await prisma.module.update({
    where: { id },
    data: { title, color: color.toUpperCase() }
  });
  revalidatePath("/");
}

export async function deleteModule(id: string) {
  await prisma.card.updateMany({
    where: { moduleId: id },
    data: { moduleId: null }
  });
  await prisma.recurringTask.updateMany({
    where: { moduleId: id },
    data: { moduleId: null }
  });
  await prisma.module.delete({ where: { id } });
  revalidatePath("/");
}

// ==========================================
// 2. COLUNAS DO KANBAN
// ==========================================

export async function createColumn(title: string, isDone = false) {
  const board = await prisma.board.findFirst();
  if (!board) return;
  const count = await prisma.column.count({ where: { boardId: board.id } });
  await prisma.column.create({
    data: { title, isDone, boardId: board.id, order: count }
  });
  revalidatePath("/");
}

export async function updateColumn(id: string, title: string, isDone?: boolean) {
  await prisma.column.update({
    where: { id },
    data: { 
      title,
      ...(isDone !== undefined ? { isDone } : {})
    }
  });
  revalidatePath("/");
}

export async function deleteColumn(id: string) {
  await prisma.card.deleteMany({ where: { columnId: id } });
  await prisma.column.delete({ where: { id } });
  revalidatePath("/");
}

// ==========================================
// 3. QUADRO KANBAN
// ==========================================

const boardInclude = {
  columns: {
    include: { 
      cards: { 
        include: { module: true },
        orderBy: { order: "asc" as const } 
      } 
    },
    orderBy: { order: "asc" as const }
  }
};

export async function getBoardData() {
  try {
    let board = await prisma.board.findFirst({
      include: boardInclude
    });

    if (!board) {
      board = await prisma.board.create({
        data: {
          title: "Painel Pends",
          columns: {
            create: [
              { title: "📥 Solicitação", order: 0, isDone: false },
              { title: "⚙️ Preparação", order: 1, isDone: false },
              { title: "✅ Conclusão", order: 2, isDone: true },
            ]
          }
        },
        include: boardInclude
      });
    }

    return board;
  } catch (error) {
    console.error("Erro no banco:", error);
    return null;
  }
}

// ==========================================
// 4. ANALYTICS & MÉTRICAS
// ==========================================

export async function getDashboardStats() {
  const cards = await prisma.card.findMany({
    include: { module: true, column: true }
  });
  const modules = await prisma.module.findMany();

  const now = new Date();
  const total = cards.length;
  
  const completed = cards.filter(c => c.completed || c.column?.isDone).length;
  const inProgress = cards.filter(c => !c.completed && !c.column?.isDone && c.column?.order !== 0).length;
  const todo = total - completed - inProgress;
  const urgent = cards.filter(c => c.priority === "Urgente" && !c.completed && !c.column?.isDone).length;
  const overdue = cards.filter(c => c.dueDate && new Date(c.dueDate) < now && !c.completed && !c.column?.isDone).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const moduleMetrics = modules.map(m => {
    const modCards = cards.filter(c => c.moduleId === m.id);
    const modDone = modCards.filter(c => c.completed || c.column?.isDone).length;
    return {
      id: m.id,
      title: m.title,
      color: m.color,
      total: modCards.length,
      done: modDone,
      pending: modCards.length - modDone,
      percent: modCards.length > 0 ? Math.round((modDone / modCards.length) * 100) : 0
    };
  });

  const upcomingDeadlines = cards
    .filter(c => c.dueDate && !c.completed && !c.column?.isDone)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5)
    .map(c => ({
      id: c.id,
      title: c.title,
      dueDate: c.dueDate,
      priority: c.priority,
      moduleName: c.module?.title || "Geral",
      moduleColor: c.module?.color || "#64748b"
    }));

  return { total, completed, inProgress, todo, urgent, overdue, completionRate, moduleMetrics, upcomingDeadlines };
}

// ==========================================
// 5. CARDS / PENDÊNCIAS
// ==========================================

export async function createCard(
  columnId: string, 
  title: string, 
  moduleId: string, 
  priority: string, 
  description: string, 
  dueDate?: string
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
  revalidatePath("/");
}

export async function moveCard(cardId: string, newColumnId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: { column: true } });
  const newCol = await prisma.column.findUnique({ where: { id: newColumnId } });

  if (card && newCol && card.columnId !== newColumnId) {
    const isNowCompleted = newCol.isDone;

    await prisma.card.update({
      where: { id: cardId },
      data: {
        columnId: newColumnId,
        completed: isNowCompleted,
        completedAt: isNowCompleted ? (card.completedAt ?? new Date()) : null,
        history: {
          create: {
            action: isNowCompleted ? "Conclusão" : "Movimento",
            details: `Moveu para "${newCol.title}" ${isNowCompleted ? "(Finalizado)" : ""}`,
            user: CURRENT_USER
          }
        }
      }
    });
    if (isNowCompleted && !card.completed) await payLinkedTransactions(cardId);
  }
  revalidatePath("/");
}

/**
 * Drag & drop com posição: grava a nova ordem completa da coluna de destino.
 * Se o card mudou de coluna, atualiza status/histórico também.
 */
export async function reorderColumnCards(columnId: string, orderedIds: string[], movedCardId: string) {
  const [card, col] = await Promise.all([
    prisma.card.findUnique({ where: { id: movedCardId } }),
    prisma.column.findUnique({ where: { id: columnId } }),
  ]);
  if (!card || !col) return;

  const changedColumn = card.columnId !== columnId;
  const nowCompleted = col.isDone;

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.card.update({
        where: { id },
        data:
          id === movedCardId && changedColumn
            ? {
                order: idx,
                columnId,
                completed: nowCompleted,
                completedAt: nowCompleted ? (card.completedAt ?? new Date()) : null,
                history: {
                  create: {
                    action: nowCompleted ? "Conclusão" : "Movimento",
                    details: `Moveu para "${col.title}" ${nowCompleted ? "(Finalizado)" : ""}`.trim(),
                    user: CURRENT_USER,
                  },
                },
              }
            : { order: idx },
      })
    )
  );

  if (changedColumn && nowCompleted && !card.completed) await payLinkedTransactions(movedCardId);
  revalidatePath("/");
}

/** Criação rápida direto na coluna (só título). */
export async function quickCreateCard(columnId: string, title: string, moduleId?: string | null) {
  const clean = title.trim();
  if (!clean) return;
  const [count, col] = await Promise.all([
    prisma.card.count({ where: { columnId } }),
    prisma.column.findUnique({ where: { id: columnId } }),
  ]);
  await prisma.card.create({
    data: {
      title: clean,
      columnId,
      moduleId: moduleId || null,
      order: count,
      completed: col?.isDone ?? false,
      completedAt: col?.isDone ? new Date() : null,
      history: { create: { action: "Criação", details: "Criada pela adição rápida", user: CURRENT_USER } },
    },
  });
  revalidatePath("/");
}

export async function toggleCardCompletion(cardId: string) {
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
  revalidatePath("/");
}

export async function updateCardModule(cardId: string, moduleId: string | null) {
  await prisma.card.update({
    where: { id: cardId },
    data: { moduleId: moduleId ? moduleId : null }
  });
  revalidatePath("/");
}

export async function getCardDetails(cardId: string) {
  return await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      module: true,
      column: true,
      history: { orderBy: { timestamp: "desc" } },
      comments: { orderBy: { createdAt: "desc" } }
    }
  });
}

export async function updateCardDetails(
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
  revalidatePath("/");
}

export async function deleteCard(id: string) {
  await prisma.card.delete({ where: { id } });
  revalidatePath("/");
}

export async function addComment(cardId: string, text: string) {
  await prisma.comment.create({
    data: { text, cardId, user: CURRENT_USER }
  });
  revalidatePath("/");
}

// ==========================================
// 6. CONTAS FIXAS (ROTINAS RECORRENTES)
// ==========================================

export async function getRecurringTasks() {
  return await prisma.recurringTask.findMany({
    include: {
      module: true,
      cards: {
        include: { column: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { dueDay: "asc" },
  });
}

export interface RecurringInput {
  title: string;
  amount: number | null;
  dueDay: number | null;
  moduleId: string | null;
  type?: "INCOME" | "EXPENSE";
  paymentMethod?: PayMethod;
  active?: boolean;
}

function cleanRecurring(data: RecurringInput) {
  const dueDay = data.dueDay ? Math.min(Math.max(Math.round(data.dueDay), 1), 31) : null;
  return {
    title: data.title.trim(),
    amount: data.amount !== null && !isNaN(data.amount) ? round2(data.amount) : null,
    dueDay,
    moduleId: data.moduleId ? data.moduleId : null,
    ...(data.type ? { type: data.type } : {}),
    ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
  };
}

export async function createRecurringTask(data: RecurringInput) {
  await prisma.recurringTask.create({ data: cleanRecurring(data) });
  revalidatePath("/");
}

export async function updateRecurringTask(id: string, data: RecurringInput) {
  await prisma.recurringTask.update({ where: { id }, data: cleanRecurring(data) });
  revalidatePath("/");
}

export async function toggleRecurringActive(id: string) {
  const r = await prisma.recurringTask.findUnique({ where: { id }, select: { active: true } });
  if (!r) return;
  await prisma.recurringTask.update({ where: { id }, data: { active: !r.active } });
  revalidatePath("/");
}

export async function deleteRecurringTask(id: string) {
  // Mantém o histórico: cards e lançamentos já gerados só perdem o vínculo
  await prisma.card.updateMany({ where: { recurringTaskId: id }, data: { recurringTaskId: null } });
  await prisma.transaction.updateMany({ where: { recurringTaskId: id }, data: { recurringTaskId: null } });
  await prisma.recurringTask.delete({ where: { id } });
  revalidatePath("/");
}

// ==========================================
// 7. FINANÇAS — CONTROLADOR
// ==========================================

type TxType = "INCOME" | "EXPENSE";
type PayMethod = "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT";
export type TxScope = "one" | "future" | "all";

const round2 = (n: number) => Math.round(n * 100) / 100;

function safeYearMonth(year?: number, month?: number) {
  const now = new Date();
  const y = year && year >= 2020 && year <= 2035 ? year : now.getFullYear();
  const m = month !== undefined && !isNaN(month) && month >= 0 && month <= 11 ? month : now.getMonth();
  return { year: y, month: m };
}

function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

/** Hoje (data local do servidor) cravado ao meio-dia UTC, igual às datas gravadas. */
function todayMidday() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0));
}

function stripInstallmentSuffix(desc: string) {
  return desc.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
}

const txInclude = {
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

// Auto-cura do antigo bug de datas em 2078 (barato: uma consulta por faixa)
async function healBuggedDates() {
  try {
    const bugged = await prisma.transaction.findMany({
      where: { dueDate: { gte: new Date(Date.UTC(2036, 0, 1)) } },
      select: { id: true, dueDate: true },
    });
    for (const item of bugged) {
      const fixed = new Date(item.dueDate);
      fixed.setUTCFullYear(2026);
      await prisma.transaction.update({ where: { id: item.id }, data: { dueDate: fixed } });
    }
  } catch (e) {
    console.error("Erro na auto-cura de datas:", e);
  }
}

/** Painel completo do mês: lançamentos, resumo, módulos, projeção, parcelas e contas fixas. */
export async function getFinanceOverview(yearArg?: number, monthArg?: number) {
  await healBuggedDates();

  const { year, month } = safeYearMonth(yearArg, monthArg);
  const { start, end } = monthRange(year, month);
  const today = todayMidday();
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

  const projStart = start;
  const projEnd = monthRange(year, month + 5).end;

  const [transactions, carryOver, modules, recurring, projectionTxs, installmentTxs] = await Promise.all([
    prisma.transaction.findMany({
      where: { dueDate: { gte: start, lte: end } },
      include: txInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    // Pendências esquecidas de meses anteriores (só interessam do mês atual pra frente)
    year * 12 + month >= now.getFullYear() * 12 + now.getMonth()
      ? prisma.transaction.findMany({
          where: { paid: false, dueDate: { lt: start } },
          include: txInclude,
          orderBy: { dueDate: "asc" },
          take: 100,
        })
      : Promise.resolve([]),
    prisma.module.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.recurringTask.findMany({ include: { module: true }, orderBy: { dueDay: "asc" } }),
    prisma.transaction.findMany({
      where: { dueDate: { gte: projStart, lte: projEnd } },
      select: { amount: true, type: true, dueDate: true, recurringTaskId: true, isInstallment: true, paymentMethod: true },
    }),
    prisma.transaction.findMany({
      where: { isInstallment: true, installmentId: { not: null } },
      select: {
        id: true, description: true, amount: true, dueDate: true, paid: true, type: true,
        paymentMethod: true, category: true, installmentId: true, installmentCurrent: true, installmentTotal: true,
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  // ---------- RESUMO DO MÊS ----------
  let incomeTotal = 0, incomeReceived = 0, expenseTotal = 0, expensePaid = 0;
  let overdueAmount = 0, overdueCount = 0, creditCardTotal = 0, creditCardPending = 0;

  for (const t of transactions) {
    if (t.type === "INCOME") {
      incomeTotal += t.amount;
      if (t.paid) incomeReceived += t.amount;
    } else {
      expenseTotal += t.amount;
      if (t.paid) expensePaid += t.amount;
      if (t.paymentMethod === "CREDIT_CARD") {
        creditCardTotal += t.amount;
        if (!t.paid) creditCardPending += t.amount;
      }
      if (!t.paid && t.dueDate < today) {
        overdueAmount += t.amount;
        overdueCount++;
      }
    }
  }
  const carryOverExpense = carryOver.filter((t) => t.type !== "INCOME");
  const carryOverAmount = carryOverExpense.reduce((s, t) => s + t.amount, 0);

  // ---------- CONTAS FIXAS x MÊS ----------
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const recurringStatus = recurring.map((r) => {
    const launched =
      transactions.find((t) => t.recurringTaskId === r.id) ??
      transactions.find(
        (t) => !t.recurringTaskId && t.description.trim().toLowerCase() === r.title.trim().toLowerCase()
      ) ??
      null;
    return {
      id: r.id,
      title: r.title,
      amount: r.amount,
      dueDay: r.dueDay,
      active: r.active,
      type: (r.type as TxType) ?? "EXPENSE",
      paymentMethod: r.paymentMethod,
      moduleId: r.moduleId,
      module: r.module ? { id: r.module.id, title: r.module.title, color: r.module.color } : null,
      dueDate: new Date(Date.UTC(year, month, Math.min(r.dueDay || 10, lastDay), 12)),
      launchedTxId: launched?.id ?? null,
      launchedPaid: launched?.paid ?? false,
      launchedAmount: launched?.amount ?? null,
    };
  });
  const pendingRecurring = recurringStatus.filter((r) => r.active && r.amount && !r.launchedTxId);
  const recurringPendingExpense = pendingRecurring.filter((r) => r.type !== "INCOME").reduce((s, r) => s + (r.amount || 0), 0);
  const recurringPendingIncome = pendingRecurring.filter((r) => r.type === "INCOME").reduce((s, r) => s + (r.amount || 0), 0);

  // ---------- SALDOS ----------
  const balancePlanned = incomeTotal + recurringPendingIncome - expenseTotal - recurringPendingExpense;
  const balanceRealized = incomeReceived - expensePaid;
  const daysInMonth = lastDay;
  const remainingDays = isCurrentMonth ? Math.max(daysInMonth - now.getDate() + 1, 1) : daysInMonth;
  const freeToSpend = balancePlanned - carryOverAmount;
  const safeDailySpend = freeToSpend > 0 ? round2(freeToSpend / remainingDays) : 0;

  // ---------- GASTOS POR MÓDULO / ORÇAMENTO ----------
  const catMap = new Map<string, { spent: number; paid: number; count: number }>();
  for (const t of transactions) {
    if (t.type === "INCOME") continue;
    const key = t.category || "Geral";
    const cur = catMap.get(key) ?? { spent: 0, paid: 0, count: 0 };
    cur.spent += t.amount;
    if (t.paid) cur.paid += t.amount;
    cur.count++;
    catMap.set(key, cur);
  }
  const byModule = [
    ...modules.map((m) => {
      const c = catMap.get(m.title);
      catMap.delete(m.title);
      return {
        key: m.title,
        moduleId: m.id as string | null,
        color: m.color,
        budget: m.budget,
        spent: round2(c?.spent ?? 0),
        paid: round2(c?.paid ?? 0),
        count: c?.count ?? 0,
      };
    }),
    ...[...catMap.entries()].map(([key, c]) => ({
      key,
      moduleId: null as string | null,
      color: "#64748b",
      budget: null as number | null,
      spent: round2(c.spent),
      paid: round2(c.paid),
      count: c.count,
    })),
  ]
    .filter((m) => m.spent > 0 || (m.budget ?? 0) > 0)
    .sort((a, b) => b.spent - a.spent);

  // ---------- PROJEÇÃO (mês visto + 5) ----------
  const projection = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(Date.UTC(year, month + i, 1));
    const py = d.getUTCFullYear();
    const pm = d.getUTCMonth();
    const r = monthRange(py, pm);
    const inMonth = projectionTxs.filter((t) => t.dueDate >= r.start && t.dueDate <= r.end);
    const launchedIds = new Set(inMonth.map((t) => t.recurringTaskId).filter(Boolean));
    let income = 0, expense = 0, installments = 0, card = 0, fixedVirtual = 0;
    for (const t of inMonth) {
      if (t.type === "INCOME") income += t.amount;
      else {
        expense += t.amount;
        if (t.isInstallment) installments += t.amount;
        if (t.paymentMethod === "CREDIT_CARD") card += t.amount;
      }
    }
    // Contas fixas ativas ainda não lançadas naquele mês entram como previsão
    for (const rec of recurring) {
      if (!rec.active || !rec.amount || launchedIds.has(rec.id)) continue;
      if (i === 0 && recurringStatus.find((s) => s.id === rec.id)?.launchedTxId) continue;
      if (rec.type === "INCOME") income += rec.amount;
      else {
        expense += rec.amount;
        fixedVirtual += rec.amount;
      }
    }
    return {
      year: py,
      month: pm,
      income: round2(income),
      expense: round2(expense),
      installments: round2(installments),
      card: round2(card),
      fixedForecast: round2(fixedVirtual),
      balance: round2(income - expense),
    };
  });

  // ---------- PARCELAMENTOS ATIVOS ----------
  const groups = new Map<string, typeof installmentTxs>();
  for (const t of installmentTxs) {
    const list = groups.get(t.installmentId!) ?? [];
    list.push(t);
    groups.set(t.installmentId!, list);
  }
  const installments = [...groups.entries()]
    .map(([installmentId, list]) => {
      const unpaid = list.filter((t) => !t.paid);
      const first = list[0];
      const total = first.installmentTotal ?? list.length;
      return {
        installmentId,
        description: stripInstallmentSuffix(first.description),
        category: first.category,
        paymentMethod: first.paymentMethod,
        type: first.type,
        parcelAmount: round2(unpaid[0]?.amount ?? first.amount),
        totalCount: total,
        paidCount: total - unpaid.length,
        remainingCount: unpaid.length,
        remainingAmount: round2(unpaid.reduce((s, t) => s + t.amount, 0)),
        totalAmount: round2(list.reduce((s, t) => s + t.amount, 0)),
        nextDueDate: unpaid[0]?.dueDate ?? null,
        nextTxId: unpaid[0]?.id ?? null,
        lastDueDate: list[list.length - 1].dueDate,
      };
    })
    .filter((g) => g.remainingCount > 0)
    .sort((a, b) => (a.nextDueDate?.getTime() ?? 0) - (b.nextDueDate?.getTime() ?? 0));

  return {
    year,
    month,
    isCurrentMonth,
    transactions,
    carryOver,
    recurring: recurringStatus,
    byModule,
    projection,
    installments,
    summary: {
      incomeTotal: round2(incomeTotal),
      incomeReceived: round2(incomeReceived),
      expenseTotal: round2(expenseTotal),
      expensePaid: round2(expensePaid),
      expensePending: round2(expenseTotal - expensePaid),
      overdueAmount: round2(overdueAmount + carryOverAmount),
      overdueCount: overdueCount + carryOverExpense.length,
      creditCardTotal: round2(creditCardTotal),
      creditCardPending: round2(creditCardPending),
      recurringPendingExpense: round2(recurringPendingExpense),
      recurringPendingIncome: round2(recurringPendingIncome),
      recurringPendingCount: pendingRecurring.length,
      balancePlanned: round2(balancePlanned),
      balanceRealized: round2(balanceRealized),
      safeDailySpend,
      remainingDays,
    },
  };
}

/** Compatibilidade: lista simples dos lançamentos reais do mês. */
export async function getTransactions(year?: number, month?: number) {
  const { year: y, month: m } = safeYearMonth(year, month);
  const { start, end } = monthRange(y, m);
  return prisma.transaction.findMany({
    where: { dueDate: { gte: start, lte: end } },
    include: txInclude,
    orderBy: { dueDate: "asc" },
  });
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
}

export async function createTransaction(
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
      },
    });
  }

  revalidatePath("/");
  return { success: true, year: parsedDate.getUTCFullYear(), month: parsedDate.getUTCMonth() };
}

export async function updateTransaction(id: string, data: TransactionInput, scope: TxScope = "one") {
  const current = await prisma.transaction.findUnique({ where: { id } });
  if (!current) throw new Error("Lançamento não encontrado.");

  const parsedDate = parseLocalDateToMidday(data.dueDate);
  const description = data.description.trim();

  if (current.isInstallment && current.installmentId && scope !== "one") {
    const base = stripInstallmentSuffix(description);
    const shiftMs = parsedDate.getTime() - current.dueDate.getTime();
    const siblings = await prisma.transaction.findMany({
      where: {
        installmentId: current.installmentId,
        ...(scope === "future" ? { installmentCurrent: { gte: current.installmentCurrent ?? 0 } } : {}),
      },
    });
    await prisma.$transaction(
      siblings.map((s) =>
        prisma.transaction.update({
          where: { id: s.id },
          data: {
            description: `${base} (${s.installmentCurrent}/${s.installmentTotal})`,
            amount: round2(data.amount),
            type: data.type,
            category: data.category,
            paymentMethod: data.paymentMethod,
            dueDate: new Date(s.dueDate.getTime() + shiftMs),
            notes: data.notes || null,
            ...(s.id === id && data.paid !== undefined
              ? { paid: data.paid, paidAt: data.paid ? current.paidAt ?? new Date() : null }
              : {}),
          },
        })
      )
    );
  } else {
    await prisma.transaction.update({
      where: { id },
      data: {
        description,
        amount: round2(data.amount),
        type: data.type,
        category: data.category,
        paymentMethod: data.paymentMethod,
        dueDate: parsedDate,
        notes: data.notes || null,
        ...(data.cardId !== undefined ? { cardId: data.cardId || null } : {}),
        ...(data.paid !== undefined
          ? { paid: data.paid, paidAt: data.paid ? current.paidAt ?? new Date() : null }
          : {}),
      },
    });
  }

  if (data.paid && !current.paid && current.cardId) await completeLinkedCard(current.cardId);

  revalidatePath("/");
  return { success: true, year: parsedDate.getUTCFullYear(), month: parsedDate.getUTCMonth() };
}

export async function toggleTransactionPaid(id: string) {
  const current = await prisma.transaction.findUnique({ where: { id }, select: { paid: true, cardId: true } });
  if (!current) return { success: false };

  await prisma.transaction.update({
    where: { id },
    data: { paid: !current.paid, paidAt: !current.paid ? new Date() : null },
  });
  if (!current.paid && current.cardId) await completeLinkedCard(current.cardId);

  revalidatePath("/");
  return { success: true };
}

/** Marca/desmarca vários lançamentos de uma vez (ex.: pagar a fatura inteira). */
export async function setTransactionsPaid(ids: string[], paid: boolean) {
  if (ids.length === 0) return { success: true };
  await prisma.transaction.updateMany({
    where: { id: { in: ids }, paid: !paid },
    data: { paid, paidAt: paid ? new Date() : null },
  });
  if (paid) {
    const linked = await prisma.transaction.findMany({
      where: { id: { in: ids }, cardId: { not: null } },
      select: { cardId: true },
    });
    for (const l of linked) await completeLinkedCard(l.cardId!);
  }
  revalidatePath("/");
  return { success: true };
}

export async function deleteTransaction(id: string, scope: TxScope | boolean = "one") {
  const normalized: TxScope = scope === true ? "all" : scope === false ? "one" : scope;
  const item = await prisma.transaction.findUnique({
    where: { id },
    select: { installmentId: true, isInstallment: true, installmentCurrent: true },
  });
  if (!item) return { success: false };

  if (normalized !== "one" && item.isInstallment && item.installmentId) {
    await prisma.transaction.deleteMany({
      where: {
        installmentId: item.installmentId,
        ...(normalized === "future" ? { installmentCurrent: { gte: item.installmentCurrent ?? 0 } } : {}),
      },
    });
  } else {
    await prisma.transaction.delete({ where: { id } });
  }

  revalidatePath("/");
  return { success: true };
}

/** Lança no mês as contas fixas ativas que ainda não foram lançadas (ou só as escolhidas). */
export async function launchRecurringForMonth(yearArg: number, monthArg: number, onlyIds?: string[]) {
  const { year, month } = safeYearMonth(yearArg, monthArg);
  const { start, end } = monthRange(year, month);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const recurring = await prisma.recurringTask.findMany({
    where: {
      amount: { not: null },
      ...(onlyIds && onlyIds.length ? { id: { in: onlyIds } } : { active: true }),
    },
    include: { module: true },
  });
  if (recurring.length === 0) return { created: 0 };

  const existing = await prisma.transaction.findMany({
    where: { dueDate: { gte: start, lte: end } },
    select: { recurringTaskId: true, description: true },
  });
  const launchedIds = new Set(existing.map((e) => e.recurringTaskId).filter(Boolean));
  const names = new Set(existing.filter((e) => !e.recurringTaskId).map((e) => e.description.trim().toLowerCase()));

  const toCreate = recurring
    .filter((r) => !launchedIds.has(r.id) && !names.has(r.title.trim().toLowerCase()))
    .map((r) => ({
      description: r.title,
      amount: round2(r.amount || 0),
      type: r.type || "EXPENSE",
      category: r.module?.title || "Geral",
      paymentMethod: r.paymentMethod || "BOLETO",
      dueDate: new Date(Date.UTC(year, month, Math.min(r.dueDay || 10, lastDay), 12)),
      recurringTaskId: r.id,
    }));

  if (toCreate.length) await prisma.transaction.createMany({ data: toCreate });
  revalidatePath("/");
  return { created: toCreate.length };
}

export async function setModuleBudget(moduleId: string, budget: number | null) {
  await prisma.module.update({
    where: { id: moduleId },
    data: { budget: budget && budget > 0 ? round2(budget) : null },
  });
  revalidatePath("/");
}

/** Cria uma pendência no Kanban ligada ao lançamento (pagar = concluir card). */
export async function sendTransactionToKanban(id: string) {
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) return { success: false };
  if (tx.cardId) return { success: true, cardId: tx.cardId };

  const firstCol = await prisma.column.findFirst({ where: { isDone: false }, orderBy: { order: "asc" } });
  if (!firstCol) return { success: false };
  const mod = await prisma.module.findFirst({ where: { title: tx.category } });
  const count = await prisma.card.count({ where: { columnId: firstCol.id } });
  const value = tx.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const card = await prisma.card.create({
    data: {
      title: `${tx.type === "INCOME" ? "Receber" : "Pagar"}: ${tx.description} (${value})`,
      description: `Gerado pelo Hub Financeiro.\nValor: ${value}${tx.notes ? `\n\n${tx.notes}` : ""}`,
      priority: "Alta",
      dueDate: tx.dueDate,
      columnId: firstCol.id,
      moduleId: mod?.id ?? null,
      recurringTaskId: tx.recurringTaskId,
      order: count,
      history: { create: { action: "Sistema", details: "Criado a partir de um lançamento financeiro", user: CURRENT_USER } },
    },
  });
  await prisma.transaction.update({ where: { id }, data: { cardId: card.id } });
  revalidatePath("/");
  return { success: true, cardId: card.id };
}

/** Pagou a conta → conclui o card ligado (move para a etapa final). */
async function completeLinkedCard(cardId: string) {
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
async function payLinkedTransactions(cardId: string) {
  await prisma.transaction.updateMany({
    where: { cardId, paid: false },
    data: { paid: true, paidAt: new Date() },
  });
}

export async function getKanbanCardsForSelect() {
  return await prisma.card.findMany({
    select: { id: true, title: true, column: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ==========================================
// 8. REORDENAÇÃO DE COLUNAS DO KANBAN
// ==========================================

export async function moveColumn(columnId: string, direction: "left" | "right") {
  const board = await prisma.board.findFirst({
    include: { columns: { orderBy: { order: "asc" } } }
  });
  if (!board) return;

  const cols = [...board.columns];
  const index = cols.findIndex((c) => c.id === columnId);
  if (index === -1) return;

  const targetIndex = direction === "left" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= cols.length) return;

  const temp = cols[index];
  cols[index] = cols[targetIndex];
  cols[targetIndex] = temp;

  await prisma.$transaction(
    cols.map((col, idx) =>
      prisma.column.update({
        where: { id: col.id },
        data: { order: idx },
      })
    )
  );

  revalidatePath("/");
}