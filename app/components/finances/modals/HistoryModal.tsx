"use client";

import { X, History, CheckCircle2, Circle } from "lucide-react";
import { MONTH_NAMES, isCardOverdue } from "../../../types";

interface HistoryModalProps {
  inspectingTask: any;
  onClose: () => void;
  onToggleComplete: (cardId: string) => Promise<void>;
  onStartSpawn: (task: any) => void;
}

export function HistoryModal({
  inspectingTask,
  onClose,
  onToggleComplete,
  onStartSpawn,
}: HistoryModalProps) {
  if (!inspectingTask) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f172a] border border-blue-900/50 rounded-3xl w-full max-w-xl shadow-2xl text-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-[#0a0f1d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <History size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                {inspectingTask.title}
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                Rastreamento de Lançamentos em Todos os Meses
              </span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white rounded cursor-pointer"
          >
            <X size={18}/>
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase font-bold mb-2">
            Histórico de Lançamentos no Kanban:
          </div>

          {(inspectingTask.cards ?? []).map((card: any) => {
            const overdue = isCardOverdue(card.dueDate, card.completed || card.column?.isDone);
            const d = card.dueDate ? new Date(card.dueDate) : new Date(card.createdAt);
            const isPaid = card.completed || card.column?.isDone;

            return (
              <div 
                key={card.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  isPaid 
                    ? "bg-[#0b1424] border-emerald-500/40" 
                    : overdue 
                      ? "bg-[#180d12] border-red-500/60" 
                      : "bg-[#111827] border-slate-800"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { void onToggleComplete(card.id); }}
                      className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      {isPaid ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} />}
                    </button>
                    <span className={`font-semibold text-sm ${isPaid ? "line-through text-slate-400" : "text-white"}`}>
                      {MONTH_NAMES[d.getMonth()]} / {d.getFullYear()}
                    </span>
                  </div>
                  
                  <div className="text-[10px] text-slate-400 font-mono mt-1 ml-6">
                    Etapa no Kanban: <span className="text-blue-300 font-bold">{card.column?.title}</span> • {card.dueDate ? `Vencimento: ${new Date(card.dueDate).toLocaleDateString('pt-BR')}` : "Sem data"}
                  </div>
                </div>

                <div>
                  {isPaid ? (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✓ Pago
                    </span>
                  ) : overdue ? (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                      ⚠️ Vencida
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      ⏳ Aberto
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {(inspectingTask.cards ?? []).length === 0 && (
            <div className="text-center py-10 text-slate-500 font-mono text-xs">
              Nenhum mês gerado para esta conta ainda.
            </div>
          )}
        </div>

        <div className="p-4 bg-[#070b14] border-t border-slate-800 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold rounded-xl cursor-pointer"
          >
            Fechar Janela
          </button>

          <button
            type="button"
            onClick={() => {
              const taskToSpawn = inspectingTask;
              onClose();
              onStartSpawn(taskToSpawn);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold uppercase rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/20"
          >
            Gerar Para Outro Mês
          </button>
        </div>
      </div>
    </div>
  );
}