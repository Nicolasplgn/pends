"use client";

import type { Module } from "@prisma/client";
import { CheckCircle2, Circle, Calendar, ExternalLink } from "lucide-react";
import type { KanbanColumn, KanbanCardData } from "../../types";
import { isCardOverdue } from "../../types";

interface KanbanTableViewProps {
  columns: KanbanColumn[];
  filteredCards: KanbanCardData[];
  modules: Module[];
  onCardClick: (cardId: string) => void;
  onToggleComplete: (cardId: string) => void;
  onChangeModule: (cardId: string, modId: string) => void;
}

export function KanbanTableView({
  columns,
  filteredCards,
  modules,
  onCardClick,
  onToggleComplete,
  onChangeModule,
}: KanbanTableViewProps) {
  // Mapa para localizar a coluna de cada card
  const columnMap = new Map<string, string>();
  columns.forEach((c) => {
    c.cards.forEach((card) => columnMap.set(card.id, c.title));
  });

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
      <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-175">
          <thead className="bg-[#0b101d] text-[10px] font-bold text-slate-400 uppercase font-mono border-b border-slate-800">
            <tr>
              <th className="p-3.5 w-10 text-center">Status</th>
              <th className="p-3.5">Título da Pendência</th>
              <th className="p-3.5">Módulo</th>
              <th className="p-3.5">Etapa Atual</th>
              <th className="p-3.5">Prioridade</th>
              <th className="p-3.5">Vencimento</th>
              <th className="p-3.5 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300 font-sans">
            {filteredCards.map((card) => {
              const overdue = isCardOverdue(card.dueDate, card.completed);
              const colTitle = columnMap.get(card.id) || "Geral";

              return (
                <tr 
                  key={card.id} 
                  onClick={() => onCardClick(card.id)}
                  className="hover:bg-[#121829] cursor-pointer transition-colors group"
                >
                  <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onToggleComplete(card.id)}
                      className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      {card.completed ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} className={overdue ? "text-red-400" : ""} />}
                    </button>
                  </td>

                  <td className="p-3.5 font-semibold text-slate-200">
                    <span className={card.completed ? "line-through text-slate-500" : overdue ? "text-red-200" : ""}>
                      {card.title}
                    </span>
                  </td>

                  <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={card.moduleId || ""}
                      onChange={(e) => onChangeModule(card.id, e.target.value)}
                      className="text-[10px] font-bold px-2 py-1 rounded-md outline-none cursor-pointer bg-slate-900 border border-slate-800"
                      style={{ color: card.module ? card.module.color : "#94a3b8" }}
                    >
                      <option value="">Sem Módulo</option>
                      {modules.map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#0f172a] text-white">
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-3.5 font-mono text-[11px] text-cyan-400">
                    {colTitle}
                  </td>

                  <td className="p-3.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                      card.priority === "Urgente" ? "bg-red-500/20 text-red-400 border border-red-500/40" :
                      card.priority === "Alta" ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"
                    }`}>
                      {card.priority}
                    </span>
                  </td>

                  <td className="p-3.5 font-mono text-[11px]">
                    {card.dueDate ? (
                      <span className={overdue ? "text-red-400 font-bold flex items-center gap-1" : "text-slate-400 flex items-center gap-1"}>
                        <Calendar size={11} />
                        {new Date(card.dueDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="p-3.5 text-right">
                    <span className="text-slate-500 group-hover:text-blue-400 transition-colors inline-flex items-center gap-1 text-[10px] font-mono">
                      Abrir <ExternalLink size={12} />
                    </span>
                  </td>
                </tr>
              );
            })}

            {filteredCards.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-500 font-mono text-xs">
                  Nenhuma pendência encontrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}