"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../lib/prisma";
import { cookies } from "next/headers";

const CURRENT_USER = "Nicolas";

// Função para cravar a data ao meio-dia (elimina o bug do fuso horário UTC-3 no Brasil)
function parseLocalDateToMidday(dateStr?: string | null): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  if (dateStr.includes("-")) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }
  const d = new Date(dateStr);
  d.setUTCHours(12, 0, 0, 0);
  return d;
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
      dueDate: parseLocalDateToMidday(dueDate),
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
  }
  revalidatePath("/");
}

export async function toggleCardCompletion(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: { column: true } });
  if (!card) return;

  const nextState = !card.completed;
  let targetColumnId = card.columnId;

  if (nextState) {
    const doneCol = await prisma.column.findFirst({ where: { isDone: true } });
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
      dueDate: parseLocalDateToMidday(dueDate),
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
// 6. ROTINAS & FINANÇAS
// ==========================================

export async function getRecurringTasks() {
  return await prisma.recurringTask.findMany({
    include: { 
      module: true,
      cards: {
        include: {
          column: true
        },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { dueDay: "asc" }
  });
}

export async function createRecurringTask(
  title: string, 
  amount: number | null, 
  dueDay: number | null, 
  moduleId: string
) {
  await prisma.recurringTask.create({
    data: {
      title,
      amount,
      dueDay,
      moduleId: moduleId ? moduleId : null
    }
  });
  revalidatePath("/");
}

export async function updateRecurringTask(
  id: string, 
  title: string, 
  amount: number | null, 
  dueDay: number | null, 
  moduleId: string | null
) {
  await prisma.recurringTask.update({
    where: { id },
    data: {
      title,
      amount,
      dueDay,
      moduleId: moduleId ? moduleId : null
    }
  });
  revalidatePath("/");
}

export async function quickUpdateRecurringAmount(id: string, amount: number | null) {
  await prisma.recurringTask.update({
    where: { id },
    data: { amount }
  });
  revalidatePath("/");
}

// Substitua sua função deleteRecurringTask atual por esta:
export async function deleteRecurringTask(id: string) {
  // Opção A: Se quiser deletar os cartões gerados por essa rotina:
  await prisma.card.deleteMany({ where: { recurringTaskId: id } });
  
  // Exclui a rotina
  await prisma.recurringTask.delete({ where: { id } });
  revalidatePath("/");
}

export async function spawnCardFromRecurring(
  recurringId: string, 
  customAmount?: number | null,
  targetMonth?: number,
  targetYear?: number
) {
  const recurring = await prisma.recurringTask.findUnique({ where: { id: recurringId } });
  if (!recurring) return;

  const firstCol = await prisma.column.findFirst({ orderBy: { order: "asc" } });
  if (!firstCol) return;

  const count = await prisma.card.count({ where: { columnId: firstCol.id } });

  const now = new Date();
  const month = (targetMonth !== undefined && targetMonth !== null) ? targetMonth : now.getMonth();
  const year = (targetYear !== undefined && targetYear !== null) ? targetYear : now.getFullYear();
  const day = recurring.dueDay || 1;

  // Data fixada ao meio-dia UTC (12:00:00) para nunca mudar de dia no Brasil
  const nextDueDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const finalAmount = (customAmount !== undefined && customAmount !== null) ? customAmount : recurring.amount;

  const formattedValue = finalAmount
    ? `R$ ${finalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  const cardTitle = formattedValue 
    ? `${recurring.title} (${formattedValue})` 
    : recurring.title;

  const desc = formattedValue 
    ? `Fatura / Conta gerada a partir das Rotinas.\nValor: ${formattedValue}` 
    : `Gerado a partir das Rotinas.`;

  await prisma.card.create({
    data: {
      title: cardTitle,
      columnId: firstCol.id,
      moduleId: recurring.moduleId,
      priority: "Alta",
      description: desc,
      dueDate: nextDueDate,
      order: count,
      recurringTaskId: recurring.id,
      history: {
        create: {
          action: "Sistema",
          details: `Gerou pendência no Kanban para o mês ${month + 1}/${year}`,
          user: CURRENT_USER
        }
      }
    }
  });
  revalidatePath("/");
}