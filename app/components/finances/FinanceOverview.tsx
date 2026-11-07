"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar as RBar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { CalendarClock, PieChart, TrendingUp, CreditCard, ChevronDown, ChevronRight, Check, Pencil } from "lucide-react";
import type { FinanceOverview as Overview, FinanceTx } from "../../types";
import { MONTH_NAMES } from "../../types";
import { brl, brlShort, daysUntil, parseMoney, moneyToInput } from "./format";
import { Bar, EmptyState, Panel, TxRow } from "./ui";

export interface TxHandlers {
  onToggle: (tx: FinanceTx) => void;
  onEdit: (tx: FinanceTx) => void;
  onDelete: (tx: FinanceTx) => void;
  onKanban: (tx: FinanceTx) => void;
  onOpenCard: (cardId: string) => void;
  colorOf: (category: string) => string;
}

interface Props {
  data: Overview;
  handlers: TxHandlers;
  onSetBudget: (moduleId: string, value: number | null) => Promise<void>;
  onPayCreditCard: (ids: string[]) => void;
  onJumpMonth: (year: number, month: number) => void;
}

export function FinanceOverview({ data, handlers, onSetBudget, onPayCreditCard, onJumpMonth }: Props) {
  const [showDone, setShowDone] = useState(false);

  // ---------- AGENDA ----------
  // Entradas ficam num bloco próprio: não "vencem" nem entram em atrasadas.
  const agenda = useMemo(() => {
    const incomes: FinanceTx[] = [];
    const overdue: FinanceTx[] = data.carryOver.filter((t) => t.type !== "INCOME");
    const week: FinanceTx[] = [];
    const later: FinanceTx[] = [];
    const done: FinanceTx[] = [];
    for (const t of data.transactions) {
      if (t.type === "INCOME") incomes.push(t);
      else if (t.paid) done.push(t);
      else {
        const d = daysUntil(t.dueDate);
        if (d < 0) overdue.push(t);
        else if (d <= 7) week.push(t);
        else later.push(t);
      }
    }
    return { incomes, overdue, week, later, done };
  }, [data]);

  const incomeReceived = agenda.incomes.filter((t) => t.paid).reduce((s, t) => s + t.amount, 0);
  const incomeExpected = agenda.incomes.reduce((s, t) => s + t.amount, 0);

  const sum = (list: FinanceTx[]) =>
    list.reduce((s, t) => s + (t.type === "INCOME" ? t.amount : -t.amount), 0);

  const creditUnpaid = data.transactions.filter((t) => t.paymentMethod === "CREDIT_CARD" && t.type !== "INCOME" && !t.paid);

  const row = (t: FinanceTx) => (
    <TxRow
      key={t.id}
      tx={t}
      moduleColor={handlers.colorOf(t.category)}
      showYear={t.dueDate < new Date(Date.UTC(data.year, data.month, 1))}
      onToggle={() => handlers.onToggle(t)}
      onEdit={() => handlers.onEdit(t)}
      onDelete={() => handlers.onDelete(t)}
      onKanban={() => handlers.onKanban(t)}
      onOpenCard={handlers.onOpenCard}
    />
  );

  const group = (label: string, list: FinanceTx[], tone: string) =>
    list.length > 0 && (
      <div className="space-y-1">
        <div className={`flex items-center justify-between px-2.5 pt-2 text-[10px] font-bold uppercase tracking-wider font-mono ${tone}`}>
          <span>{label} · {list.length}</span>
          <span>{brl(Math.abs(sum(list)))}</span>
        </div>
        {list.map(row)}
      </div>
    );

  const isEmpty = data.transactions.length === 0 && data.carryOver.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* AGENDA */}
      <Panel
        className="lg:col-span-7"
        title="Agenda do mês"
        icon={<CalendarClock size={14} className="text-blue-400" />}
        right={<span className="text-[10px] text-slate-500 font-mono">{data.transactions.length} lançamentos</span>}
      >
        {isEmpty ? (
          <EmptyState>
            Nada lançado em {MONTH_NAMES[data.month]}.<br />
            Use <b className="text-slate-300">+ Lançar</b> ou lance suas contas fixas.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {agenda.incomes.length > 0 && (
              <div className="space-y-1 pb-2 border-b border-slate-800/80">
                <div className="flex items-center justify-between px-2.5 pt-1 text-[10px] font-bold uppercase tracking-wider font-mono text-emerald-400">
                  <span>Entradas · {agenda.incomes.length}</span>
                  <span>
                    {incomeReceived < incomeExpected
                      ? `${brl(incomeReceived)} de ${brl(incomeExpected)} recebido`
                      : `${brl(incomeExpected)} recebido`}
                  </span>
                </div>
                {agenda.incomes.map(row)}
              </div>
            )}
            {group("Contas atrasadas", agenda.overdue, "text-rose-400")}
            {group("Próximos 7 dias", agenda.week, "text-amber-400")}
            {group("Mais pra frente", agenda.later, "text-slate-400")}
            {agenda.done.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDone((v) => !v)}
                  className="w-full flex items-center justify-between px-2.5 pt-2 text-[10px] font-bold uppercase tracking-wider font-mono text-emerald-500 cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    {showDone ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Contas pagas · {agenda.done.length}
                  </span>
                  <span>{brl(Math.abs(sum(agenda.done)))}</span>
                </button>
                {showDone && <div className="space-y-1 mt-1">{agenda.done.map(row)}</div>}
              </div>
            )}
          </div>
        )}
      </Panel>

      <div className="lg:col-span-5 space-y-4">
        {/* CARTÃO */}
        {data.summary.creditCardTotal > 0 && (
          <Panel title="Fatura do cartão" icon={<CreditCard size={14} className="text-amber-400" />}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-bold font-mono text-amber-400">{brl(data.summary.creditCardTotal)}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {data.summary.creditCardPending > 0 ? `${brl(data.summary.creditCardPending)} em aberto` : "tudo pago ✓"}
                </p>
              </div>
              {creditUnpaid.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPayCreditCard(creditUnpaid.map((t) => t.id))}
                  className="px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-[11px] font-bold hover:bg-amber-500/10 cursor-pointer"
                >
                  Marcar fatura paga
                </button>
              )}
            </div>
          </Panel>
        )}

        {/* MÓDULOS / ORÇAMENTO */}
        <Panel
          title="Para onde vai o dinheiro"
          icon={<PieChart size={14} className="text-violet-400" />}
          right={<span className="text-[10px] text-slate-500 font-mono">clique no teto p/ editar</span>}
        >
          {data.byModule.length === 0 ? (
            <EmptyState>Sem gastos neste mês.</EmptyState>
          ) : (
            <div className="space-y-3">
              {data.byModule.map((m) => (
                <ModuleBudgetRow key={m.key} slice={m} total={data.summary.expenseTotal} onSetBudget={onSetBudget} />
              ))}
            </div>
          )}
        </Panel>

        {/* PROJEÇÃO */}
        <Panel title="Próximos 6 meses" icon={<TrendingUp size={14} className="text-emerald-400" />}>
          <div className="h-56 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data.projection.map((p) => ({ ...p, name: MONTH_NAMES[p.month].slice(0, 3) }))}
                margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
                onClick={(e) => {
                  const idx = typeof e?.activeTooltipIndex === "number" ? e.activeTooltipIndex : Number(e?.activeTooltipIndex);
                  const p = data.projection[idx];
                  if (p) onJumpMonth(p.year, p.month);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={brlShort} width={52} />
                <Tooltip
                  cursor={{ fill: "#1e293b55" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as Overview["projection"][number] & { name: string };
                    return (
                      <div className="bg-[#050811] border border-slate-700 p-2.5 rounded-lg text-[11px] font-mono shadow-xl space-y-0.5">
                        <p className="font-bold text-white">{MONTH_NAMES[p.month]} {p.year}</p>
                        <p className="text-emerald-400">Entradas {brl(p.income)}</p>
                        <p className="text-rose-400">Saídas {brl(p.expense)}</p>
                        {p.installments > 0 && <p className="text-violet-400">↳ parcelas {brl(p.installments)}</p>}
                        {p.fixedForecast > 0 && <p className="text-sky-400">↳ fixas previstas {brl(p.fixedForecast)}</p>}
                        {p.goals > 0 && <p className="text-emerald-300">↳ aportes em metas {brl(p.goals)}</p>}
                        <p className={p.balance >= 0 ? "text-blue-300" : "text-rose-300"}>Saldo {brl(p.balance)}</p>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} iconSize={8} />
                <RBar dataKey="income" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <RBar dataKey="expense" name="Saídas" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Line dataKey="balance" name="Saldo" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            Inclui parcelas já lançadas, contas fixas ativas e aportes planejados em metas. Clique num mês para ir até ele.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function ModuleBudgetRow({
  slice, total, onSetBudget,
}: {
  slice: Overview["byModule"][number];
  total: number;
  onSetBudget: (moduleId: string, value: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(moneyToInput(slice.budget));
  const hasBudget = (slice.budget ?? 0) > 0;
  const over = hasBudget && slice.spent > slice.budget!;
  const pctOfTotal = total > 0 ? Math.round((slice.spent / total) * 100) : 0;

  async function save() {
    if (!slice.moduleId) return setEditing(false);
    const v = value.trim() ? parseMoney(value) : null;
    await onSetBudget(slice.moduleId, v && v > 0 ? v : null);
    setEditing(false);
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
          <span className="truncate font-semibold text-slate-200">{slice.key}</span>
          <span className="text-[10px] text-slate-500 font-mono">{pctOfTotal}%</span>
        </span>
        <span className="flex items-center gap-1.5 font-mono shrink-0">
          <span className={`font-bold ${over ? "text-rose-400" : "text-white"}`}>{brl(slice.spent)}</span>
          {editing ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                  if (e.key === "Escape") setEditing(false);
                }}
                placeholder="teto"
                className="w-20 bg-[#050811] border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white outline-none focus:border-blue-500"
              />
              <button type="button" onClick={() => void save()} className="text-emerald-400 cursor-pointer" aria-label="Salvar teto">
                <Check size={13} />
              </button>
            </span>
          ) : slice.moduleId ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 cursor-pointer"
              title="Definir teto mensal"
            >
              {hasBudget ? `/ ${brl(slice.budget!)}` : <><Pencil size={10} /> teto</>}
            </button>
          ) : null}
        </span>
      </div>
      <Bar value={slice.spent} max={hasBudget ? slice.budget! : total} color={slice.color} over={over} />
      {hasBudget && (
        <p className={`text-[10px] font-mono ${over ? "text-rose-400" : "text-slate-500"}`}>
          {over ? `estourou ${brl(slice.spent - slice.budget!)}` : `sobra ${brl(slice.budget! - slice.spent)}`}
        </p>
      )}
    </div>
  );
}
