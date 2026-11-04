"use client";

import { useState } from "react";
import type { Module } from "@prisma/client";
import { 
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, 
  useSensor, useSensors, PointerSensor 
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Filter, Plus } from "lucide-react";
import type { KanbanColumn as KanbanColumnType, KanbanCardData } from "../../types";
import { MONTH_NAMES } from "../../types";
import { KanbanColumn } from "./KanbanColumn";
import { moveCard, createColumn, updateColumn, deleteColumn } from "../../actions";

interface KanbanBoardProps {
  columns: KanbanColumnType[];
  setColumns: React.Dispatch<React.SetStateAction<KanbanColumnType[]>>;
  modules: Module[];
  selectedMonth: number;
  selectedYear: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  activeModuleFilter: string;
  setActiveModuleFilter: (modId: string) => void;
  onCardClick: (cardId: string) => void;
  onOpenCreateInColumn: (colId: string) => void;
  onQuickChangeModule: (cardId: string, modId: string) => Promise<void>;
  onToggleComplete: (cardId: string) => Promise<void>;
  onReload: () => Promise<void>;
}

export function KanbanBoard({
  columns,
  setColumns,
  modules,
  selectedMonth,
  selectedYear,
  onPrevMonth,
  onNextMonth,
  activeModuleFilter,
  setActiveModuleFilter,
  onCardClick,
  onOpenCreateInColumn,
  onQuickChangeModule,
  onToggleComplete,
  onReload,
}: KanbanBoardProps) {
  const [kanbanMonthFilter, setKanbanMonthFilter] = useState<"month" | "all">("all");
  const [activeDraggingCard, setActiveDraggingCard] = useState<KanbanCardData | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const totalCardCount = columns.reduce((acc, col) => acc + col.cards.length, 0);
  const getCardCountByModule = (modId: string) =>
    columns.reduce((acc, col) => acc + col.cards.filter((c) => c.moduleId === modId).length, 0);

  function handleDragStart(event: DragStartEvent) {
    const activeId = event.active.id as string;
    for (const col of columns) {
      const found = col.cards.find((c) => c.id === activeId);
      if (found) {
        setActiveDraggingCard(found);
        break;
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDraggingCard(null);
    if (!over || active.id === over.id) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const sourceCol = columns.find((col) => col.cards.some((c) => c.id === activeCardId));
    if (!sourceCol) return;

    let targetColId = columns.find((col) => col.id === overId)?.id;
    if (!targetColId) targetColId = columns.find((col) => col.cards.some((c) => c.id === overId))?.id;
    if (!targetColId || targetColId === sourceCol.id) return;

    const targetCol = columns.find((c) => c.id === targetColId);
    const movingCard = sourceCol.cards.find((c) => c.id === activeCardId);
    if (!movingCard || !targetCol) return;

    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === sourceCol.id) return { ...col, cards: col.cards.filter((c) => c.id !== activeCardId) };
        if (col.id === targetColId) {
          return {
            ...col,
            cards: [
              ...col.cards,
              {
                ...movingCard,
                columnId: targetColId,
                completed: targetCol.isDone,
                completedAt: targetCol.isDone ? new Date() : null,
              },
            ],
          };
        }
        return col;
      })
    );

    await moveCard(activeCardId, targetColId);
    void onReload();
  }

  async function handleQuickAdvance(cardId: string) {
    const currentColIndex = columns.findIndex((col) => col.cards.some((c) => c.id === cardId));
    if (currentColIndex === -1 || currentColIndex >= columns.length - 1) return;
    const nextCol = columns[currentColIndex + 1];

    setColumns((prev) => {
      let moved: KanbanCardData | null = null;
      const step1 = prev.map((col) => {
        const found = col.cards.find((c) => c.id === cardId);
        if (found) {
          moved = found;
          return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
        }
        return col;
      });
      if (!moved) return prev;
      return step1.map((col) => {
        if (col.id === nextCol.id) {
          return {
            ...col,
            cards: [
              ...col.cards,
              {
                ...moved!,
                columnId: nextCol.id,
                completed: nextCol.isDone,
                completedAt: nextCol.isDone ? new Date() : null,
              },
            ],
          };
        }
        return col;
      });
    });

    await moveCard(cardId, nextCol.id);
    void onReload();
  }

  async function handleAddColumn() {
    const title = prompt("Digite o nome da nova Etapa do Kanban:");
    if (title && title.trim()) {
      const isDone = confirm("Esta etapa representa a CONCLUSÃO / ENTREGA das pendências?");
      await createColumn(title.trim(), isDone);
      void onReload();
    }
  }

  async function handleEditColumn(col: KanbanColumnType) {
    const newTitle = prompt("Novo nome para a etapa:", col.title);
    if (newTitle && newTitle.trim()) {
      const isDone = confirm("Esta etapa representa a CONCLUSÃO / FINALIZAÇÃO das pendências?");
      await updateColumn(col.id, newTitle.trim(), isDone);
      void onReload();
    }
  }

  async function handleDeleteColumn(colId: string) {
    if (confirm("Tem certeza? Todas as pendências desta etapa serão excluídas!")) {
      await deleteColumn(colId);
      void onReload();
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* SUBHEADER: NAVEGADOR DE MESES E FILTROS */}
      <div className="bg-[#0b101d] border-b border-slate-800/80 px-4 sm:px-8 py-2.5 flex items-center justify-between overflow-x-auto shrink-0 gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-[#070a12] border border-slate-800 px-3 py-1 rounded-xl font-mono text-xs">
            <button type="button" onClick={onPrevMonth} className="p-1 hover:text-white text-slate-400 cursor-pointer">
              <ChevronLeft size={13} />
            </button>
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              {MONTH_NAMES[selectedMonth]} / {selectedYear}
            </span>
            <button type="button" onClick={onNextMonth} className="p-1 hover:text-white text-slate-400 cursor-pointer">
              <ChevronRight size={13} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setKanbanMonthFilter((f) => (f === "all" ? "month" : "all"))}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border shrink-0 ${
              kanbanMonthFilter === "month"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-[#070a12] text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <Filter size={12} />
            <span>{kanbanMonthFilter === "month" ? `Filtrado: ${MONTH_NAMES[selectedMonth]}` : "Ver Todos"}</span>
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={() => setActiveModuleFilter("all")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border shrink-0 ${
              activeModuleFilter === "all"
                ? "bg-blue-600 text-white border-blue-400"
                : "bg-[#070a12] text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <span>Todos</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-black/40">{totalCardCount}</span>
          </button>
          {modules.map((m) => {
            const count = getCardCountByModule(m.id);
            const isSelected = activeModuleFilter === m.id;
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => setActiveModuleFilter(m.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border shrink-0 ${
                  isSelected
                    ? "bg-slate-800 text-white shadow-md"
                    : "bg-[#070a12] text-slate-400 border-slate-800 hover:text-slate-200"
                }`}
                style={{ borderColor: isSelected ? m.color : undefined }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                <span>{m.title}</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-black/40 text-slate-400">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ÁREA DE COLUNAS COM DRAG & DROP */}
      <div className="flex-1 p-4 sm:p-8 overflow-x-auto flex gap-5 items-start">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {columns.map((col) => {
            const filteredCards = col.cards.filter((card) => {
              const matchesModule = activeModuleFilter === "all" || card.moduleId === activeModuleFilter;
              if (!matchesModule) return false;

              if (kanbanMonthFilter === "month") {
                if (!card.dueDate) return true;
                const d = new Date(card.dueDate);
                return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
              }

              return true;
            });

            return (
              <KanbanColumn
                key={col.id}
                col={col}
                cards={filteredCards}
                onEdit={() => { void handleEditColumn(col); }}
                onDelete={() => { void handleDeleteColumn(col.id); }}
                onAddCard={() => onOpenCreateInColumn(col.id)}
                onCardClick={(cardId) => onCardClick(cardId)}
                modules={modules}
                onNextStage={handleQuickAdvance}
                onChangeModule={onQuickChangeModule}
                onToggleComplete={onToggleComplete}
              />
            );
          })}

          <button
            type="button"
            onClick={() => { void handleAddColumn(); }}
            className="w-72 shrink-0 border-2 border-dashed border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/30 p-5 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-blue-400 text-xs font-bold font-mono transition-all cursor-pointer"
          >
            <Plus size={16} /> NOVA ETAPA
          </button>

          <DragOverlay>
            {activeDraggingCard ? (
              <div className="w-80 bg-[#151d30] p-4 rounded-2xl border-2 border-blue-500 shadow-2xl opacity-90 rotate-2 cursor-grabbing pointer-events-none">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white bg-blue-600 block w-max mb-1">
                  {activeDraggingCard.module?.title || "Geral"}
                </span>
                <h4 className="font-bold text-white text-sm">{activeDraggingCard.title}</h4>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}