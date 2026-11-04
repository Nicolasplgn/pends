// app/types/index.ts
import type { Module } from "@prisma/client";
import type { getBoardData, getCardDetails, getDashboardStats, getRecurringTasks } from "../actions";

export type BoardData = NonNullable<Awaited<ReturnType<typeof getBoardData>>>;
export type KanbanColumn = BoardData["columns"][number];
export type KanbanCardData = KanbanColumn["cards"][number];
export type CardDetails = NonNullable<Awaited<ReturnType<typeof getCardDetails>>>;
export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
export type RecurringTaskData = Awaited<ReturnType<typeof getRecurringTasks>>[number];

export type NeuralCard = KanbanCardData & { columnTitle: string };

export type NeuralNode = Module & {
  x: number;
  y: number;
  cards: NeuralCard[];
  total: number;
  completed: number;
  percent: number;
};

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
] as const;

export function isCardOverdue(dueDate: Date | string | null | undefined, isCompleted?: boolean): boolean {
  if (!dueDate || isCompleted) return false;
  const d = new Date(dueDate);
  const now = new Date();
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);
  return now > endOfDay;
}

export function getTaskOverallStatus(task: any) {
  const cards = task.cards ?? [];
  if (cards.length === 0) {
    return {
      type: "none",
      label: "Sem Lançamento",
      color: "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700",
    };
  }

  const overdueCard = cards.find((c: any) => isCardOverdue(c.dueDate, c.completed || c.column?.isDone));
  if (overdueCard) {
    return {
      type: "overdue",
      label: "⚠️ Vencida",
      color: "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse hover:bg-red-500/30",
    };
  }

  const activeCard = cards.find((c: any) => !c.completed && !c.column?.isDone);
  if (activeCard) {
    return {
      type: "active",
      label: "⏳ Lançado no Kanban",
      color: "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30",
    };
  }

  return {
    type: "completed",
    label: "✓ Concluída",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30",
  };
}