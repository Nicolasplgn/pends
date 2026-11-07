"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Module } from "@prisma/client";
import {
  Plus, LayoutDashboard, ListFilter, Repeat, Layers, ArrowUpRight, ArrowDownRight,
  AlertTriangle, Send, Wallet, Gauge, Loader2, Target, Upload,
} from "lucide-react";
import {
  getFinanceOverview, toggleTransactionPaid, setTransactionsPaid, launchRecurringForMonth,
  setModuleBudget, sendTransactionToKanban, toggleRecurringActive, deleteRecurringTask, deleteTransaction,
} from "@/app/actions";
import type {
  FinanceInstallmentGroup, FinanceOverview as Overview, FinanceRecurring as Recurring, FinanceTx,
} from "../../types";
import { MONTH_NAMES } from "../../types";
import { DateNavigator } from "../shared/DateNavigator";
import { ConfirmModal } from "../shared/ConfirmModal";
import { FinanceOverview, type TxHandlers } from "./FinanceOverview";
import { FinanceLedger, type LedgerFilter } from "./FinanceLedger";
import { FinanceRecurring } from "./FinanceRecurring";
import { FinanceInstallments } from "./FinanceInstallments";
import { TransactionModal, type TxModalDefaults } from "./modals/TransactionModal";
import { DeleteTxModal } from "./modals/DeleteTxModal";
import { RecurringModal } from "./modals/RecurringModal";
import { ImportModal } from "./modals/ImportModal";
import { FinanceGoals } from "./FinanceGoals";
import { brl } from "./format";
import { Bar } from "./ui";

type Tab = "overview" | "ledger" | "fixed" | "installments" | "goals";

interface FinancesHubProps {
  modules: Module[];
  selectedMonth: number;
  selectedYear: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectMonthYear: (month: number, year: number) => void;
  onOpenCard: (cardId: string) => void;
  /** Recarrega o resto do app (Kanban/Neural) quando algo cruza as fronteiras */
  onExternalChange: () => void;
  /** Muda de valor quando a paleta (Ctrl+K) pede um novo lançamento */
  newTxSignal?: number;
}

