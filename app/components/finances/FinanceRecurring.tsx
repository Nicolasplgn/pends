"use client";

import { Plus, Repeat, Pencil, Trash2, Power, Send, CheckCircle2, Clock } from "lucide-react";
import type { FinanceRecurring as Recurring } from "../../types";
import { MONTH_NAMES, PAY_METHOD_LABEL } from "../../types";
import { brl } from "./format";
import { EmptyState, IconBtn, MethodIcon, Panel } from "./ui";

interface Props {
  recurring: Recurring[];
  month: number;
  onCreate: () => void;
  onEdit: (r: Recurring) => void;
  onDelete: (r: Recurring) => void;
  onToggleActive: (r: Recurring) => void;
  onLaunch: (ids?: string[]) => void;
}

export function FinanceRecurring({ recurring, month, onCreate, onEdit, onDelete, onToggleActive, onLaunch }: Props) {
  const active = recurring.filter((r) => r.active);
  const fixedExpense = active.filter((r) => r.type !== "INCOME").reduce((s, r) => s + (r.amount || 0), 0);
  const fixedIncome = active.filter((r) => r.type === "INCOME").reduce((s, r) => s + (r.amount || 0), 0);
  const pending = active.filter((r) => r.amount && !r.launchedTxId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Despesas fixas / mês" value={brl(fixedExpense)} tone="text-rose-400" />
        <Stat label="Receitas fixas / mês" value={brl(fixedIncome)} tone="text-emerald-400" />
        <Stat
          label="Sobra das fixas"
          value={brl(fixedIncome - fixedExpense)}
          tone={fixedIncome - fixedExpense >= 0 ? "text-blue-300" : "text-rose-300"}
        />
      </div>

      <Panel
        title="Contas fixas"
        icon={<Repeat size={14} className="text-sky-400" />}
        right={
          <div className="flex items-center gap-2">
            {pending.length > 0 && (
              <button
                type="button"
                onClick={() => onLaunch()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/40 text-sky-300 text-[11px] font-bold hover:bg-sky-500/10 cursor-pointer"
              >
                <Send size={12} /> Lançar {pending.length} em {MONTH_NAMES[month]}
              </button>
            )}
            <button
              type="button"
              onClick={onCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-700 cursor-pointer"
            >
              <Plus size={12} /> Nova
            </button>
          </div>
        }
      >
        {recurring.length === 0 ? (
          <EmptyState>
            Cadastre aluguel, internet, assinaturas, salário...<br />
            Todo mês você lança tudo com um clique.
          </EmptyState>
        ) : (
          <div className="space-y-1">
            {recurring.map((r) => (
              <div
                key={r.id}
                className={`group flex items-center gap-3 px-2.5 py-2 rounded-xl border border-transparent hover:border-slate-800 hover:bg-[#050811] ${
                  r.active ? "" : "opacity-45"
                }`}
              >
                <div className="w-9 text-center shrink-0">
                  <p className="text-[9px] text-slate-500 font-mono uppercase">dia</p>
                  <p className="text-sm font-bold text-white font-mono">{r.dueDay ?? "—"}</p>
                </div>
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: r.module?.color ?? "#64748b" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-100 truncate">{r.title}</p>
                  <p className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1"><MethodIcon method={r.paymentMethod} /> {PAY_METHOD_LABEL[r.paymentMethod]}</span>
                    <span>{r.module?.title ?? "Sem módulo"}</span>
                    {!r.active && <span className="text-slate-400">pausada</span>}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className={`text-[13px] font-bold font-mono ${r.type === "INCOME" ? "text-emerald-400" : "text-slate-100"}`}>
                    {r.type === "INCOME" ? "+" : "−"} {brl(r.amount ?? 0)}
                  </p>
                  {r.launchedTxId ? (
                    <p className={`flex items-center justify-end gap-1 text-[10px] font-mono ${r.launchedPaid ? "text-emerald-500" : "text-amber-400"}`}>
                      {r.launchedPaid ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                      {r.launchedPaid ? "paga no mês" : "lançada, em aberto"}
                    </p>
                  ) : r.active ? (
                    <button
                      type="button"
                      onClick={() => onLaunch([r.id])}
                      className="text-[10px] font-mono text-sky-400 hover:underline cursor-pointer"
                    >
                      lançar neste mês →
                    </button>
                  ) : (
                    <p className="text-[10px] font-mono text-slate-600">—</p>
                  )}
                </div>

                <div className="flex items-center shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity -mr-1">
                  <IconBtn title={r.active ? "Pausar" : "Reativar"} onClick={() => onToggleActive(r)}>
                    <Power size={13} />
                  </IconBtn>
                  <IconBtn title="Editar" onClick={() => onEdit(r)}>
                    <Pencil size={13} />
                  </IconBtn>
                  <IconBtn title="Excluir" danger onClick={() => onDelete(r)}>
                    <Trash2 size={13} />
                  </IconBtn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0a0f1d] p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">{label}</p>
      <p className={`text-xl font-bold font-mono mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
