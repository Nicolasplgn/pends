"use client";

import { useState, useEffect } from "react";
import { X, Columns, CheckCheck, Snowflake, Sparkles } from "lucide-react";
import type { KanbanColumn } from "../../types";

interface ColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  column: KanbanColumn | null;
  onSave: (title: string, isDone: boolean) => Promise<void>;
}

export function ColumnModal({
  isOpen,
  onClose,
  column,
  onSave,
}: ColumnModalProps) {
  const [title, setTitle] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (column) {
      setTitle(column.title);
      setIsDone(column.isDone);
    } else {
      setTitle("");
      setIsDone(false);
    }
  }, [column, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    try {
      await onSave(title.trim(), isDone);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  // PRESETS RÁPIDOS
  function applyPreset(presetTitle: string, presetIsDone: boolean) {
    setTitle(presetTitle);
    setIsDone(presetIsDone);
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b101f] border border-blue-900/40 w-full max-w-md rounded-3xl shadow-2xl p-6 text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Columns size={18} />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-mono tracking-wide">
              {column ? "Editar Etapa" : "Nova Etapa do Kanban"}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODELOS RÁPIDOS DE 1 CLIQUE */}
        {!column && (
          <div className="mb-4">
            {/* ✅ Removido o 'block' conflitante com 'flex' */}
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5 flex items-center gap-1">
              <Sparkles size={11} className="text-cyan-400" /> Modelos Sugeridos:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset("🧊 No Radar (Gelo)", false)}
                className="px-2.5 py-1 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/80 text-cyan-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Snowflake size={12} />
                <span>🧊 No Radar (Gelo)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset("⚙️ Em Produção", false)}
                className="px-2.5 py-1 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/80 text-blue-300 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
              >
                <span>⚙️ Em Produção</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset("✅ Concluído", true)}
                className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/80 text-emerald-300 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
              >
                <span>✅ Concluído</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <div>
            <label className="text-[11px] uppercase font-mono font-bold text-slate-400 block mb-1">
              Nome da Etapa
            </label>
            <input 
              type="text" 
              autoFocus
              required
              placeholder="Ex: 🧊 No Radar (Gelo)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#070a12] border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition-all font-sans"
            />
          </div>

          {/* TOGGLE ESTILIZADO DE CONCLUSÃO */}
          <div 
            onClick={() => setIsDone(!isDone)}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
              isDone 
                ? "bg-emerald-950/20 border-emerald-500/50" 
                : "bg-[#070a12] border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="pr-3">
              <span className={`text-xs font-bold font-mono block ${isDone ? "text-emerald-400" : "text-slate-300"}`}>
                Etapa de Conclusão / Finalização
              </span>
              <span className="text-[10px] text-slate-500 font-sans block mt-0.5 leading-snug">
                Tarefas movidas para cá serão dadas como concluídas automaticamente. (Deixe desmarcado para a etapa de Gelo).
              </span>
            </div>

            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
              isDone ? "bg-emerald-600 border-emerald-400 text-white" : "border-slate-700 bg-slate-900"
            }`}>
              {isDone && <CheckCheck size={13} />}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800/80">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2.5 text-xs font-bold font-mono text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider font-mono shadow-lg shadow-blue-600/20 cursor-pointer transition-all"
            >
              {loading ? "Salvando..." : column ? "Salvar Alterações" : "Criar Etapa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}