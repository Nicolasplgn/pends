"use client";

import { useState, useEffect } from "react";
import type { Module } from "@prisma/client";
import { Wallet } from "lucide-react";

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRecurring: any;
  modules: Module[];
  onSave: (title: string, amount: number | null, dueDay: number | null, moduleId: string) => Promise<void>;
}

export function RecurringModal({
  isOpen,
  onClose,
  editingRecurring,
  modules,
  onSave,
}: RecurringModalProps) {
  const [recTitle, setRecTitle] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recDueDay, setRecDueDay] = useState("");
  const [newModuleId, setNewModuleId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingRecurring) {
      setRecTitle(editingRecurring.title);
      setRecAmount(editingRecurring.amount ? editingRecurring.amount.toString() : "");
      setRecDueDay(editingRecurring.dueDay ? editingRecurring.dueDay.toString() : "");
      setNewModuleId(editingRecurring.moduleId || "");
    } else {
      setRecTitle("");
      setRecAmount("");
      setRecDueDay("");
      setNewModuleId("");
    }
  }, [editingRecurring, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!recTitle.trim() || saving) return;
    setSaving(true);
    try {
      const finalAmount = recAmount ? parseFloat(recAmount) : null;
      const finalDueDay = recDueDay ? parseInt(recDueDay) : null;
      await onSave(recTitle.trim(), finalAmount, finalDueDay, newModuleId);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wider font-mono flex items-center gap-2">
          <Wallet size={16} className="text-emerald-400"/> {editingRecurring ? "Editar Conta / Rotina" : "Cadastrar Conta / Rotina"}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Título / Conta</label>
            <input className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-emerald-500" placeholder="Ex: Cartão Nubank" value={recTitle} onChange={e => setRecTitle(e.target.value)} />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block">Valor Atual (R$)</label>
              <span className="text-[10px] text-slate-500 font-mono">Pode alterar a qualquer momento</span>
            </div>
            <input 
              type="number" 
              step="0.01" 
              className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-emerald-500 font-mono" 
              placeholder="Ex: 1450.00" 
              value={recAmount} 
              onChange={e => setRecAmount(e.target.value)} 
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Dia do Vencimento no Mês</label>
            <input type="number" min="1" max="31" className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-emerald-500 font-mono" placeholder="Ex: 10" value={recDueDay} onChange={e => setRecDueDay(e.target.value)} />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Módulo Vinculado</label>
            <select className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-emerald-500 cursor-pointer" value={newModuleId} onChange={e => setNewModuleId(e.target.value)}>
              <option value="">Nenhum</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer">Cancelar</button>
          <button type="button" disabled={saving} onClick={() => { void handleSubmit(); }} className="px-4 py-2 bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-500 cursor-pointer">
            {saving ? "Salvando..." : editingRecurring ? "Salvar Alterações" : "Salvar Rotina"}
          </button>
        </div>
      </div>
    </div>
  );
}