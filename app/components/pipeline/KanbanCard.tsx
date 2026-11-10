"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Module } from "@prisma/client";
import { CheckCircle2, Circle, AlertTriangle, Calendar, ChevronRight } from "lucide-react";
import type { KanbanCardData } from "../../types";
import { isCardOverdue } from "../../types";
import { daysUntil } from "../finances/format";
import { Avatar } from "./PeopleModal";

function dueChip(dueDate: Date | string | null, completed: boolean) {
  if (!dueDate || completed) return null;
  const d = daysUntil(dueDate);
  if (d < 0) return { label: d === -1 ? "ontem" : `${Math.abs(d)}d atrás`, cls: "bg-red-500/20 text-red-400 border-red-500/40" };
  if (d === 0) return { label: "hoje", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
  if (d === 1) return { label: "amanhã", cls: "bg-amber-500/10 text-amber-400/90 border-amber-500/30" };
  if (d <= 6) return { label: `${d}d`, cls: "bg-slate-800 text-slate-300 border-slate-700" };
  return null;
}

interface KanbanCardProps {
  card: KanbanCardData;
  density?: "compact" | "detailed";
  onClick?: () => void;
  onNextStage?: () => void;
  modules: Module[];
  onChangeModule?: (moduleId: string) => void;
  onToggleComplete?: () => void;
}

export function KanbanCard({
  card,
  density = "detailed",
  onClick,
  onNextStage,
  modules,
  onChangeModule,
  onToggleComplete,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.2 : 1 };

  const overdue = isCardOverdue(card.dueDate, card.completed);
  const chip = dueChip(card.dueDate, card.completed);

  // MODO COMPACTO (ALTA DENSIDADE: CABE 30 TAREFAS NA TELA)
  if (density === "compact") {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes} 
        {...listeners}
        onClick={() => {
          if (!isDragging && onClick) onClick();
        }}
        className={`px-3 py-2.5 sm:py-2 mb-1.5 rounded-xl border cursor-grab hover:shadow-lg transition-all flex items-center justify-between gap-2 select-none group ${
          card.completed 
            ? "bg-[#0b1424]/70 border-emerald-500/30 opacity-70" 
            : overdue
              ? "bg-[#180d12] border-red-500/70"
              : "bg-[#121829] border-slate-800/90 hover:border-slate-600"
        }`}
      >
        <div className="flex items-center gap-2 truncate flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleComplete) onToggleComplete();
            }}
            className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
          >
            {card.completed ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Circle size={15} className={overdue ? "text-red-400" : ""} />}
          </button>

          {card.module && (
            <span 
              className="w-2 h-2 rounded-full shrink-0 shadow-xs" 
              style={{ backgroundColor: card.module.color }} 
              title={card.module.title}
            />
          )}

          <span className={`text-xs font-semibold truncate ${
            card.completed ? "line-through text-slate-500" : overdue ? "text-red-200" : "text-slate-200"
          }`}>
            {card.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {chip && (
            <span className={`text-[8px] font-bold px-1 py-px rounded font-mono border ${chip.cls}`}>
              {chip.label}
            </span>
          )}

          {card.assignee && <Avatar name={card.assignee} size={16} />}

          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
            card.priority === "Urgente" ? "bg-red-500/20 text-red-400" :
            card.priority === "Alta" ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"
          }`}>
            {card.priority.slice(0, 3)}
          </span>

          {onNextStage && !card.completed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNextStage();
              }}
              className="text-slate-500 hover:text-blue-400 p-1.5 -m-1 rounded cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              title="Avançar etapa"
            >
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // MODO DETALHADO TRADICIONAL
  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={() => {
        if (!isDragging && onClick) onClick();
      }}
      className={`p-3.5 mb-2.5 rounded-2xl border cursor-grab hover:shadow-xl transition-all relative group select-none ${
        card.completed 
          ? "bg-[#0b1424] border-emerald-500/40 opacity-75" 
          : overdue
            ? "bg-[#180d12] border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30"
            : "bg-[#121829] border-slate-800/80 hover:border-slate-600"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleComplete) onToggleComplete();
            }}
            className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
            title={card.completed ? "Reabrir pendência" : "Marcar como concluída"}
          >
            {card.completed ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} className={overdue ? "text-red-400" : ""} />}
          </button>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <select
              value={card.moduleId || ""}
              onChange={(e) => onChangeModule && onChangeModule(e.target.value)}
              className="text-[10px] font-bold px-2 py-0.5 rounded shadow-sm bg-transparent outline-none cursor-pointer appearance-none pr-3"
              style={{ 
                backgroundColor: card.module ? `${card.module.color}25` : "#1e293b", 
                color: card.module ? card.module.color : "#94a3b8", 
                border: card.module ? `1px solid ${card.module.color}40` : "1px solid #334155" 
              }}
            >
              <option value="" className="bg-[#0f172a] text-white">Sem módulo</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#0f172a] text-white">
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {overdue && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
              <AlertTriangle size={10} /> Vencida
            </span>
          )}

          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
            card.completed ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
            card.priority === "Urgente" ? "bg-red-500/20 text-red-400 border border-red-500/30" : 
            card.priority === "Alta" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
            "bg-slate-800 text-slate-400"
          }`}>
            {card.completed ? "Concluído" : card.priority}
          </span>
        </div>
      </div>

      <h4 className={`font-semibold text-sm mb-1 leading-snug line-clamp-2 ${
        card.completed ? "line-through text-slate-400" : overdue ? "text-red-200" : "text-slate-200"
      }`}>
        {card.title}
      </h4>

      {card.description && (
        <p className="text-xs text-slate-400 line-clamp-1 mb-2 font-sans">{card.description}</p>
      )}

      <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 mt-2">
        {card.dueDate ? (
          <div className={`text-[10px] flex items-center gap-1.5 font-mono ${
            overdue ? "text-red-400 font-bold" : "text-slate-500"
          }`}>
            <Calendar size={11} className={overdue ? "text-red-400" : "text-blue-400"}/> 
            {new Date(card.dueDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            {chip && <span className={`ml-1 px-1 py-px rounded border text-[9px] font-bold ${chip.cls}`}>{chip.label}</span>}
          </div>
        ) : (
          <span className="text-[10px] text-slate-600 font-mono">Sem prazo</span>
        )}

        {card.assignee && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-violet-300">
            <Avatar name={card.assignee} size={14} /> {card.assignee}
          </span>
        )}

        {onNextStage && !card.completed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNextStage();
            }}
            className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 hover:text-blue-400 bg-slate-800/60 hover:bg-slate-800 px-2 py-0.5 rounded cursor-pointer transition-colors"
          >
            <span>Avançar</span>
            <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}