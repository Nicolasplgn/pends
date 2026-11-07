"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { deleteTransaction, type TxScope } from "@/app/actions";
import type { FinanceTx } from "../../../types";
import { brl } from "../format";

interface DeleteTxModalProps {
  tx: FinanceTx | null;
  onClose: () => void;
  onDeleted: (message: string) => void;
}

export function DeleteTxModal({ tx, onClose, onDeleted }: DeleteTxModalProps) {
  const [busy, setBusy] = useState(false);
  if (!tx) return null;

  async function run(scope: TxScope) {
    setBusy(true);
    try {
      await deleteTransaction(tx!.id, scope);
      onDeleted(scope === "one" ? "Lançamento excluído" : "Parcelas excluídas");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const btn = "w-full py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0a0f1d] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">Excluir lançamento?</h3>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {tx.description} · {brl(tx.amount)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {tx.isInstallment ? (
            <>
              <button disabled={busy} onClick={() => run("one")} className={`${btn} border-slate-700 text-slate-200 hover:bg-slate-800`}>
                Só esta parcela ({tx.installmentCurrent}/{tx.installmentTotal})
              </button>
              <button disabled={busy} onClick={() => run("future")} className={`${btn} border-rose-500/40 text-rose-300 hover:bg-rose-500/10`}>
                Esta e as próximas
              </button>
              <button disabled={busy} onClick={() => run("all")} className={`${btn} border-rose-500 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30`}>
                Todas as {tx.installmentTotal} parcelas
              </button>
            </>
          ) : (
            <button disabled={busy} onClick={() => run("one")} className={`${btn} border-rose-500 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30`}>
              Sim, excluir
            </button>
          )}
          <button onClick={onClose} className={`${btn} border-slate-800 text-slate-400 hover:text-white`}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
