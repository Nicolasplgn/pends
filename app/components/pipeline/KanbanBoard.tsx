"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Module, Project } from "@prisma/client";
import { 
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners,
  useSensor, useSensors, PointerSensor, TouchSensor, KeyboardSensor
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { 
  ChevronLeft, ChevronRight, Filter, Plus, Search, 
  Flame, Clock, LayoutGrid, Rows3, Table, Snowflake, Repeat, Users, FolderKanban, FileText, CalendarRange
} from "lucide-react";
import type { KanbanColumn as KanbanColumnType, KanbanCardData } from "../../types";
import { MONTH_NAMES, isCardOverdue } from "../../types";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanTableView } from "./KanbanTableView";
import { ColumnModal } from "../shared/ColumnModal";
import { ConfirmModal } from "../shared/ConfirmModal";
import { RoutinesModal } from "./RoutinesModal";
import { PeopleModal } from "./PeopleModal";
import { ArchiveModal } from "./ArchiveModal";
import { ProjectsModal } from "./ProjectsModal";
import { ReportModal } from "./ReportModal";
import { WeekPlanModal } from "./WeekPlanModal";
import { moveCard, createColumn, updateColumn, deleteColumn, moveColumn, reorderColumnCards, quickCreateCard, archiveDoneCardsNow } from "../../actions";

interface KanbanBoardProps {
  projects?: (Project & { _count?: { cards: number } })[];
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
  projects = [],
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

