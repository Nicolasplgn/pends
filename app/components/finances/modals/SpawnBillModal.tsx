"use client";

import { useState, useEffect } from "react";
import { MONTH_NAMES } from "../../../types";

interface SpawnBillModalProps {
  spawnTargetTask: any;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  onConfirmSpawn: (recurringId: string, amount: number | null, month: number, year: number) => Promise<void>;
}

export function SpawnBillModal({
  spawnTargetTask,
  onClose,
  selectedMonth,
  selectedYear,
  onConfirmSpawn,
}: SpawnBillModalProps) {
  const [spawnAmountInput, setSpawnAmountInput] = useState("");
  const [spawnMonth, setSpawnMonth] = useState<number>(selectedMonth);
  const [spawnYear, setSpawnYear] = useState<number>(selectedYear);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (spawnTargetTask) {
      setSpawnAmountInput(spawnTargetTask.amount ? spawnTargetTask.amount.toString() : "");
      setSpawnMonth(selectedMonth);
      setSpawnYear(selectedYear);
    }
  }, [spawnTargetTask, selectedMonth, selectedYear]);

  if (!spawnTargetTask) return null;

  async function handleSubmit() {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirmSpawn(
        spawnTargetTask.id,
        spawnAmountInput ? parseFloat(spawnAmountInput) : null,
        spawnMonth,
        spawnYear
      );
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white mb-2 uppercase tracking-wider font-mono">
          Lançar Fatura no Kanban
        </h3>
        <p className="text-xs text-slate-400 mb-4 font-sans">
          Conta: <span className="font-bold text-white">"{spawnTargetTask.title}"</span>. Escolha o mês e confirme o valor:
        </p>

        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Mês de Destino</label>
              <select
                value={spawnMonth}
                onChange={(e) => setSpawnMonth(parseInt(e.target.value))}
                className="w-full bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white font-mono outline-none focus:border-blue-500 cursor-pointer"
              >
                {/* ✅ TIPAGEM ADICIONADA */}
                {MONTH_NAMES.map((name: string, i: number) => (
                  <option key={name} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Ano</label>
              <select
                value={spawnYear}
                onChange={(e) => setSpawnYear(parseInt(e.target.value))}
                className="w-full bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white font-mono outline-none focus:border-blue-500 cursor-pointer"
              >
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Valor a Pagar (R$)</label>
            <input 
              type="number" 
              step="0.01" 
              autoFocus
              placeholder="Ex: 1420.50"
              value={spawnAmountInput}
              onChange={(e) => setSpawnAmountInput(e.target.value)}
              className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white font-mono outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-[#070a12] p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 font-mono">
            📅 Vencimento: <span className="text-white font-bold">{spawnTargetTask.dueDay || 1}/{spawnMonth + 1}/{spawnYear}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer">Cancelar</button>
          <button 
            type="button" 
            disabled={loading}
            onClick={() => { void handleSubmit(); }} 
            className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-500 cursor-pointer"
          >
            {loading ? "Lançando..." : "Lançar no Kanban"}
          </button>
        </div>
      </div>
    </div>
  );
}