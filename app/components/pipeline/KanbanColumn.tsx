"use client";

import { useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Module } from "@prisma/client";
import {
  CheckCheck, Pencil, Trash2, Plus, AlertCircle, Snowflake, Minimize2, Maximize2, ArrowLeft, ArrowRight, Maximize, Clock,
  MoreHorizontal, Archive, FolderOpen,
} from "lucide-react";
import { isCardOverdue } from "../../types";
import type { KanbanColumn as KanbanColumnType, KanbanCardData } from "../../types";
import { KanbanCard, type StageRef } from "./KanbanCard";
import { Menu, type MenuItem } from "./Menu";

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
  onArchiveDone?: () => void;
  onOpenArchive?: () => void;
  onQuickAdd?: (title: string) => Promise<void>;
  onCardClick: (cardId: string) => void;
  modules: Module[];
  onChangeModule: (cardId: string, modId: string) => void;
  onToggleComplete: (cardId: string) => void;
  stages: StageRef[];
  onMoveCard: (cardId: string, columnId: string) => void;
  /** Coluna vazia vira faixa fina (no PC, sem busca/filtro ativo) */
  autoCollapse?: boolean;
  /** Algum card está sendo arrastado: faixas recolhidas abrem para receber */
  dragging?: boolean;
  focusedCardId?: string | null;
  /** Pede para abrir o campo de "adicionar rápido" (atalho N) */
  quickAddSignal?: number;
}

