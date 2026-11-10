"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Module } from "@prisma/client";
import {
  CheckCircle2, Circle, ArrowDownRight, ArrowUpRight, ListChecks, Plus, Loader2, PartyPopper, ChevronRight, Undo2,
} from "lucide-react";
import { getTodayOverview, toggleCardCompletion, toggleTransactionPaid } from "../../actions";
import type { FinanceTx, TodayOverview } from "../../types";
import { MONTH_NAMES, PAY_METHOD_LABEL } from "../../types";
import { brl, daysUntil, fmtDate } from "../finances/format";

/** Valor redondo para os quadros (cabe no celular): R$ 982 · R$ 4.125 */
const brlRound = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
import { TransactionModal, type TxModalDefaults } from "../finances/modals/TransactionModal";

type Kind = "pay" | "receive" | "task";
type Filter = "all" | Kind;

interface Item {
  key: string;
  kind: Kind;
  id: string;
  title: string;
  sub: string;
  color: string;
  due: Date;
  days: number;
  amount?: number;
  priority?: string;
  tx?: FinanceTx;
}

interface Props {
  modules: Module[];
  onOpenCard: (cardId: string) => void;
  onNewCard: () => void;
  onGoTo: (tab: "kanban" | "finances") => void;
  /** Recarrega o resto do app quando um card muda */
  onExternalChange: () => void;
  /** Muda quando algo fora desta tela mudou (ex.: card editado) */
  refreshKey?: number;
}

