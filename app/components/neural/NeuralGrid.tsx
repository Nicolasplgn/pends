"use client";

import { Flame, Calendar, Circle, Clock, Zap, ArrowUpRight } from "lucide-react";
import type { NeuralNode, NeuralCard } from "../../types";
import { isCardOverdue } from "../../types";

interface NeuralGridProps {
  moduleNodes: NeuralNode[];
  totalAllTasks: number;
  completedAllTasks: number;
  allUrgentCards: NeuralCard[];
  allOverdueCards: NeuralCard[];
  onSelectModule: (node: NeuralNode) => void;
  onToggleComplete: (cardId: string) => void;
}

export function NeuralGrid({
  moduleNodes,
  totalAllTasks,
  completedAllTasks,
  allUrgentCards,
  allOverdueCards,
  onSelectModule,
  onToggleComplete,
}: NeuralGridProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">

        {/* HERO KPIS */}
        <div className="md:col-span-2 bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-all">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/80">
                NÚCLEO DO SISTEMA
              </span>
              <span className="text-xs font-mono text-slate-400">
                {moduleNodes.length} Módulos Ativos
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">
              Você tem {totalAllTasks} pendências mapeadas.
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg font-sans">
              {allOverdueCards.length > 0 
                ? `Atenção: ${allOverdueCards.length} tarefas estão com prazo vencido e exigem resolução.`
                : "Todas as suas tarefas estão dentro do cronograma previsto."}
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-slate-800/80">
            <div className="bg-[#070b14]/70 p-3 rounded-2xl border border-slate-800/60">
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Concluídas</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">{completedAllTasks}</span>
            </div>
            <div className="bg-[#070b14]/70 p-3 rounded-2xl border border-slate-800/60">
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">A Fazer</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">{totalAllTasks - completedAllTasks}</span>
            </div>
            <div className="bg-[#070b14]/70 p-3 rounded-2xl border border-slate-800/60">
              <span className="text-[10px] font-mono uppercase text-red-400 block mb-1">Atrasadas</span>
              <span className={`text-xl sm:text-2xl font-bold font-mono ${allOverdueCards.length > 0 ? "text-red-400 animate-pulse" : "text-slate-500"}`}>
                {allOverdueCards.length}
              </span>
            </div>
          </div>
        </div>

        {/* RADAR CRÍTICO */}
        <div className="bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 shadow-xl flex flex-col justify-between group hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Flame size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white uppercase font-mono">Radar Crítico</h4>
                  <span className="text-[10px] text-slate-400 font-mono">Alta prioridade</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-full">
                {allUrgentCards.length}
              </span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {allUrgentCards.slice(0, 3).map((card) => (
                <div key={card.id} className="p-2.5 rounded-xl bg-[#070b14] border border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-slate-200">{card.title}</span>
                  <button 
                    type="button" 
                    onClick={() => onToggleComplete(card.id)}
                    className="p-1 hover:text-emerald-400 text-slate-500 cursor-pointer shrink-0"
                    title="Concluir"
                  >
                    <Circle size={15} />
                  </button>
                </div>
              ))}
              {allUrgentCards.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs font-mono">Nenhuma prioridade urgente.</div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/60 mt-4 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>Tempo Real</span>
            <Zap size={13} className="text-amber-400" />
          </div>
        </div>

        {/* PRAZOS */}
        <div className="bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 shadow-xl flex flex-col justify-between group hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Calendar size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white uppercase font-mono">Prazos</h4>
                  <span className="text-[10px] text-slate-400 font-mono">Controle de datas</span>
                </div>
              </div>
              {allOverdueCards.length > 0 && (
                <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950/60 border border-red-800 px-2 py-0.5 rounded-full animate-pulse">
                  ⚠️ {allOverdueCards.length} vencidas
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {allOverdueCards.slice(0, 3).map((card) => (
                <div key={card.id} className="p-2.5 rounded-xl bg-[#160b10] border border-red-500/40 flex items-center justify-between gap-2 text-xs">
                  <div className="truncate">
                    <span className="truncate font-semibold text-red-200 block">{card.title}</span>
                    <span className="text-[9px] font-mono text-red-400">
                      Venceu em {card.dueDate ? new Date(card.dueDate).toLocaleDateString('pt-BR') : ""}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => onToggleComplete(card.id)}
                    className="p-1 hover:text-emerald-400 text-red-400 cursor-pointer shrink-0"
                    title="Concluir"
                  >
                    <Circle size={15} />
                  </button>
                </div>
              ))}
              {allOverdueCards.length === 0 && (
                <div className="text-center py-8 text-emerald-400/80 text-xs font-mono">✓ Tudo em dia! Sem atrasos.</div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/60 mt-4 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>Cronograma</span>
            <Clock size={13} className="text-blue-400" />
          </div>
        </div>

        {/* CARTÕES DOS MÓDULOS */}
        {moduleNodes.map((node) => {
          const hasOverdue = node.cards.some((c) => isCardOverdue(c.dueDate, c.completed));
          return (
            <div 
              key={node.id}
              onClick={() => onSelectModule(node)}
              className={`bg-[#0b101f] border rounded-3xl p-5 shadow-xl flex flex-col justify-between cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden group ${
                hasOverdue ? "border-red-500/60 ring-1 ring-red-500/30" : "border-slate-800/90 hover:border-slate-600"
              }`}
            >
              <div 
                className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-20 transition-opacity group-hover:opacity-40"
                style={{ backgroundColor: node.color }}
              />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full shadow-md shrink-0" style={{ backgroundColor: node.color }} />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono line-clamp-1">
                      {node.title}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/70 px-2 py-0.5 rounded-full">
                    {node.percent}%
                  </span>
                </div>

                <div className="w-full bg-[#070b14] h-2 rounded-full overflow-hidden border border-slate-800/80 mb-4 p-0.5">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ width: `${node.percent}%`, backgroundColor: node.color }} 
                  />
                </div>

                <div className="space-y-2 mb-4">
                  {node.cards.slice(0, 3).map((card) => {
                    const overdue = isCardOverdue(card.dueDate, card.completed);
                    return (
                      <div 
                        key={card.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                          card.completed 
                            ? "bg-[#070b14]/50 border-slate-800/60 opacity-60" 
                            : overdue 
                              ? "bg-[#180d12] border-red-500/50" 
                              : "bg-[#070b14] border-slate-800"
                        }`}
                      >
                        <span className={`font-semibold line-clamp-1 flex-1 ${
                          card.completed ? "line-through text-slate-500" : overdue ? "text-red-200" : "text-slate-200"
                        }`}>
                          {card.title}
                        </span>
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                          card.completed ? "bg-emerald-950 text-emerald-400" :
                          overdue ? "bg-red-950 text-red-400" :
                          card.priority === "Urgente" ? "bg-red-500/20 text-red-400" :
                          "bg-slate-800 text-slate-400"
                        }`}>
                          {card.completed ? "Feito" : overdue ? "Vencida" : card.priority}
                        </span>
                      </div>
                    );
                  })}
                  {node.cards.length === 0 && (
                    <div className="text-center py-5 text-slate-600 text-xs font-mono">Nenhuma pendência ativa.</div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400">
                  {node.total} tarefas • {node.completed} prontas
                </span>
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
                  <span>Abrir</span>
                  <ArrowUpRight size={14} />
                </div>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}