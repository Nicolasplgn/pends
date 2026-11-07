// app/types/index.ts
import type { Module } from "@prisma/client";
import type { getBoardData, getCardDetails, getDashboardStats } from "../actions";

// IMPORTA E EXPORTA TUDO DO ARQUIVO FINANCEIRO
export * from "./finance";

export type BoardData = NonNullable<Awaited<ReturnType<typeof getBoardData>>>;
export type KanbanColumn = BoardData["columns"][number];
export type KanbanCardData = KanbanColumn["cards"][number];
export type CardDetails = NonNullable<Awaited<ReturnType<typeof getCardDetails>>>;
export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

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
