"use client";

import { useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Module } from "@prisma/client";
import { 
  CheckCheck, Pencil, Trash2, Plus, AlertCircle, Snowflake, 
  Minimize2, Maximize2, ArrowLeft, ArrowRight, Maximize, Clock
} from "lucide-react";
import { isCardOverdue } from "../../types";
import type { KanbanColumn as KanbanColumnType, KanbanCardData } from "../../types";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  col: KanbanColumnType;
  cards: KanbanCardData[];
  density?: "compact" | "detailed";
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddCard: () => void;
  onQuickAdd?: (title: string) => Promise<void>;
  onCardClick: (cardId: string) => void;
  modules: Module[];
  onNextStage: (cardId: string) => void;
  onChangeModule: (cardId: string, modId: string) => void;
  onToggleComplete: (cardId: string) => void;
}

export function KanbanColumn({
  col,
  cards,
  density = "detailed",
  canMoveLeft = false,
  canMoveRight = false,
  onMoveLeft,
  onMoveRight,
  onEdit,
  onDelete,
  onAddCard,
  onQuickAdd,
  onCardClick,
  modules,
  onNextStage,
  onChangeModule,
  onToggleComplete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  const isIcebox = /gelo|icebox|radar|espera|sem pressa/i.test(col.title);
  const isBottleneck = !col.isDone && !isIcebox && cards.length >= 6;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);
  const overdueCount = col.isDone ? 0 : cards.filter((c) => isCardOverdue(c.dueDate, c.completed)).length;

  async function submitQuick() {
    const t = quickTitle.trim();
    if (!t || !onQuickAdd) return;
    setQuickBusy(true);
    try {
      await onQuickAdd(t);
      setQuickTitle("");
      quickRef.current?.focus();
    } finally {
      setQuickBusy(false);
    }
  }

  // MODO RECOLHIDO (BARRA VERTICAL FINA)
  if (isCollapsed) {
    return (
      <div 
        ref={setNodeRef}
        onClick={() => setIsCollapsed(false)}
        className="w-14 shrink-0 bg-[#071322]/80 border border-cyan-900/60 hover:border-cyan-500 rounded-3xl flex flex-col items-center py-4 shadow-xl cursor-pointer transition-all min-h-75 group select-none"
        title="Clique para expandir esta coluna"
      >
        <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-110 transition-transform">
          {isIcebox ? <Snowflake size={15} /> : <Maximize2 size={14} />}
        </div>
        <span className="bg-cyan-950 text-cyan-300 border border-cyan-800/60 text-[10px] font-mono px-1.5 py-0.5 rounded-full mb-4">
          {cards.length}
        </span>
        <span className="[writing-mode:vertical-lr] rotate-180 font-bold font-mono text-xs uppercase tracking-widest text-slate-400 group-hover:text-cyan-300 transition-colors">
          {col.title}
        </span>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      className={`w-[85vw] max-w-sm sm:w-80 snap-center shrink-0 border rounded-3xl flex flex-col max-h-full shadow-2xl transition-all duration-200 ${
        isOver 
          ? "border-blue-500 bg-[#0f1b35] ring-2 ring-blue-500/40" 
          : isIcebox
            ? "border-cyan-900/70 bg-[#061220]/60 ring-1 ring-cyan-500/20"
            : isBottleneck
              ? "border-amber-500/60 ring-1 ring-amber-500/30 bg-[#0f172a]"
              : col.isDone 
                ? "border-emerald-800/60 bg-[#0b1424]/40" 
                : "border-slate-800 bg-[#0f172a]"
      }`}
    >
      {/* CABEÇALHO DA COLUNA COM CONTROLES DE POSIÇÃO */}
      <div className={`p-3.5 font-bold text-xs uppercase tracking-wider font-mono flex justify-between items-center border-b rounded-t-3xl ${
        isIcebox ? "bg-[#050f1d] border-cyan-950 text-cyan-300" : "bg-[#0a0f1d] border-slate-800/80 text-slate-400"
      }`}>
        <div className="flex items-center gap-1.5 truncate">
          {/* BOTÕES DE REORDENAÇÃO DA ETAPA (ESQUERDA / DIREITA) */}
          <div className="flex items-center gap-0.5 mr-1">
            {canMoveLeft && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onMoveLeft) onMoveLeft();
                }}
                className="p-1 hover:text-white hover:bg-slate-800 rounded-lg text-slate-500 cursor-pointer transition-colors"
                title="Mover etapa para a esquerda"
              >
                <ArrowLeft size={12} />
              </button>
            )}
            {canMoveRight && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onMoveRight) onMoveRight();
                }}
                className="p-1 hover:text-white hover:bg-slate-800 rounded-lg text-slate-500 cursor-pointer transition-colors"
                title="Mover etapa para a direita"
              >
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          <span className="truncate">{col.title}</span>
          
          {isIcebox && (
            <span className="bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 shrink-0">
              <Snowflake size={10} /> GELO
            </span>
          )}

          {col.isDone && (
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 shrink-0">
              <CheckCheck size={10} /> FINAL
            </span>
          )}

          {isBottleneck && (
            <span className="bg-amber-950/80 text-amber-400 border border-amber-800/60 px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 animate-pulse shrink-0">
              <AlertCircle size={10} /> Gargalo
            </span>
          )}

          {overdueCount > 0 && (
            <span className="bg-red-950/80 text-red-400 border border-red-800/60 px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 shrink-0" title="Pendências vencidas nesta etapa">
              <Clock size={10} /> {overdueCount}
            </span>
          )}

          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono shrink-0 ${
            isIcebox ? "bg-cyan-950 text-cyan-400 border border-cyan-800/60" : "bg-slate-800 text-blue-400"
          }`}>
            {cards.length}
          </span>
        </div>
        
        {/* AÇÕES DE COLUNA (RECOLHER / EDITAR / EXCLUIR) */}
        <div className="flex items-center gap-1 shrink-0">
          <button 
            type="button" 
            onClick={() => setIsCollapsed(true)} 
            className="p-1 hover:text-cyan-400 text-slate-500 rounded cursor-pointer transition-colors" 
            title="Recolher coluna"
          >
            <Minimize2 size={13} />
          </button>
          <button type="button" onClick={onEdit} className="p-1 hover:text-blue-400 text-slate-500 rounded cursor-pointer transition-colors" title="Editar nome"><Pencil size={12}/></button>
          <button type="button" onClick={onDelete} className="p-1 hover:text-red-400 text-slate-500 rounded cursor-pointer transition-colors" title="Excluir etapa"><Trash2 size={12}/></button>
        </div>
      </div>

      <div className="p-2 overflow-y-auto flex-1 min-h-37.5">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard 
              key={card.id} 
              card={card} 
              density={density}
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

      <div className="p-2 border-t border-slate-800/60 bg-[#0a0f1d]/50 rounded-b-3xl">
        {quickOpen && onQuickAdd ? (
          <div className="space-y-1.5">
            <input
              ref={quickRef}
              autoFocus
              value={quickTitle}
              disabled={quickBusy}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitQuick();
                if (e.key === "Escape") { setQuickOpen(false); setQuickTitle(""); }
              }}
              onBlur={() => { if (!quickTitle.trim()) setQuickOpen(false); }}
              placeholder="Título e Enter ↵  (Esc fecha)"
              className="w-full bg-[#050811] border border-blue-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void submitQuick()}
                disabled={quickBusy || !quickTitle.trim()}
                className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-bold font-mono cursor-pointer"
              >
                {quickBusy ? "Salvando..." : "Adicionar"}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setQuickOpen(false); setQuickTitle(""); onAddCard(); }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-[11px] font-mono cursor-pointer flex items-center gap-1"
                title="Abrir formulário completo"
              >
                <Maximize size={11} /> Detalhes
              </button>
            </div>
          </div>
        ) : (
          <button 
            type="button"
            onClick={() => (onQuickAdd ? setQuickOpen(true) : onAddCard())}
            className="w-full py-2 px-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus size={14}/> Adicionar Pendência
          </button>
        )}
      </div>
    </div>
  );
}