export function KanbanColumn({
  col,
  cards,
  density = "compact",
  canMoveLeft = false,
  canMoveRight = false,
  onMoveLeft,
  onMoveRight,
  onEdit,
  onDelete,
  onAddCard,
  onArchiveDone,
  onOpenArchive,
  onQuickAdd,
  onCardClick,
  modules,
  onChangeModule,
  onToggleComplete,
  stages,
  onMoveCard,
  autoCollapse = false,
  dragging = false,
  focusedCardId = null,
  quickAddSignal = 0,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  const isIcebox = /gelo|icebox|radar|espera|sem pressa/i.test(col.title);
  const isBottleneck = !col.isDone && !isIcebox && cards.length >= 6;
  // null = automático (recolhe se vazia); true/false = escolha da pessoa nesta sessão
  const [collapsedChoice, setCollapsedChoice] = useState<boolean | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);
  const overdueCount = col.isDone ? 0 : cards.filter((c) => isCardOverdue(c.dueDate, c.completed)).length;

  // Atalho N: abre o campo de adicionar nesta coluna
  const [seenSignal, setSeenSignal] = useState(quickAddSignal);
  if (quickAddSignal !== seenSignal) {
    setSeenSignal(quickAddSignal);
    if (quickAddSignal > 0 && onQuickAdd) {
      setCollapsedChoice(false);
      setQuickOpen(true);
    }
  }

  const collapsed = (collapsedChoice ?? autoCollapse) && !(dragging && collapsedChoice === null);

  async function submitQuick() {
    const t = quickTitle.trim();
    if (!t || !onQuickAdd) return;
    setQuickBusy(true);
    try {
      await onQuickAdd(t);
      setQuickTitle("");
    } finally {
      setQuickBusy(false);
      // o campo fica desabilitado enquanto salva; devolve o foco quando volta
      setTimeout(() => quickRef.current?.focus(), 0);
    }
  }

  // FAIXA RECOLHIDA
  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        data-col-id={col.id}
        onClick={() => setCollapsedChoice(false)}
        className={`w-11 shrink-0 self-stretch max-h-80 rounded-2xl border flex flex-col items-center gap-3 py-3 cursor-pointer transition-colors select-none group ${
          isOver ? "border-blue-500 bg-[#0f1b35]" : "border-slate-800/80 bg-[#0b101d]/60 hover:border-slate-600"
        }`}
        title={`${col.title} — clique para abrir`}
      >
        <span className="grid place-items-center w-6 h-6 rounded-lg text-slate-500 group-hover:text-white">
          {isIcebox ? <Snowflake size={13} /> : col.isDone ? <CheckCheck size={13} /> : <Maximize2 size={12} />}
        </span>
        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-900 rounded-full px-1.5">{cards.length}</span>
        <span className="[writing-mode:vertical-lr] rotate-180 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-200 truncate">
          {col.title}
        </span>
      </div>
    );
  }

  const menu: MenuItem[] = [
    { label: "Mover etapa para a esquerda", icon: <ArrowLeft size={13} />, onSelect: () => onMoveLeft?.(), disabled: !canMoveLeft },
    { label: "Mover etapa para a direita", icon: <ArrowRight size={13} />, onSelect: () => onMoveRight?.(), disabled: !canMoveRight },
    { label: "Recolher", icon: <Minimize2 size={13} />, onSelect: () => setCollapsedChoice(true) },
    { label: "Renomear / tipo", icon: <Pencil size={13} />, onSelect: onEdit, separator: true },
    ...(onArchiveDone && cards.length > 0
      ? [{ label: "Arquivar concluídos", icon: <Archive size={13} />, onSelect: onArchiveDone }]
      : []),
    ...(onOpenArchive ? [{ label: "Ver arquivo", icon: <FolderOpen size={13} />, onSelect: onOpenArchive }] : []),
    { label: "Excluir etapa", icon: <Trash2 size={13} />, onSelect: onDelete, danger: true, separator: true },
  ];

  return (
    <div
      ref={setNodeRef}
      data-col-id={col.id}
      className={`w-[calc(100vw-1.5rem)] sm:w-76 snap-center shrink-0 border rounded-2xl flex flex-col max-h-full transition-colors ${
        isOver
          ? "border-blue-500 bg-[#0f1b35] ring-2 ring-blue-500/40"
          : isIcebox
            ? "border-cyan-900/60 bg-[#061220]/60"
            : isBottleneck
              ? "border-amber-500/50 bg-[#0f172a]"
              : col.isDone
                ? "border-emerald-900/60 bg-[#0b1424]/40"
                : "border-slate-800 bg-[#0d1322]"
      }`}
    >
      {/* CABEÇALHO: nome, contador e sinais; ações no "⋯" */}
      <div className="group/h pl-3.5 pr-2 py-2.5 flex items-center gap-2 border-b border-slate-800/70">
        <span className={`text-[12px] font-bold uppercase tracking-wide truncate ${isIcebox ? "text-cyan-300" : col.isDone ? "text-emerald-300" : "text-slate-200"}`}>
          {col.title}
        </span>
        <span className="text-[11px] font-mono text-slate-500 shrink-0">{cards.length}</span>
        {isIcebox && <Snowflake size={12} className="text-cyan-400 shrink-0" aria-label="Gelo" />}
        {col.isDone && <CheckCheck size={12} className="text-emerald-400 shrink-0" aria-label="Etapa final" />}
        {isBottleneck && (
          <span className="text-amber-400 shrink-0" title="Muita coisa parada nesta etapa">
            <AlertCircle size={12} />
          </span>
        )}
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-red-400 shrink-0" title="Vencidas nesta etapa">
            <Clock size={11} /> {overdueCount}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          {onQuickAdd && (
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              className="grid place-items-center w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 cursor-pointer sm:opacity-0 sm:group-hover/h:opacity-100 transition-opacity"
              title="Adicionar pendência aqui"
              aria-label="Adicionar pendência aqui"
            >
              <Plus size={14} />
            </button>
          )}
          <Menu
            title="Ações da etapa"
            items={menu}
            trigger={
              <span className="grid place-items-center w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 sm:opacity-0 sm:group-hover/h:opacity-100 transition-opacity">
                <MoreHorizontal size={15} />
              </span>
            }
          />
        </div>
      </div>

      {quickOpen && onQuickAdd && (
        <div className="p-2 border-b border-slate-800/60 space-y-1.5">
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
            className="w-full bg-[#050811] border border-blue-500/50 rounded-lg px-3 py-2 text-[13px] text-white outline-none placeholder:text-slate-500"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void submitQuick()}
              disabled={quickBusy || !quickTitle.trim()}
              className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer"
            >
              {quickBusy ? "Salvando..." : "Adicionar"}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setQuickOpen(false); setQuickTitle(""); onAddCard(); }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-[11px] cursor-pointer flex items-center gap-1"
              title="Abrir formulário completo"
            >
              <Maximize size={11} /> Detalhes
            </button>
          </div>
        </div>
      )}

      <div className="p-2 overflow-y-auto flex-1 min-h-24">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              density={density}
              onClick={() => onCardClick(card.id)}
              modules={modules}
              onChangeModule={(modId) => onChangeModule(card.id, modId)}
              onToggleComplete={() => onToggleComplete(card.id)}
              stages={stages}
              columnId={col.id}
              onMoveTo={(target) => onMoveCard(card.id, target)}
              focused={focusedCardId === card.id}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div className={`text-center py-8 text-[11px] font-mono rounded-xl border border-dashed transition-colors ${
            isOver ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-slate-800 text-slate-600"
          }`}>
            {isOver ? "Solte para mover aqui" : "Vazia"}
          </div>
        )}

        {!quickOpen && onQuickAdd && (
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="w-full mt-1 py-1.5 px-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/60 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={13} /> Adicionar
          </button>
        )}
      </div>
    </div>
  );
}
