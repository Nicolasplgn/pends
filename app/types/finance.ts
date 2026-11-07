import type { getFinanceOverview, getRecurringTasks } from "../actions";

export type RecurringTaskData = Awaited<ReturnType<typeof getRecurringTasks>>[number];

export type FinanceOverview = Awaited<ReturnType<typeof getFinanceOverview>>;
export type FinanceTx = FinanceOverview["transactions"][number];
export type FinanceRecurring = FinanceOverview["recurring"][number];
export type FinanceInstallmentGroup = FinanceOverview["installments"][number];
export type FinanceModuleSlice = FinanceOverview["byModule"][number];
export type FinanceProjectionMonth = FinanceOverview["projection"][number];
export type FinanceSummary = FinanceOverview["summary"];

export type TxType = "INCOME" | "EXPENSE";
export type PayMethod = "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT";

export const PAY_METHOD_LABEL: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  DEBIT: "Débito",
};
