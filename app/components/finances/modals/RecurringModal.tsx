"use client";

import { useEffect, useState } from "react";
import type { Module } from "@prisma/client";
import { X, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { createRecurringTask, updateRecurringTask } from "@/app/actions";
import type { FinanceRecurring, PayMethod, TxType } from "../../../types";
import { PAY_METHOD_LABEL } from "../../../types";
import { moneyToInput, parseMoney } from "../format";
import { MethodIcon } from "../ui";

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  initialData?: FinanceRecurring | null;
  modules: Module[];
}

const inputCls =
  "w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500";
const labelCls = "text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1";

export function RecurringModal({ isOpen, onClose, onSaved, initialData, modules }: RecurringModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TxType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [moduleId, setModuleId] = useState("");
  const [method, setMethod] = useState<PayMethod>("BOLETO");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setTitle(initialData?.title ?? "");
    setType(initialData?.type ?? "EXPENSE");
    setAmount(moneyToInput(initialData?.amount));
    setDueDay(String(initialData?.dueDay ?? 10));
    setModuleId(initialData?.moduleId ?? modules[0]?.id ?? "");
    setMethod((initialData?.paymentMethod as PayMethod) ?? "BOLETO");
  }, [isOpen, initialData, modules]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseMoney(amount);
    if (!title.trim()) return setError("Dá um nome pra conta.");
    if (!(value > 0)) return setError("Informe o valor mensal.");
    setSaving(true);
    try {
      const payload = {
        title,
        amount: value,
        dueDay: Number(dueDay) || null,
        moduleId: moduleId || null,
        type,
        paymentMethod: method,
      };
      if (initialData) await updateRecurringTask(initialData.id, payload);
      else await createRecurringTask(payload);
      onSaved(initialData ? "Conta fixa atualizada" : "Conta fixa criada");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-[#0a0f1d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            {initialData ? "Editar conta fixa" : "Nova conta fixa"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["EXPENSE", "INCOME"] as TxType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-bold font-mono cursor-pointer ${
                  type === t
                    ? t === "INCOME"
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/50 text-rose-400"
                    : "border-slate-800 text-slate-500"
                }`}
              >
                {t === "INCOME" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {t === "INCOME" ? "Receita fixa" : "Despesa fixa"}
              </button>
            ))}
          </div>

          <div>
            <label className={labelCls}>Nome</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Aluguel, internet, salário..." className={inputCls} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Valor mensal</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">R$</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={`${inputCls} pl-9 font-mono font-bold`} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Dia do vencimento</label>
              <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Módulo</label>
              <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={inputCls}>
                <option value="">Sem módulo</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Pagamento</label>
              <div className="flex items-center gap-2">
                <MethodIcon method={method} size={14} />
                <select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} className={inputCls}>
                  {Object.entries(PAY_METHOD_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-60 cursor-pointer">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