export function FinancesHub({
  modules, selectedMonth, selectedYear, onPrevMonth, onNextMonth, onSelectMonthYear, onOpenCard, onExternalChange, newTxSignal,
}: FinancesHubProps) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("ALL");
  const [toast, setToast] = useState<string | null>(null);

  const [txModal, setTxModal] = useState<{ open: boolean; tx: FinanceTx | null; defaults?: TxModalDefaults }>({ open: false, tx: null });
  const [deleteTx, setDeleteTx] = useState<FinanceTx | null>(null);
  const [recModal, setRecModal] = useState<{ open: boolean; item: Recurring | null }>({ open: false, item: null });
  const [deleteRec, setDeleteRec] = useState<Recurring | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<FinanceInstallmentGroup | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getFinanceOverview(selectedYear, selectedMonth));
    } catch (err) {
      console.error("Erro ao carregar finanças:", err);
      setToast("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const defaultDate = useCallback(() => {
    const now = new Date();
    if (now.getFullYear() === selectedYear && now.getMonth() === selectedMonth) return undefined;
    return `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  }, [selectedYear, selectedMonth]);

  const openCreate = useCallback(
    (type?: "INCOME" | "EXPENSE") => setTxModal({ open: true, tx: null, defaults: { type, dueDate: defaultDate() } }),
    [defaultDate]
  );

  // Pedido vindo da paleta de comandos
  useEffect(() => {
    if (newTxSignal) openCreate();
  }, [newTxSignal, openCreate]);

  // Atalho: tecla N abre novo lançamento
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCreate]);

  const colorOf = useMemo(() => {
    const map = new Map(modules.map((m) => [m.title, m.color]));
    return (cat: string) => map.get(cat) ?? "#64748b";
  }, [modules]);

  // Atualização otimista do "pago" para resposta instantânea
  function patchTx(ids: string[], paid: boolean) {
    setData((d) =>
      d && {
        ...d,
        transactions: d.transactions.map((t) => (ids.includes(t.id) ? { ...t, paid } : t)),
        carryOver: d.carryOver.map((t) => (ids.includes(t.id) ? { ...t, paid } : t)),
      }
    );
  }

  const handlers: TxHandlers = {
    colorOf,
    onOpenCard,
    onEdit: (tx) => setTxModal({ open: true, tx }),
    onDelete: (tx) => setDeleteTx(tx),
    onToggle: async (tx) => {
      patchTx([tx.id], !tx.paid);
      await toggleTransactionPaid(tx.id);
      if (tx.card) onExternalChange();
      void load();
    },
    onKanban: async (tx) => {
      const res = await sendTransactionToKanban(tx.id);
      if (res.success) {
        setToast("Pendência criada no Pipeline");
        onExternalChange();
        void load();
      }
    },
  };

  async function handleBulkPaid(ids: string[], paid: boolean) {
    patchTx(ids, paid);
    await setTransactionsPaid(ids, paid);
    setToast(paid ? `${ids.length} marcado(s) como pago` : `${ids.length} reaberto(s)`);
    onExternalChange();
    void load();
  }

  async function handleLaunch(ids?: string[]) {
    const res = await launchRecurringForMonth(selectedYear, selectedMonth, ids);
    setToast(res.created > 0 ? `${res.created} conta(s) fixa(s) lançada(s)` : "Nada novo para lançar");
    void load();
  }

  async function handleSetBudget(moduleId: string, value: number | null) {
    await setModuleBudget(moduleId, value);
    setToast(value ? `Teto definido: ${brl(value)}` : "Teto removido");
    void load();
  }

  function handleSaved(target: { year: number; month: number }, message: string) {
    setToast(message);
    if (target.year !== selectedYear || target.month !== selectedMonth) {
      onSelectMonthYear(target.month, target.year);
    } else {
      void load();
    }
    onExternalChange();
  }

  const s = data?.summary;
  const incomeExpected = s ? s.incomeTotal + s.recurringPendingIncome : 0;
  const expenseExpected = s ? s.expenseTotal + s.recurringPendingExpense : 0;

  const TABS: [Tab, string, React.ReactNode, number?][] = [
    ["overview", "Visão geral", <LayoutDashboard size={14} key="o" />],
    ["ledger", "Lançamentos", <ListFilter size={14} key="l" />, data?.transactions.length],
    ["fixed", "Contas fixas", <Repeat size={14} key="f" />, data?.recurring.length],
    ["installments", "Parcelas", <Layers size={14} key="i" />, data?.installments.length],
    ["goals", "Metas", <Target size={14} key="g" />, data?.goals.length],
  ];

  return (
    <div className="w-full h-full overflow-y-auto [scrollbar-width:thin]">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-10 md:pb-28 font-sans">
        {/* CABEÇALHO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wallet size={18} />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Finanças</h1>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
                {loading && <Loader2 size={10} className="animate-spin text-emerald-400" />}
              </p>
            </div>
          </div>

          <DateNavigator
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onSelectMonthYear={onSelectMonthYear}
          />
        </div>

        {/* KPIs */}
        {s && data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="Saldo previsto"
              value={brl(s.balancePlanned)}
              tone={s.balancePlanned >= 0 ? "text-emerald-400" : "text-rose-400"}
              hint={`realizado até agora ${brl(s.balanceRealized)}`}
            />
            <Kpi
              label="Entradas"
              value={brl(incomeExpected)}
              tone="text-emerald-400"
              hint={`${brl(s.incomeReceived)} recebido`}
              bar={{ value: s.incomeReceived, max: incomeExpected, color: "#10b981" }}
              onClick={() => { setLedgerFilter("INCOME"); setTab("ledger"); }}
            />
            <Kpi
              label="Saídas"
              value={brl(expenseExpected)}
              tone="text-rose-400"
              hint={`${brl(s.expensePaid)} pago · ${brl(s.expensePending + s.recurringPendingExpense)} a pagar`}
              bar={{ value: s.expensePaid, max: expenseExpected, color: "#f43f5e" }}
              onClick={() => { setLedgerFilter("EXPENSE"); setTab("ledger"); }}
            />
            {data.isCurrentMonth ? (
              <Kpi
                label="Livre por dia"
                icon={<Gauge size={13} className="text-blue-400" />}
                value={brl(s.safeDailySpend)}
                tone={s.safeDailySpend > 0 ? "text-blue-300" : "text-rose-400"}
                hint={`${s.remainingDays} dias restantes, já descontando o que falta pagar`}
              />
            ) : (
              <Kpi
                label="Cartão no mês"
                value={brl(s.creditCardTotal)}
                tone="text-amber-400"
                hint={s.creditCardPending > 0 ? `${brl(s.creditCardPending)} em aberto` : "sem pendências"}
                onClick={() => { setLedgerFilter("CARD"); setTab("ledger"); }}
              />
            )}
          </div>
        )}

        {/* ALERTAS */}
        {s && data && (s.overdueCount > 0 || s.recurringPendingCount > 0) && (
          <div className="flex flex-col md:flex-row gap-2">
            {s.overdueCount > 0 && (
              <button
                type="button"
                onClick={() => { setLedgerFilter("OVERDUE"); setTab("ledger"); }}
                className="flex-1 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-left cursor-pointer hover:bg-rose-500/15"
              >
                <span className="flex items-center gap-2 text-xs text-rose-200">
                  <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                  <span>
                    <b>{s.overdueCount}</b> conta(s) atrasada(s){data.carryOver.length > 0 && " (inclui meses anteriores)"}
                  </span>
                </span>
                <span className="text-xs font-bold font-mono text-rose-300 shrink-0">{brl(s.overdueAmount)} →</span>
              </button>
            )}
            {s.recurringPendingCount > 0 && (
              <div className="flex-1 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10">
                <span className="flex items-center gap-2 text-xs text-sky-200">
                  <Repeat size={15} className="text-sky-400 shrink-0" />
                  <span>
                    <b>{s.recurringPendingCount}</b> conta(s) fixa(s) ainda não lançada(s){" "}
                    <span className="font-mono text-sky-300">({brl(s.recurringPendingExpense - s.recurringPendingIncome)})</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleLaunch()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 text-[11px] font-bold hover:bg-sky-400 cursor-pointer shrink-0"
                >
                  <Send size={12} /> Lançar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ABAS + AÇÕES */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sticky top-0 z-20 bg-[#050811]/95 backdrop-blur py-2 -mx-1 px-1">
          <div className="flex items-center gap-1 bg-[#0a0f1d] p-1 border border-slate-800 rounded-xl overflow-x-auto [scrollbar-width:none]">
            {TABS.map(([id, label, icon, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition cursor-pointer ${
                  tab === id ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                {icon} {label}
                {!!count && <span className="text-[10px] font-mono px-1.5 rounded-full bg-black/40 text-slate-400">{count}</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-800 cursor-pointer"
              title="Importar extrato ou fatura (CSV/OFX)"
            >
              <Upload size={14} /> <span className="hidden sm:inline">Importar</span>
            </button>
            <button
              type="button"
              onClick={() => openCreate("INCOME")}
              className="flex-1 xl:flex-none flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/10 cursor-pointer"
            >
              <ArrowUpRight size={14} /> Entrada
            </button>
            <button
              type="button"
              onClick={() => openCreate("EXPENSE")}
              className="flex-1 xl:flex-none flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-rose-500/40 text-rose-300 text-xs font-bold hover:bg-rose-500/10 cursor-pointer"
            >
              <ArrowDownRight size={14} /> Saída
            </button>
            <button
              type="button"
              onClick={() => openCreate()}
              className="flex-1 xl:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 shadow-lg shadow-emerald-500/10 cursor-pointer"
              title="Novo lançamento (atalho: N)"
            >
              <Plus size={15} /> Lançar
            </button>
          </div>
        </div>

        {/* CONTEÚDO */}
        {!data ? (
          <div className="py-24 flex items-center justify-center text-emerald-500 text-xs font-mono gap-2">
            <Loader2 size={16} className="animate-spin" /> carregando...
          </div>
        ) : (
          <div className={`transition-opacity ${loading ? "opacity-70" : ""}`}>
            {tab === "overview" && (
              <FinanceOverview
                data={data}
                handlers={handlers}
                onSetBudget={handleSetBudget}
                onPayCreditCard={(ids) => void handleBulkPaid(ids, true)}
                onJumpMonth={(y, m) => onSelectMonthYear(m, y)}
              />
            )}
            {tab === "ledger" && (
              <FinanceLedger
                transactions={data.transactions}
                carryOver={data.carryOver}
                handlers={handlers}
                filter={ledgerFilter}
                setFilter={setLedgerFilter}
                onBulkPaid={handleBulkPaid}
              />
            )}
            {tab === "fixed" && (
              <FinanceRecurring
                recurring={data.recurring}
                month={data.month}
                onCreate={() => setRecModal({ open: true, item: null })}
                onEdit={(item) => setRecModal({ open: true, item })}
                onDelete={(item) => setDeleteRec(item)}
                onToggleActive={async (item) => {
                  await toggleRecurringActive(item.id);
                  void load();
                }}
                onLaunch={(ids) => void handleLaunch(ids)}
              />
            )}
            {tab === "goals" && (
              <FinanceGoals
                goals={data.goals}
                onChanged={(msg) => {
                  setToast(msg);
                  void load();
                }}
              />
            )}
            {tab === "installments" && (
              <FinanceInstallments
                installments={data.installments}
                colorOf={colorOf}
                onPayNext={async (id) => {
                  await toggleTransactionPaid(id);
                  setToast("Parcela marcada como paga");
                  void load();
                }}
                onDeleteRemaining={(g) => setDeleteGroup(g)}
              />
            )}
          </div>
        )}
      </div>

      {/* MODAIS */}
      <TransactionModal
        isOpen={txModal.open}
        onClose={() => setTxModal({ open: false, tx: null })}
        onSaved={handleSaved}
        initialData={txModal.tx}
        defaults={txModal.defaults}
        modules={modules}
        onDelete={(tx) => setDeleteTx(tx)}
        onKanban={(tx) => handlers.onKanban(tx)}
      />
      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        modules={modules}
        onImported={(n) => {
          setToast(`${n} lançamento(s) importado(s)`);
          setTab("ledger");
          void load();
        }}
      />
      <DeleteTxModal
        tx={deleteTx}
        onClose={() => setDeleteTx(null)}
        onDeleted={(msg) => {
          setToast(msg);
          void load();
        }}
      />
      <RecurringModal
        isOpen={recModal.open}
        onClose={() => setRecModal({ open: false, item: null })}
        initialData={recModal.item}
        modules={modules}
        onSaved={(msg) => {
          setToast(msg);
          void load();
        }}
      />
      <ConfirmModal
        isOpen={!!deleteRec}
        onClose={() => setDeleteRec(null)}
        title="Excluir conta fixa?"
        description={`"${deleteRec?.title ?? ""}" deixa de ser lançada nos próximos meses. Os lançamentos já feitos continuam no histórico.`}
        confirmText="Excluir"
        danger
        onConfirm={async () => {
          if (!deleteRec) return;
          await deleteRecurringTask(deleteRec.id);
          setDeleteRec(null);
          setToast("Conta fixa excluída");
          void load();
        }}
      />
      <ConfirmModal
        isOpen={!!deleteGroup}
        onClose={() => setDeleteGroup(null)}
        title="Excluir parcelas restantes?"
        description={`Remove as ${deleteGroup?.remainingCount ?? 0} parcelas em aberto de "${deleteGroup?.description ?? ""}" (${brl(deleteGroup?.remainingAmount ?? 0)}). As já pagas ficam no histórico.`}
        confirmText="Excluir restantes"
        danger
        onConfirm={async () => {
          if (!deleteGroup?.nextTxId) return;
          await deleteTransaction(deleteGroup.nextTxId, "future");
          setDeleteGroup(null);
          setToast("Parcelas restantes excluídas");
          void load();
        }}
      />

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-70 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white shadow-2xl font-mono">
          {toast}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label, value, tone, hint, bar, onClick, icon,
}: {
  label: string;
  value: string;
  tone: string;
  hint?: string;
  bar?: { value: number; max: number; color: string };
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  const cls = `text-left p-3 sm:p-4 rounded-2xl border border-slate-800 bg-[#0a0f1d] flex flex-col gap-1.5 min-w-0 ${
    onClick ? "hover:border-slate-600 cursor-pointer transition-colors" : ""
  }`;
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[10px] uppercase text-slate-400 font-bold tracking-wider font-mono">
        {icon}
        {label}
      </span>
      <span className={`text-base sm:text-lg xl:text-2xl font-bold font-mono truncate ${tone}`} title={value}>{value}</span>
      {bar && <Bar value={bar.value} max={bar.max} color={bar.color} />}
      {hint && <span className="text-[10px] text-slate-500 font-mono leading-snug">{hint}</span>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
