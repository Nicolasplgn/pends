"use client";

import { useMemo, useState } from "react";
import { 
  X, Flame, Clock, FileText, Layers, CheckCircle2, Circle, Calendar, ArrowRight 
} from "lucide-react";
import type { NeuralNode, NeuralCard } from "../../types";
import { isCardOverdue } from "../../types";

interface NeuralBottomSheetProps {
  selectedModule: NeuralNode | null;
  onClose: () => void;
  onSelectModule: (modId: string) => void;
  onToggleComplete: (cardId: string) => void;
}

export function NeuralBottomSheet({
  selectedModule,
  onClose,
  onSelectModule,
  onToggleComplete,
}: NeuralBottomSheetProps) {
  const [activeTab, setActiveTab] = useState<"urgent" | "deadlines" | "notes" | "all">("urgent");

  const urgentCards = useMemo(() => {
    if (!selectedModule) return [];
    return selectedModule.cards.filter((c) => !c.completed && (c.priority === "Urgente" || c.priority === "Alta"));
  }, [selectedModule]);

  const overdueAndUpcoming = useMemo(() => {
    if (!selectedModule) return [];
    return selectedModule.cards.filter((c) => !c.completed && c.dueDate);
  }, [selectedModule]);

  const cardsWithNotes = useMemo(() => {
    if (!selectedModule) return [];
    return selectedModule.cards.filter((c) => c.description && c.description.trim().length > 0);
  }, [selectedModule]);

  if (!selectedModule) return null;

  let displayCards: NeuralCard[] = [];
  if (activeTab === "urgent") displayCards = urgentCards;
  else if (activeTab === "deadlines") displayCards = overdueAndUpcoming;
  else if (activeTab === "notes") displayCards = cardsWithNotes;
  else displayCards = selectedModule.cards;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full sm:max-w-2xl bg-[#0b101f] border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.9)] max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden text-slate-200"
        style={{ borderTopColor: selectedModule.color }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* GRABBER BAR PARA SMARTPHONE */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* HEADER DA GAVETA */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#070b14]/90">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: selectedModule.color }} />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <span>{selectedModule.title}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800">
                  {selectedModule.total} tarefas
                </span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                Conclusão: {selectedModule.percent}% • {selectedModule.completed} de {selectedModule.total} feitas
              </span>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50 hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ABAS ROLÁVEIS */}
        <div className="bg-[#070a12] px-4 sm:px-6 py-2.5 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto shrink-0">
          <button 
            type="button"
            onClick={() => setActiveTab("urgent")} 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "urgent" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame size={12} className="text-amber-400" />
            <span>Críticas ({urgentCards.length})</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab("deadlines")} 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "deadlines" ? "bg-red-500/20 text-red-300 border border-red-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock size={12} className="text-red-400" />
            <span>Prazos ({overdueAndUpcoming.length})</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab("notes")} 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "notes" ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText size={12} className="text-blue-400" />
            <span>Observações ({cardsWithNotes.length})</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab("all")} 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "all" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers size={12} />
            <span>Todas ({selectedModule.cards.length})</span>
          </button>
        </div>

        {/* LISTA DE PENDÊNCIAS COM CHECKBOX */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
          {displayCards.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs">
              Nenhuma pendência encontrada nesta categoria.
            </div>
          ) : (
            displayCards.map((c) => {
              const overdue = isCardOverdue(c.dueDate, c.completed);
              return (
                <div 
                  key={c.id} 
                  className={`p-3.5 rounded-2xl border transition-all ${
                    c.completed 
                      ? "bg-[#080d1a] border-emerald-950/60 opacity-60" 
                      : overdue 
                        ? "bg-[#180d12] border-red-500/60" 
                        : "bg-[#0e1424] border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <button
                        type="button"
                        onClick={() => onToggleComplete(c.id)}
                        className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                      >
                        {c.completed ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Circle size={18} />}
                      </button>
                      <span className={`font-semibold text-sm truncate ${c.completed ? "line-through text-slate-500" : "text-white"}`}>
                        {c.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                      {c.columnTitle}
                    </span>
                  </div>

                  {c.description && (
                    <div className="bg-[#070a12] p-2.5 rounded-xl border border-slate-800/80 text-xs text-slate-300 font-sans mt-2 whitespace-pre-wrap leading-relaxed">
                      {c.description}
                    </div>
                  )}

                  {c.dueDate && (
                    <div className={`text-[10px] font-mono mt-2 flex items-center gap-1.5 ${
                      overdue ? "text-red-400 font-bold" : "text-slate-400"
                    }`}>
                      <Calendar size={11} className={overdue ? "text-red-400" : "text-blue-400"} />
                      <span>{overdue ? `Venceu em: ${new Date(c.dueDate).toLocaleDateString('pt-BR')}` : `Vencimento: ${new Date(c.dueDate).toLocaleDateString('pt-BR')}`}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* RODAPÉ DO BOTTOM SHEET */}
        <div className="p-4 sm:p-5 bg-[#070b14] border-t border-slate-800 flex justify-between items-center shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold rounded-xl cursor-pointer"
          >
            Fechar
          </button>
          <button 
            type="button" 
            onClick={() => {
              onSelectModule(selectedModule.id);
              onClose();
            }} 
            className="py-2.5 px-5 rounded-xl font-bold text-xs uppercase tracking-wider font-mono text-white flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all hover:brightness-110"
            style={{ backgroundColor: selectedModule.color }}
          >
            <span>Acessar Pipeline</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}