  // CONTROLES DE DENSIDADE E BUSCA
  const [searchQuery, setSearchQuery] = useState("");
  const [focusFilter, setFocusFilter] = useState<"all" | "urgent" | "overdue" | "icebox">("all");
  // Lembra a densidade escolhida entre sessões (o board só monta no cliente, após login)
  const [viewDensity, setViewDensity] = useState<"compact" | "detailed" | "table">(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("pends:kanbanDensity") : null;
      if (saved === "compact" || saved === "detailed" || saved === "table") return saved;
    } catch {}
    return "compact";
  });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem("pends:kanbanDensity", viewDensity); } catch {}
  }, [viewDensity]);

  // Atalho: "/" foca a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // MODAIS
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumnType | null>(null);
  const [deleteTargetColumnId, setDeleteTargetColumnId] = useState<string | null>(null);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardError) return;
    const t = setTimeout(() => setBoardError(null), 5000);
    return () => clearTimeout(t);
  }, [boardError]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  // "all" = todos · "__me" = comigo · nome = com essa pessoa
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  // "all" = todos · "__none" = sem projeto · id = projeto
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAssignee, setReportAssignee] = useState<string | null>(null);
  const [weekOpen, setWeekOpen] = useState(false);

  const assigneeNames = useMemo(
    () => [...new Set(columns.flatMap((c) => c.cards.map((k) => k.assignee).filter(Boolean) as string[]))].sort(),
    [columns]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const totalCardCount = columns.reduce((acc, col) => acc + col.cards.length, 0);
  const getCardCountByModule = (modId: string) =>
    columns.reduce((acc, col) => acc + col.cards.filter((c) => c.moduleId === modId).length, 0);

  const totalIcebox = useMemo(() => {
    return columns
      .filter((col) => /gelo|icebox|radar|espera|sem pressa/i.test(col.title))
      .reduce((sum, col) => sum + col.cards.length, 0);
  }, [columns]);

  const totalOverdue = useMemo(() => {
    return columns.flatMap((col) =>
      col.cards.filter((card) => !card.completed && !col.isDone && isCardOverdue(card.dueDate))
    ).length;
  }, [columns]);

  const totalUrgent = useMemo(() => {
    return columns.flatMap((col) =>
      col.cards.filter((card) => !card.completed && (card.priority === "Urgente" || card.priority === "Alta"))
    ).length;
  }, [columns]);

  const isCardMatchingFilters = (card: KanbanCardData) => {
    const matchesModule = activeModuleFilter === "all" || card.moduleId === activeModuleFilter;
    if (!matchesModule) return false;

    if (projectFilter === "__none" && card.projectId) return false;
    if (projectFilter !== "all" && projectFilter !== "__none" && card.projectId !== projectFilter) return false;

    if (assigneeFilter === "__me" && card.assignee) return false;
    if (assigneeFilter !== "all" && assigneeFilter !== "__me" && card.assignee !== assigneeFilter) return false;

    if (kanbanMonthFilter === "month") {
      if (!card.dueDate) return true;
      const d = new Date(card.dueDate);
      if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = card.title.toLowerCase().includes(q);
      const matchesDesc = (card.description || "").toLowerCase().includes(q);
      if (!matchesTitle && !matchesDesc) return false;
    }

    if (focusFilter === "urgent") {
      if (card.priority !== "Urgente" && card.priority !== "Alta") return false;
    }

    if (focusFilter === "overdue") {
      if (!isCardOverdue(card.dueDate, card.completed)) return false;
    }

    if (focusFilter === "icebox") {
      const parentCol = columns.find((c) => c.cards.some((item) => item.id === card.id));
      if (!parentCol || !/gelo|icebox|radar|espera|sem pressa/i.test(parentCol.title)) return false;
    }

    return true;
  };

  const allFilteredCards = columns.flatMap((col) => col.cards).filter(isCardMatchingFilters);

  // MOVER COLUNA OTIMISTAMENTE PARA A ESQUERDA OU DIREITA
  async function handleMoveColumnPosition(colId: string, direction: "left" | "right") {
    const currentIndex = columns.findIndex((c) => c.id === colId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    // Atualização otimista imediata na interface
    const newColumns = [...columns];
    const [movedCol] = newColumns.splice(currentIndex, 1);
    newColumns.splice(targetIndex, 0, movedCol);
    setColumns(newColumns);

    // Persistência no servidor
    await moveColumn(colId, direction);
    void onReload();
  }

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
    const targetCol =
      columns.find((col) => col.id === overId) ?? columns.find((col) => col.cards.some((c) => c.id === overId));
    if (!sourceCol || !targetCol) return;

    const movingCard = sourceCol.cards.find((c) => c.id === activeCardId)!;
    let newTargetCards: KanbanCardData[];

    if (sourceCol.id === targetCol.id) {
      // Reordenação dentro da mesma etapa
      const oldIdx = sourceCol.cards.findIndex((c) => c.id === activeCardId);
      const newIdx = sourceCol.cards.findIndex((c) => c.id === overId);
      if (newIdx === -1 || oldIdx === newIdx) return;
      newTargetCards = arrayMove(sourceCol.cards, oldIdx, newIdx);
    } else {
      // Mudança de etapa: entra na posição do card sob o cursor (ou no fim)
      const rest = targetCol.cards.filter((c) => c.id !== activeCardId);
      const overIdx = rest.findIndex((c) => c.id === overId);
      const insertAt = overIdx === -1 ? rest.length : overIdx;
      const moved = {
        ...movingCard,
        columnId: targetCol.id,
        completed: targetCol.isDone,
        completedAt: targetCol.isDone ? new Date() : null,
      };
      newTargetCards = [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
    }

    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === targetCol.id) return { ...col, cards: newTargetCards };
        if (col.id === sourceCol.id) return { ...col, cards: col.cards.filter((c) => c.id !== activeCardId) };
        return col;
      })
    );

    await reorderColumnCards(targetCol.id, newTargetCards.map((c) => c.id), activeCardId);
    void onReload();
  }

  async function handleQuickCreate(colId: string, title: string) {
    await quickCreateCard(
      colId,
      title,
      activeModuleFilter !== "all" ? activeModuleFilter : null,
      projectFilter !== "all" && projectFilter !== "__none" ? projectFilter : null
    );
    await onReload();
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

  async function handleSaveColumn(title: string, isDone: boolean, kind: string | null) {
    if (editingColumn) {
      // Otimista: o nome troca na hora e o modal fecha; o banco salva por trás.
      const id = editingColumn.id;
      const before = columns;
      setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title, isDone, kind: isDone ? "DONE" : kind } : c)));
      updateColumn(id, title, isDone, kind)
        .then(() => onReload())
        .catch((err) => {
          console.error("Erro ao salvar a etapa:", err);
          setColumns(before);
          setBoardError("Não consegui salvar o nome da etapa. Tente de novo.");
        });
      return;
    }
    await createColumn(title, isDone, kind);
    void onReload();
  }

  async function handleConfirmDeleteColumn() {
    if (!deleteTargetColumnId) return;
    await deleteColumn(deleteTargetColumnId);
    setDeleteTargetColumnId(null);
    await onReload();
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#050811]">
      {boardError && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-70 px-4 py-2.5 rounded-xl bg-rose-950 border border-rose-500/50 text-xs text-rose-200 shadow-2xl">
          {boardError}
        </div>
      )}
      
      {/* MODAL MODERNO DE CRIAR/EDITAR ETAPA */}
      <ColumnModal
        isOpen={isColumnModalOpen}
        onClose={() => {
          setIsColumnModalOpen(false);
          setEditingColumn(null);
        }}
        column={editingColumn}
        onSave={handleSaveColumn}
      />

      <ProjectsModal isOpen={projectsOpen} onClose={() => setProjectsOpen(false)} projects={projects} onChanged={() => void onReload()} />
      {reportOpen && <ReportModal
        isOpen={reportOpen}
        onClose={() => { setReportOpen(false); setReportAssignee(null); }}
        projects={projects}
        defaultProjectId={projectFilter !== "all" && projectFilter !== "__none" ? projectFilter : null}
        defaultAssignee={reportAssignee ?? (assigneeFilter !== "all" ? assigneeFilter : null)}
      />}
      <WeekPlanModal isOpen={weekOpen} onClose={() => setWeekOpen(false)} columns={columns} onCardClick={onCardClick} />

      <PeopleModal
        isOpen={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        columns={columns}
        onCardClick={onCardClick}
        onFilter={(who) => setAssigneeFilter(who)}
        onReport={(who) => { setReportAssignee(who); setReportOpen(true); }}
      />
      <ArchiveModal isOpen={archiveOpen} onClose={() => setArchiveOpen(false)} onRestored={() => void onReload()} />
      <ConfirmModal
        isOpen={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Arquivar os concluídos?"
        description="Os cards da etapa final saem do quadro e viram uma linha compacta no arquivo (título, módulo, responsável, datas e anotações). O histórico de movimentos é apagado. Dá pra buscar e restaurar depois."
        confirmText="Arquivar"
        onConfirm={async () => {
          await archiveDoneCardsNow();
          setConfirmArchive(false);
          await onReload();
        }}
      />

      <RoutinesModal
        isOpen={routinesOpen}
        onClose={() => setRoutinesOpen(false)}
        modules={modules}
        onChanged={() => void onReload()}
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <ConfirmModal
        isOpen={!!deleteTargetColumnId}
        onClose={() => setDeleteTargetColumnId(null)}
        title="Excluir Etapa do Kanban?"
        description="Tem certeza? Todas as pendências que estiverem dentro desta etapa serão excluídas permanentemente."
        confirmText="Sim, Excluir Etapa"
        danger={true}
        onConfirm={handleConfirmDeleteColumn}
      />

      {/* BARRA SUPERIOR 1: NAVEGADOR DE MÊS + MÓDULOS */}
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

          {/* MÓDULOS DE VIDA */}
          <button
            type="button"
            onClick={() => setActiveModuleFilter("all")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border shrink-0 ${
              activeModuleFilter === "all"
                ? "bg-blue-600 text-white border-blue-400 shadow-md"
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

      {/* BARRA SUPERIOR 2: BUSCA, FILTROS RÁPIDOS & GELO */}
      <div className="bg-[#070b14] border-b border-slate-800/80 px-4 sm:px-8 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              ref={searchRef}
              type="text" 
              placeholder="Buscar pendências...  ( / )" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b101f] border border-slate-800 pl-8 pr-3 py-1.5 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-all font-sans"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer">
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#0b101f] border border-slate-800 p-0.5 rounded-xl text-xs font-mono">
            <button
              onClick={() => setFocusFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                focusFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Tudo
            </button>
            <button
              onClick={() => setFocusFilter("urgent")}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                focusFilter === "urgent" ? "bg-amber-500/20 text-amber-300 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              <Flame size={12} className="text-amber-400" />
              <span>Urgentes ({totalUrgent})</span>
            </button>
            <button
              onClick={() => setFocusFilter("overdue")}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                focusFilter === "overdue" ? "bg-red-500/20 text-red-300 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              <Clock size={12} className="text-red-400" />
              <span>Vencidas ({totalOverdue})</span>
            </button>
            
            {totalIcebox > 0 && (
              <button
                onClick={() => setFocusFilter((f) => (f === "icebox" ? "all" : "icebox"))}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                  focusFilter === "icebox" ? "bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/40" : "text-slate-400 hover:text-cyan-300"
                }`}
                title="Ver apenas tarefas no Radar (Sem pressa)"
              >
                <Snowflake size={12} className="text-cyan-400" />
                <span>Gelo ({totalIcebox})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <select
              value={projectFilter}
              onChange={(e) => {
                if (e.target.value === "__manage") { setProjectsOpen(true); return; }
                setProjectFilter(e.target.value);
              }}
              className={`bg-[#0b101f] border rounded-xl px-2 py-1.5 text-xs font-mono outline-none cursor-pointer max-w-36 ${
                projectFilter === "all" ? "border-slate-800 text-slate-400" : "border-violet-500/50 text-violet-200"
              }`}
              aria-label="Filtrar por projeto"
            >
              <option value="all">Todos projetos</option>
              {projects.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              <option value="__none">Sem projeto</option>
              <option value="__manage">⚙ Gerenciar projetos…</option>
            </select>
            <button
              type="button"
              onClick={() => setWeekOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0b101f] border border-slate-800 text-xs font-mono text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 cursor-pointer transition-colors"
              title="Planejamento da semana (horas)"
            >
              <CalendarRange size={13} /> <span className="hidden sm:inline">Semana</span>
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0b101f] border border-slate-800 text-xs font-mono text-slate-400 hover:text-blue-300 hover:border-blue-500/40 cursor-pointer transition-colors"
              title="Relatório de status pra mandar"
            >
              <FileText size={13} /> <span className="hidden sm:inline">Relatório</span>
            </button>
            <button
              type="button"
              onClick={() => setProjectsOpen(true)}
              className="hidden lg:flex items-center p-1.5 rounded-xl bg-[#0b101f] border border-slate-800 text-slate-500 hover:text-violet-300 cursor-pointer"
              title="Gerenciar projetos"
              aria-label="Gerenciar projetos"
            >
              <FolderKanban size={13} />
            </button>
            <button
              type="button"
              onClick={() => setPeopleOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0b101f] border border-slate-800 text-xs font-mono text-slate-400 hover:text-violet-300 hover:border-violet-500/40 cursor-pointer transition-colors"
              title="Com quem está cada pendência"
            >
              <Users size={13} /> <span className="hidden sm:inline">Pessoas</span>
            </button>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className={`bg-[#0b101f] border rounded-xl px-2 py-1.5 text-xs font-mono outline-none cursor-pointer ${
                assigneeFilter === "all" ? "border-slate-800 text-slate-400" : "border-violet-500/50 text-violet-200"
              }`}
              aria-label="Filtrar por responsável"
            >
              <option value="all">Todos</option>
              <option value="__me">Comigo</option>
              {assigneeNames.map((n) => <option key={n} value={n}>Com {n}</option>)}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setRoutinesOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0b101f] border border-slate-800 text-xs font-mono text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 cursor-pointer transition-colors"
            title="Tarefas que se repetem toda semana/mês"
          >
            <Repeat size={13} /> <span className="hidden sm:inline">Rotinas</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center bg-[#0b101f] border border-slate-800 p-0.5 rounded-xl text-xs font-mono">
            <button
              onClick={() => setViewDensity("compact")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewDensity === "compact" ? "bg-blue-600/20 text-blue-300" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Modo Compacto"
            >
              <Rows3 size={15} />
            </button>
            <button
              onClick={() => setViewDensity("detailed")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewDensity === "detailed" ? "bg-blue-600/20 text-blue-300" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Modo Detalhado"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewDensity("table")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewDensity === "table" ? "bg-blue-600/20 text-blue-300" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Modo Lista"
            >
              <Table size={15} />
            </button>
          </div>
        </div>

      </div>

      {/* PROGRESSO DO RECORTE ATUAL */}
      {allFilteredCards.length > 0 && (() => {
        const doneCount = allFilteredCards.filter((c) => c.completed).length;
        const pct = Math.round((doneCount / allFilteredCards.length) * 100);
        return (
          <div className="px-4 sm:px-8 pt-3 flex items-center gap-3 text-[10px] font-mono text-slate-500 shrink-0">
            <div className="flex-1 h-1 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full bg-emerald-500/80 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span><b className="text-slate-300">{doneCount}</b>/{allFilteredCards.length} concluídas · {pct}%</span>
          </div>
        );
      })()}

      {/* ÁREA DE EXIBIÇÃO: KANBAN vs TABELA */}
      {viewDensity === "table" ? (
        <KanbanTableView
          columns={columns}
          filteredCards={allFilteredCards}
          modules={modules}
          onCardClick={onCardClick}
          onToggleComplete={(cardId: string) => { void onToggleComplete(cardId); }}
          onChangeModule={(cardId: string, modId: string) => { void onQuickChangeModule(cardId, modId); }}
        />
      ) : (
        <div className="flex-1 px-3 py-3 sm:p-8 overflow-x-auto flex gap-3 sm:gap-5 items-start snap-x snap-mandatory sm:snap-none scroll-px-3 overscroll-x-contain">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {columns.map((col, index) => {
              const filteredCards = col.cards.filter(isCardMatchingFilters);

              return (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  cards={filteredCards}
                  density={viewDensity}
                  canMoveLeft={index > 0}
                  canMoveRight={index < columns.length - 1}
                  onMoveLeft={() => void handleMoveColumnPosition(col.id, "left")}
                  onMoveRight={() => void handleMoveColumnPosition(col.id, "right")}
                  onEdit={() => {
                    setEditingColumn(col);
                    setIsColumnModalOpen(true);
                  }}
                  onDelete={() => {
                    setDeleteTargetColumnId(col.id);
                  }}
                  onAddCard={() => onOpenCreateInColumn(col.id)}
                  onArchiveDone={col.isDone ? () => setConfirmArchive(true) : undefined}
                  onOpenArchive={col.isDone ? () => setArchiveOpen(true) : undefined}
                  onQuickAdd={(title) => handleQuickCreate(col.id, title)}
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
              onClick={() => {
                setEditingColumn(null);
                setIsColumnModalOpen(true);
              }}
              className="w-[85vw] sm:w-72 snap-center shrink-0 border-2 border-dashed border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/30 p-5 rounded-3xl flex items-center justify-center gap-2 text-slate-500 hover:text-blue-400 text-xs font-bold font-mono transition-all cursor-pointer"
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
      )}

    </div>
  );
}