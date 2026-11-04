"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Module } from "@prisma/client";
import { CheckCheck, Pencil, Trash2, Plus } from "lucide-react";
import type { KanbanColumn as KanbanColumnType, KanbanCardData } from "../../types";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  col: KanbanColumnType;
  cards: KanbanCardData[];
  onEdit: () => void;
  onDelete: () => void;
  onAddCard: () => void;
  onCardClick: (cardId: string) => void;
  modules: Module[];
  onNextStage: (cardId: string) => void;
  onChangeModule: (cardId: string, modId: string) => void;
  onToggleComplete: (cardId: string) => void;
}

export function KanbanColumn({
  col,
  cards,
  onEdit,
  onDelete,
  onAddCard,
  onCardClick,
  modules,
  onNextStage,
  onChangeModule,
  onToggleComplete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div 
      ref={setNodeRef}
      className={`w-80 shrink-0 bg-[#0f172a] border rounded-2xl flex flex-col max-h-full shadow-2xl transition-all duration-200 ${
        isOver 
          ? "border-blue-500 bg-[#0f1b35] ring-2 ring-blue-500/40" 
          : col.isDone 
            ? "border-emerald-800/60 bg-[#0b1424]/40" 
            : "border-slate-800"
      }`}
    >
      <div className="p-3.5 font-bold text-xs uppercase tracking-wider text-slate-400 font-mono flex justify-between items-center border-b border-slate-800/80 group">
        <div className="flex items-center gap-2">
          <span>{col.title}</span>
          {col.isDone && (
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1">
              <CheckCheck size={10} /> FINAL
            </span>
          )}
          <span className="bg-slate-800 text-blue-400 px-2 py-0.5 rounded text-[11px] font-mono">
            {cards.length}
          </span>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={onEdit} className="p-1 hover:text-blue-400 text-slate-500 rounded cursor-pointer" title="Editar coluna"><Pencil size={12}/></button>
          <button type="button" onClick={onDelete} className="p-1 hover:text-red-400 text-slate-500 rounded cursor-pointer" title="Excluir coluna"><Trash2 size={12}/></button>
        </div>
      </div>

      <div className="p-2.5 overflow-y-auto flex-1 min-h-37.5">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard 
              key={card.id} 
              card={card} 
              onClick={() => onCardClick(card.id)}
              modules={modules}
              onNextStage={() => onNextStage(card.id)}
              onChangeModule={(modId) => onChangeModule(card.id, modId)}
              onToggleComplete={() => onToggleComplete(card.id)}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div className={`text-center py-12 text-xs font-mono rounded-xl border-2 border-dashed m-1 transition-colors ${
            isOver ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-slate-800/60 text-slate-600"
          }`}>
            {isOver ? "Solte para mover aqui" : "Nenhuma pendência aqui"}
          </div>
        )}
      </div>

      <div className="p-2.5 border-t border-slate-800/60 bg-[#0a0f1d]/50 rounded-b-2xl">
        <button 
          type="button"
          onClick={onAddCard}
          className="w-full py-2 px-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus size={14}/> Adicionar Pendência
        </button>
      </div>
    </div>
  );
}