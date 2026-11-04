import type { getRecurringTasks } from "../actions";
import { isCardOverdue } from "./index";

// Tipo base da tarefa recorrente com os cards do mês
export type RecurringTaskData = Awaited<ReturnType<typeof getRecurringTasks>>[number];

// Status consolidado da conta/fatura
export interface FinanceOverallStatus {
  type: "none" | "overdue" | "active" | "completed";
  label: string;
  color: string;
}

// Métricas do Dashboard Financeiro
export interface FinanceMetrics {
  totalPlanned: number;     // Total previsto no mês (R$)
  totalPaid: number;        // Total já pago (R$)
  totalPending: number;     // Restante a pagar (R$)
  paidPercentage: number;   // % do mês quitado
  overdueCount: number;     // Contas em atraso
  paidCount: number;        // Contas pagas
  pendingCount: number;     // Contas aguardando
  dailyBurnRate: number;    // Custo médio por dia
}

// Dados para o gráfico de Pizza / Donut (Recharts)
export interface FinanceCategoryData {
  name: string;
  amount: number;
  color: string;
  count: number;
  [key: string]: string | number;
}

// Ponto temporal para o gráfico de linha de vencimentos
export interface FinanceTimelinePoint {
  dia: string;
  valor: number;
  acumulado: number;
  contas: string;
}

// Helper determinístico do status de faturas
export function getTaskOverallStatus(task: any): FinanceOverallStatus {
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