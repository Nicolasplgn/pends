"use client";

import { Layers, CheckCircle2, Trash2 } from "lucide-react";
import type { FinanceInstallmentGroup } from "../../types";
import { MONTH_NAMES, PAY_METHOD_LABEL } from "../../types";
import { brl, dueLabel, fmtDate } from "./format";
import { Bar, EmptyState, IconBtn, MethodIcon, Panel } from "./ui";

interface Props {
  installments: FinanceInstallmentGroup[];
  colorOf: (category: string) => string;
  onPayNext: (txId: string) => void;
  onDeleteRemaining: (group: FinanceInstallmentGroup) => void;
}

export function FinanceInstallments({ installments, colorOf, onPayNext, onDeleteRemaining }: Props) {
  const remaining = installments.reduce((s, g) => s + (g.type === "INCOME" ? 0 : g.remainingAmount), 0);
  const monthly = installments.reduce((s, g) => s + (g.type === "INCOME" ? 0 : g.parcelAmount), 0);
  const lastEnd = installments.reduce<Date | null>(
    (acc, g) => (!acc || new Date(g.lastDueDate) > acc ? new Date(g.lastDueDate) : acc),
    null
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Ainda a pagar" value={brl(remaining)} tone="text-violet-300" />
        <Stat label="Parcelas por mês (hoje)" value={brl(monthly)} tone="text-rose-400" />
        <Stat
          label="Livre de parcelas em"
          value={lastEnd ? `${MONTH_NAMES[lastEnd.getUTCMonth()].slice(0, 3)}/${lastEnd.getUTCFullYear()}` : "—"}
          tone="text-emerald-400"
        />
      </div>

      <Panel title="Parcelamentos ativos" icon={<Layers size={14} className="text-violet-400" />}>
        {installments.length === 0 ? (
          <EmptyState>Nenhum parcelamento em aberto. 🎉</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {installments.map((g) => {
              const end = new Date(g.lastDueDate);
              return (
                <div key={g.installmentId} className="rounded-xl border border-slate-800 bg-[#050811] p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-white truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(g.category) }} />
                        {g.description}
                      </p>
                      <p className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span className="flex items-center gap-1"><MethodIcon method={g.paymentMethod} /> {PAY_METHOD_LABEL[g.paymentMethod]}</span>
                        <span>{g.category}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold font-mono text-white">{brl(g.parcelAmount)}</p>
                      <p className="text-[10px] font-mono text-slate-500">por mês</p>
                    </div>
                  </div>

                  <Bar value={g.paidCount} max={g.totalCount} color="#8b5cf6" />

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>
                      {g.paidCount}/{g.totalCount} pagas · faltam <b className="text-violet-300">{brl(g.remainingAmount)}</b>
                    </span>
                    <span>até {MONTH_NAMES[end.getUTCMonth()].slice(0, 3)}/{end.getUTCFullYear()}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-500">
                      próxima {g.nextDueDate ? `${fmtDate(g.nextDueDate, true)} · ${dueLabel(g.nextDueDate)}` : "—"}
                    </span>
                    <div className="flex items-center gap-1">
                      {g.nextTxId && (
                        <button
                          type="button"
                          onClick={() => onPayNext(g.nextTxId!)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                        >
                          <CheckCircle2 size={11} /> pagar próxima
                        </button>
                      )}
                      {g.nextTxId && (
                        <IconBtn title="Excluir parcelas restantes" danger onClick={() => onDeleteRemaining(g)}>
                          <Trash2 size={13} />
                        </IconBtn>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