const BUCKETS: { id: string; label: string; test: (d: number) => boolean; tone: string }[] = [
  { id: "late", label: "Atrasado", test: (d) => d < 0, tone: "text-rose-400" },
  { id: "today", label: "Hoje", test: (d) => d === 0, tone: "text-amber-300" },
  { id: "tomorrow", label: "Amanhã", test: (d) => d === 1, tone: "text-amber-400/90" },
  { id: "week", label: "Esta semana", test: (d) => d >= 2 && d <= 7, tone: "text-slate-300" },
  { id: "later", label: "Mais pra frente", test: (d) => d > 7, tone: "text-slate-500" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function TodayView({ modules, onOpenCard, onNewCard, onGoTo, onExternalChange, refreshKey }: Props) {
  const [data, setData] = useState<TodayOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Item | null>(null);
  const [txModal, setTxModal] = useState<{ open: boolean; tx: FinanceTx | null; defaults?: TxModalDefaults }>({ open: false, tx: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getTodayOverview());
      setHidden(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);

  const colorOf = useMemo(() => {
    const map = new Map(modules.map((m) => [m.title, m.color]));
    return (cat: string) => map.get(cat) ?? "#64748b";
  }, [modules]);

  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    const list: Item[] = [];
    for (const t of data.bills) {
      const d = daysUntil(t.dueDate);
      // Contas: atrasadas + até 30 dias
      list.push({
        key: `tx-${t.id}`, kind: "pay", id: t.id, title: t.description,
        sub: `${PAY_METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod} · ${t.category}`,
        color: colorOf(t.category), due: new Date(t.dueDate), days: d, amount: t.amount, tx: t,
      });
    }
    for (const t of data.incomes) {
      list.push({
        key: `tx-${t.id}`, kind: "receive", id: t.id, title: t.description,
        sub: `${PAY_METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod} · ${t.category}`,
        color: colorOf(t.category), due: new Date(t.dueDate), days: daysUntil(t.dueDate), amount: t.amount, tx: t,
      });
    }
    for (const c of data.cards) {
      list.push({
        key: `card-${c.id}`, kind: "task", id: c.id, title: c.title,
        sub: `${c.module?.title ?? "Geral"} · ${c.column.title}${c.assignee ? ` · com ${c.assignee}` : ""}`,
        color: c.module?.color ?? "#64748b", due: new Date(c.dueDate!), days: daysUntil(c.dueDate!), priority: c.priority,
      });
    }
    // Ordem: data, depois contas antes de tarefas
    const order: Record<Kind, number> = { pay: 0, receive: 1, task: 2 };
    return list.sort((a, b) => a.days - b.days || order[a.kind] - order[b.kind]);
  }, [data, colorOf]);

  const visible = items.filter((i) => !hidden.has(i.key));

  // Resumos dos 3 quadros: contas/tarefas atrasadas + próximos 7 dias; entradas dos próximos 30
  const sums = useMemo(() => {
    const soon = (i: Item) => i.days <= 7;
    const pay = visible.filter((i) => i.kind === "pay" && soon(i));
    const recv = visible.filter((i) => i.kind === "receive");
    const task = visible.filter((i) => i.kind === "task" && soon(i));
    return {
      payTotal: pay.reduce((s, i) => s + (i.amount ?? 0), 0),
      payCount: pay.length,
      payLate: pay.filter((i) => i.days < 0).length,
      recvTotal: recv.reduce((s, i) => s + (i.amount ?? 0), 0),
      recvCount: recv.length,
      taskCount: task.length,
      taskToday: task.filter((i) => i.days <= 0).length,
    };
  }, [visible]);

  const filtered = visible.filter((i) => filter === "all" || i.kind === filter);

  async function complete(item: Item) {
    setHidden((h) => new Set(h).add(item.key));
    setUndo(item);
    if (item.kind === "task") {
      await toggleCardCompletion(item.id);
      onExternalChange();
    } else {
      await toggleTransactionPaid(item.id);
      if (item.tx?.card) onExternalChange();
    }
  }

  async function undoLast() {
    if (!undo) return;
    const item = undo;
    setUndo(null);
    if (item.kind === "task") {
      await toggleCardCompletion(item.id);
      onExternalChange();
    } else await toggleTransactionPaid(item.id);
    await load();
  }

  function open(item: Item) {
    if (item.kind === "task") onOpenCard(item.id);
    else if (item.tx) setTxModal({ open: true, tx: item.tx });
  }

  const now = new Date();
  const m = data?.month;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-5">
        {/* SAUDAÇÃO */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
              {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              {greeting()}, Nicolas
              {loading && <Loader2 size={16} className="animate-spin text-slate-500" />}
            </h1>
          </div>
        </div>

        {/* 3 QUADROS */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Tile
            active={filter === "pay"}
            onClick={() => setFilter((f) => (f === "pay" ? "all" : "pay"))}
            icon={<ArrowDownRight size={16} />}
            label="Pagar"
            value={brlRound(sums.payTotal)}
            hint={
              sums.payLate > 0
                ? `${sums.payLate} atrasada${sums.payLate > 1 ? "s" : ""}`
                : sums.payCount
                  ? `${sums.payCount} em 7 dias`
                  : "nada em 7 dias"
            }
            tone="rose"
            alert={sums.payLate > 0}
          />
          <Tile
            active={filter === "receive"}
            onClick={() => setFilter((f) => (f === "receive" ? "all" : "receive"))}
            icon={<ArrowUpRight size={16} />}
            label="Receber"
            value={brlRound(sums.recvTotal)}
            hint={sums.recvCount ? `${sums.recvCount} previsto${sums.recvCount > 1 ? "s" : ""}` : "nada previsto"}
            tone="emerald"
          />
          <Tile
            active={filter === "task"}
            onClick={() => setFilter((f) => (f === "task" ? "all" : "task"))}
            icon={<ListChecks size={16} />}
            label="Fazer"
            value={String(sums.taskCount)}
            hint={sums.taskToday ? `${sums.taskToday} pra hoje` : "em 7 dias"}
            tone="blue"
            alert={sums.taskToday > 0}
          />
        </div>

        {/* MÊS */}
        {m && (
          <button
            type="button"
            onClick={() => onGoTo("finances")}
            className="w-full text-left rounded-2xl border border-slate-800 bg-[#0a0f1d] px-4 py-3 hover:border-slate-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
              <span className="uppercase tracking-wider text-slate-400 font-bold">{MONTH_NAMES[m.month]}</span>
              <span className={m.balance >= 0 ? "text-emerald-400" : "text-rose-400"}>
                sobra prevista <b>{brl(m.balance)}</b>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-2">
              <MonthBar label="Entrou" value={m.incomeReceived} total={m.income} color="#10b981" />
              <MonthBar label="Pago" value={m.expensePaid} total={m.expense} color="#f43f5e" />
            </div>
          </button>
        )}

        {/* AÇÕES RÁPIDAS */}
        <div className="grid grid-cols-3 gap-2">
          <Quick onClick={() => setTxModal({ open: true, tx: null, defaults: { type: "EXPENSE" } })} label="Conta" tone="text-rose-300 border-rose-500/30" />
          <Quick onClick={() => setTxModal({ open: true, tx: null, defaults: { type: "INCOME" } })} label="Entrada" tone="text-emerald-300 border-emerald-500/30" />
          <Quick onClick={onNewCard} label="Tarefa" tone="text-blue-300 border-blue-500/30" />
        </div>

        {/* LISTA ÚNICA POR DATA */}
        {data && filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#0a0f1d] py-12 text-center space-y-2">
            <PartyPopper size={28} className="mx-auto text-emerald-400" />
            <p className="text-sm text-white font-semibold">Tudo em dia</p>
            <p className="text-xs text-slate-500">
              {filter === "all" ? "Nada vencendo nos próximos dias." : "Nada aqui nesse filtro."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {BUCKETS.map((b) => {
              const list = filtered.filter((i) => b.test(i.days));
              if (list.length === 0) return null;
              const money = list.reduce((s, i) => s + (i.kind === "pay" ? -(i.amount ?? 0) : i.kind === "receive" ? i.amount ?? 0 : 0), 0);
              return (
                <section key={b.id}>
                  <div className={`flex items-center justify-between px-1 mb-1.5 text-[11px] font-bold uppercase tracking-wider font-mono ${b.tone}`}>
                    <span>{b.label} · {list.length}</span>
                    {money !== 0 && <span className={money < 0 ? "text-rose-300" : "text-emerald-300"}>{money < 0 ? "−" : "+"} {brl(Math.abs(money))}</span>}
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-[#0a0f1d] divide-y divide-slate-800/80 overflow-hidden">
                    {list.map((i) => (
                      <Row key={i.key} item={i} onCheck={() => void complete(i)} onOpen={() => open(i)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => onGoTo("kanban")}
          className="w-full flex items-center justify-center gap-1 py-2 text-[11px] font-mono text-slate-500 hover:text-white cursor-pointer"
        >
          ver todas as pendências no Pipeline <ChevronRight size={12} />
        </button>
      </div>

      <TransactionModal
        isOpen={txModal.open}
        onClose={() => setTxModal({ open: false, tx: null })}
        onSaved={() => void load()}
        initialData={txModal.tx}
        defaults={txModal.defaults}
        modules={modules}
      />

      {undo && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-70 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white shadow-2xl">
          <span className="truncate max-w-48">
            {undo.kind === "task" ? "Concluída" : undo.kind === "receive" ? "Recebido" : "Pago"}: {undo.title}
          </span>
          <button onClick={() => void undoLast()} className="flex items-center gap-1 text-blue-300 font-bold cursor-pointer">
            <Undo2 size={13} /> desfazer
          </button>
        </div>
      )}
    </div>
  );
}

function Tile({
  icon, label, value, hint, tone, active, onClick, alert,
}: {
  icon: React.ReactNode; label: string; value: string; hint: string;
  tone: "rose" | "emerald" | "blue"; active: boolean; onClick: () => void; alert?: boolean;
}) {
  const tones = {
    rose: { text: "text-rose-400", ring: "border-rose-500/60 bg-rose-500/10" },
    emerald: { text: "text-emerald-400", ring: "border-emerald-500/60 bg-emerald-500/10" },
    blue: { text: "text-blue-400", ring: "border-blue-500/60 bg-blue-500/10" },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-2xl border p-3 sm:p-4 min-w-0 transition-colors cursor-pointer ${
        active ? tones.ring : "border-slate-800 bg-[#0a0f1d] hover:border-slate-600"
      }`}
    >
      <span className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider font-mono ${tones.text}`}>
        {icon} {label}
      </span>
      <span className="block mt-1.5 text-base sm:text-2xl font-bold font-mono text-white truncate" title={value}>{value}</span>
      <span className={`block text-[10px] sm:text-[11px] font-mono truncate ${alert ? tones.text : "text-slate-500"}`}>{hint}</span>
    </button>
  );
}

function MonthBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
        <span>{label}</span>
        <span className="truncate ml-1">{brlRound(value)} / {brlRound(total)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Quick({ onClick, label, tone }: { onClick: () => void; label: string; tone: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border bg-[#0a0f1d] text-xs font-bold hover:bg-slate-900 cursor-pointer ${tone}`}
    >
      <Plus size={14} /> {label}
    </button>
  );
}

function Row({ item, onCheck, onOpen }: { item: Item; onCheck: () => void; onOpen: () => void }) {
  const late = item.days < 0;
  const when =
    item.days < -1 ? `${Math.abs(item.days)} dias atrás` : item.days === -1 ? "ontem" : item.days === 0 ? "hoje" : item.days === 1 ? "amanhã" : fmtDate(item.due);
  const checkLabel = item.kind === "task" ? "Concluir" : item.kind === "receive" ? "Marcar como recebido" : "Marcar como pago";

  return (
    <div className="flex items-center gap-3 px-3 py-3 sm:py-2.5 hover:bg-[#050811] transition-colors">
      <button type="button" onClick={onCheck} className="shrink-0 p-1 -m-1 cursor-pointer group" title={checkLabel} aria-label={checkLabel}>
        <Circle size={22} className={`group-hover:hidden ${late ? "text-rose-400" : "text-slate-600"}`} />
        <CheckCircle2 size={22} className="hidden group-hover:block text-emerald-400" />
      </button>

      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left cursor-pointer">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-sm font-semibold text-slate-100 truncate">{item.title}</span>
        </span>
        <span className="block text-[11px] text-slate-500 truncate pl-3.5">{item.sub}</span>
      </button>

      <div className="text-right shrink-0">
        {item.kind === "task" ? (
          <span
            className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
              item.priority === "Urgente" ? "bg-red-500/20 text-red-300" : item.priority === "Alta" ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"
            }`}
          >
            {item.priority}
          </span>
        ) : (
          <span className={`text-sm font-bold font-mono ${item.kind === "receive" ? "text-emerald-400" : "text-slate-100"}`}>
            {item.kind === "receive" ? "+" : "−"} {brl(item.amount ?? 0)}
          </span>
        )}
        <span className={`block text-[10px] font-mono ${late ? "text-rose-400 font-bold" : "text-slate-500"}`}>{when}</span>
      </div>
    </div>
  );
}
