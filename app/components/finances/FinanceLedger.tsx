"use client";

import { useMemo, useState } from "react";
import { Search, CheckCheck, Undo2, X, ArrowDownUp } from "lucide-react";
import type { FinanceTx } from "../../types";
import { brl, daysUntil } from "./format";
import { EmptyState, Panel, TxRow } from "./ui";
import type { TxHandlers } from "./FinanceOverview";

export type LedgerFilter = "ALL" | "OPEN" | "PAID" | "OVERDUE" | "INCOME" | "EXPENSE" | "CARD";

const FILTERS: [LedgerFilter, string][] = [
  ["ALL", "Tudo"],
  ["OPEN", "A pagar"],
  ["OVERDUE", "Atrasados"],
  ["PAID", "Pagos"],
  ["EXPENSE", "Saídas"],
  ["INCOME", "Entradas"],
  ["CARD", "Cartão"],
];

interface Props {
  transactions: FinanceTx[];
  carryOver: FinanceTx[];
  handlers: TxHandlers;
  filter: LedgerFilter;
  setFilter: (f: LedgerFilter) => void;
  onBulkPaid: (ids: string[], paid: boolean) => Promise<void>;
}

export function FinanceLedger({ transactions, carryOver, handlers, filter, setFilter, onBulkPaid }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const source = useMemo(
    () => (filter === "OVERDUE" || filter === "OPEN" ? [...carryOver, ...transactions] : transactions),
    [filter, carryOver, transactions]
  );

  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort(), [transactions]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = source.filter((t) => {
      if (q && !t.description.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q) && !(t.notes ?? "").toLowerCase().includes(q)) return false;
      if (category !== "ALL" && t.category !== category) return false;
      switch (filter) {
        case "OPEN": return !t.paid && t.type !== "INCOME";
        case "PAID": return t.paid;
        case "OVERDUE": return !t.paid && t.type !== "INCOME" && daysUntil(t.dueDate) < 0;
        case "INCOME": return t.type === "INCOME";
        case "EXPENSE": return t.type !== "INCOME";
        case "CARD": return t.paymentMethod === "CREDIT_CARD";
        default: return true;
      }
    });
    return list.sort((a, b) =>
      sort === "amount" ? b.amount - a.amount : new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }, [source, search, category, filter, sort]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of items) {
      if (t.type === "INCOME") inc += t.amount;
      else exp += t.amount;
    }
    return { inc, exp };
  }, [items]);

  const selectedItems = items.filter((t) => selected.has(t.id));
  const selectedTotal = selectedItems.reduce((s, t) => s + t.amount, 0);

  function toggleSel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(paid: boolean) {
    await onBulkPaid(selectedItems.map((t) => t.id), paid);
    setSelected(new Set());
  }

  const allSelected = items.length > 0 && items.every((t) => selected.has(t.id));

  return (
    <Panel>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição, módulo, observação..."
              className="w-full bg-[#050811] border border-slate-800 rounded-lg pl-8 pr-8 py-2 text-xs text-white outline-none focus:border-blue-500"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer" aria-label="Limpar busca">
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none"
          >
            <option value="ALL">Todos os módulos</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setSort((s) => (s === "date" ? "amount" : "date"))}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            <ArrowDownUp size={12} /> {sort === "date" ? "Por data" : "Por valor"}
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap border cursor-pointer transition ${
                filter === f ? "bg-slate-800 border-slate-600 text-white font-bold" : "border-transparent text-slate-500 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-blue-500/40 bg-blue-500/5 text-xs">
            <span className="text-blue-200 font-mono">
              {selected.size} selecionado(s) · {brl(selectedTotal)}
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => void bulk(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold cursor-pointer">
                <CheckCheck size={13} /> Marcar pagos
              </button>
              <button onClick={() => void bulk(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 cursor-pointer">
                <Undo2 size={13} /> Desmarcar
              </button>
              <button onClick={() => setSelected(new Set())} className="px-2 text-slate-400 hover:text-white cursor-pointer" aria-label="Limpar seleção">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState>Nenhum lançamento com esses filtros.</EmptyState>
        ) : (
          <>
            <label className="flex items-center gap-2 px-2.5 text-[10px] text-slate-500 font-mono cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((t) => t.id)))}
                className="accent-blue-500 w-3.5 h-3.5"
              />
              selecionar todos ({items.length})
            </label>
            <div className="space-y-1">
              {items.map((t) => (
                <TxRow
                  key={t.id}
                  tx={t}
                  moduleColor={handlers.colorOf(t.category)}
                  selected={selected.has(t.id)}
                  onSelect={() => toggleSel(t.id)}
                  onToggle={() => handlers.onToggle(t)}
                  onEdit={() => handlers.onEdit(t)}
                  onDelete={() => handlers.onDelete(t)}
                  onKanban={() => handlers.onKanban(t)}
                  onOpenCard={handlers.onOpenCard}
                />
              ))}
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-x-5 gap-y-1 pt-3 border-t border-slate-800 text-[11px] font-mono">
          <span className="text-slate-500">Entradas <b className="text-emerald-400">{brl(totals.inc)}</b></span>
          <span className="text-slate-500">Saídas <b className="text-rose-400">{brl(totals.exp)}</b></span>
          <span className="text-slate-500">
            Resultado <b className={totals.inc - totals.exp >= 0 ? "text-blue-300" : "text-rose-300"}>{brl(totals.inc - totals.exp)}</b>
          </span>
        </div>
      </div>
    </Panel>
  );
}
