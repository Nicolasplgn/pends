"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Module, Project } from "@prisma/client";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners,
  useSensor, useSensors, PointerSensor, TouchSensor, KeyboardSensor
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Plus, Search, Flame, Clock, LayoutGrid, Rows3, Table, Snowflake, Repeat, Users, FolderKanban, FileText, CalendarRange,
  MoreHorizontal, SlidersHorizontal, Keyboard, FolderOpen, X,
} from "lucide-react";
import type { KanbanColumn as KanbanColumnType, KanbanCardData } from "../../types";
import { isCardOverdue } from "../../types";
import { KanbanColumn } from "./KanbanColumn";
import type { StageRef } from "./KanbanCard";
import { KanbanTableView } from "./KanbanTableView";
import { ColumnModal } from "../shared/ColumnModal";
import { ConfirmModal } from "../shared/ConfirmModal";
import { RoutinesModal } from "./RoutinesModal";
import { PeopleModal } from "./PeopleModal";
import { ArchiveModal } from "./ArchiveModal";
import { ProjectsModal } from "./ProjectsModal";
import { ReportModal } from "./ReportModal";
import { WeekPlanModal } from "./WeekPlanModal";
import { Menu, type MenuItem } from "./Menu";
import { moveCard, createColumn, updateColumn, deleteColumn, moveColumn, reorderColumnCards, quickCreateCard, archiveDoneCardsNow } from "../../actions";

interface KanbanBoardProps {
  projects?: (Project & { _count?: { cards: number } })[];
  columns: KanbanColumnType[];
  setColumns: React.Dispatch<React.SetStateAction<KanbanColumnType[]>>;
  modules: Module[];
  activeModuleFilter: string;
  setActiveModuleFilter: (modId: string) => void;
  onCardClick: (cardId: string) => void;
  onOpenCreateInColumn: (colId: string) => void;
  onQuickChangeModule: (cardId: string, modId: string) => Promise<void>;
  onToggleComplete: (cardId: string) => Promise<void>;
  onReload: () => Promise<void>;
  /** Pedido externo para filtrar por projeto (ex.: clique no Analytics) */
  projectFilterRequest?: { id: string; n: number };
}

const ICEBOX = /gelo|icebox|radar|espera|sem pressa/i;

function useIsDesktop() {
  const [desk, setDesk] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const on = () => setDesk(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desk;
}

export function KanbanBoard({
  projects = [],
  columns,
  setColumns,
  modules,
  activeModuleFilter,
  setActiveModuleFilter,
  onCardClick,
  onOpenCreateInColumn,
  onQuickChangeModule,
  onToggleComplete,
  onReload,
  projectFilterRequest,
}: KanbanBoardProps) {
  const [activeDraggingCard, setActiveDraggingCard] = useState<KanbanCardData | null>(null);
  const isDesktop = useIsDesktop();

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
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem("pends:kanbanDensity", viewDensity); } catch {}
  }, [viewDensity]);

  // MODAIS
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumnType | null>(null);
  const [deleteTargetColumnId, setDeleteTargetColumnId] = useState<string | null>(null);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  // "all" = todos · "__me" = comigo · nome = com essa pessoa
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  // "all" = todos · "__none" = sem projeto · id = projeto
  const [projectFilter, setProjectFilter] = useState<string>(() => (projectFilterRequest?.n ? projectFilterRequest.id : "all"));
  // Novo pedido de filtro vindo de fora (o quadro pode já estar montado)
  const [seenProjectReq, setSeenProjectReq] = useState(projectFilterRequest?.n ?? 0);
  if (projectFilterRequest && projectFilterRequest.n !== seenProjectReq) {
    setSeenProjectReq(projectFilterRequest.n);
    setProjectFilter(projectFilterRequest.id);
  }
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAssignee, setReportAssignee] = useState<string | null>(null);
  const [weekOpen, setWeekOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Navegação por teclado e "adicionar rápido" pelo atalho N
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ colId: string; n: number }>({ colId: "", n: 0 });
  // Etapa visível no celular (abas)
  const [mobileColId, setMobileColId] = useState<string | null>(null);

  useEffect(() => {
    if (!boardError) return;
    const t = setTimeout(() => setBoardError(null), 5000);
    return () => clearTimeout(t);
  }, [boardError]);

  const assigneeNames = useMemo(
    () => [...new Set(columns.flatMap((c) => c.cards.map((k) => k.assignee).filter(Boolean) as string[]))].sort(),
    [columns]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const stages: StageRef[] = useMemo(() => columns.map((c) => ({ id: c.id, title: c.title, isDone: c.isDone })), [columns]);

  const totalCardCount = columns.reduce((acc, col) => acc + col.cards.length, 0);
  const getCardCountByModule = (modId: string) =>
    columns.reduce((acc, col) => acc + col.cards.filter((c) => c.moduleId === modId).length, 0);

  const totalIcebox = useMemo(
    () => columns.filter((col) => ICEBOX.test(col.title)).reduce((sum, col) => sum + col.cards.length, 0),
    [columns]
  );
  const totalOverdue = useMemo(
    () => columns.flatMap((col) => col.cards.filter((card) => !card.completed && !col.isDone && isCardOverdue(card.dueDate))).length,
    [columns]
  );
  const totalUrgent = useMemo(
    () => columns.flatMap((col) => col.cards.filter((card) => !card.completed && (card.priority === "Urgente" || card.priority === "Alta"))).length,
    [columns]
  );

  const isCardMatchingFilters = (card: KanbanCardData, col: KanbanColumnType) => {
    if (activeModuleFilter !== "all" && card.moduleId !== activeModuleFilter) return false;
    if (projectFilter === "__none" && card.projectId) return false;
    if (projectFilter !== "all" && projectFilter !== "__none" && card.projectId !== projectFilter) return false;
    if (assigneeFilter === "__me" && card.assignee) return false;
    if (assigneeFilter !== "all" && assigneeFilter !== "__me" && card.assignee !== assigneeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      // "#707B0B" ou "707b0b": número da ficha (começo do id)
      const ficha = q.replace(/^#/, "");
      const byRef = /^[0-9a-f]{4,36}$/.test(ficha) && card.id.toLowerCase().startsWith(ficha);
      if (!byRef && !card.title.toLowerCase().includes(q) && !(card.description || "").toLowerCase().includes(q)) return false;
    }
    if (focusFilter === "urgent" && card.priority !== "Urgente" && card.priority !== "Alta") return false;
    if (focusFilter === "overdue" && !isCardOverdue(card.dueDate, card.completed)) return false;
    if (focusFilter === "icebox" && !ICEBOX.test(col.title)) return false;
    return true;
  };

  const visible = columns.map((col) => ({ col, cards: col.cards.filter((c) => isCardMatchingFilters(c, col)) }));
  const allFilteredCards = visible.flatMap((v) => v.cards);
  const extraFilters = (projectFilter !== "all" ? 1 : 0) + (assigneeFilter !== "all" ? 1 : 0);

  // ---------- AÇÕES ----------
  async function handleMoveColumnPosition(colId: string, direction: "left" | "right") {
    const currentIndex = columns.findIndex((c) => c.id === colId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;
    const newColumns = [...columns];
    const [movedCol] = newColumns.splice(currentIndex, 1);
    newColumns.splice(targetIndex, 0, movedCol);
    setColumns(newColumns);
    await moveColumn(colId, direction);
    void onReload();
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = event.active.id as string;
    for (const col of columns) {
      const found = col.cards.find((c) => c.id === activeId);
      if (found) { setActiveDraggingCard(found); break; }
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
      const oldIdx = sourceCol.cards.findIndex((c) => c.id === activeCardId);
      const newIdx = sourceCol.cards.findIndex((c) => c.id === overId);
      if (newIdx === -1 || oldIdx === newIdx) return;
      newTargetCards = arrayMove(sourceCol.cards, oldIdx, newIdx);
    } else {
      const rest = targetCol.cards.filter((c) => c.id !== activeCardId);
      const overIdx = rest.findIndex((c) => c.id === overId);
      const insertAt = overIdx === -1 ? rest.length : overIdx;
      const moved = { ...movingCard, columnId: targetCol.id, completed: targetCol.isDone, completedAt: targetCol.isDone ? new Date() : null };
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

  /** Move o card para outra etapa sem arrastar (botões, menu e Shift+setas). */
  async function handleMoveCardTo(cardId: string, targetColId: string) {
    const source = columns.find((col) => col.cards.some((c) => c.id === cardId));
    const target = columns.find((c) => c.id === targetColId);
    if (!source || !target || source.id === target.id) return;
    setColumns((prev) => {
      const card = prev.find((c) => c.id === source.id)?.cards.find((c) => c.id === cardId);
      if (!card) return prev;
      return prev.map((col) => {
        if (col.id === source.id) return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
        if (col.id === target.id) {
          return { ...col, cards: [...col.cards, { ...card, columnId: target.id, completed: target.isDone, completedAt: target.isDone ? new Date() : null }] };
        }
        return col;
      });
    });
    try {
      await moveCard(cardId, target.id);
    } catch {
      setBoardError("Não consegui mover a pendência. Tente de novo.");
    }
    void onReload();
  }

  async function handleSaveColumn(title: string, isDone: boolean, kind: string | null) {
    if (editingColumn) {
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

  // ---------- ATALHOS DE TECLADO ----------
  const kb = useRef({ visible, focusedCardId, columns });
  useEffect(() => { kb.current = { visible, focusedCardId, columns }; });
  const handleMoveCardToRef = useRef(handleMoveCardTo);
  useEffect(() => { handleMoveCardToRef.current = handleMoveCardTo; });

  useEffect(() => {
    const scrollTo = (id: string) =>
      requestAnimationFrame(() => document.querySelector(`[data-card-id="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" }));

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Algum modal aberto: não mexe no quadro
      if (document.querySelector(".fixed.inset-0")) return;

      const { visible: vis, focusedCardId: fid, columns: cols } = kb.current;
      const grid = vis.map((v) => v.cards.map((c) => c.id));
      let ci = -1, ri = -1;
      if (fid) grid.forEach((ids, i) => { const j = ids.indexOf(fid); if (j >= 0) { ci = i; ri = j; } });

      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "?") { e.preventDefault(); setShortcutsOpen((o) => !o); return; }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        const first = cols.find((c) => !c.isDone && !ICEBOX.test(c.title)) ?? cols[0];
        if (first) setQuickAdd((q) => ({ colId: first.id, n: q.n + 1 }));
        return;
      }
      if (e.key === "Escape") { setFocusedCardId(null); return; }

      const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (!arrows.includes(e.key) && e.key !== "Enter") return;

      if (ci === -1) {
        if (!arrows.includes(e.key)) return;
        const firstCol = grid.findIndex((ids) => ids.length > 0);
        if (firstCol === -1) return;
        e.preventDefault();
        setFocusedCardId(grid[firstCol][0]);
        scrollTo(grid[firstCol][0]);
        return;
      }

      e.preventDefault();
      if (e.key === "Enter") { onCardClick(fid!); return; }

      if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const target = cols[e.key === "ArrowLeft" ? ci - 1 : ci + 1];
        if (target) { void handleMoveCardToRef.current(fid!, target.id); scrollTo(fid!); }
        return;
      }
      if (e.key === "ArrowDown" && ri < grid[ci].length - 1) { setFocusedCardId(grid[ci][ri + 1]); scrollTo(grid[ci][ri + 1]); }
      if (e.key === "ArrowUp" && ri > 0) { setFocusedCardId(grid[ci][ri - 1]); scrollTo(grid[ci][ri - 1]); }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const step = e.key === "ArrowLeft" ? -1 : 1;
        for (let k = ci + step; k >= 0 && k < grid.length; k += step) {
          if (grid[k].length) {
            const id = grid[k][Math.min(ri, grid[k].length - 1)];
            setFocusedCardId(id);
            scrollTo(id);
            break;
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCardClick]);

  // ---------- CELULAR: aba da etapa visível ----------
  const scrollLock = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function goToColumn(colId: string) {
    // a rolagem que vem do toque na aba não troca a aba
    scrollLock.current = true;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => { scrollLock.current = false; }, 900);
    setMobileColId(colId);
    boardRef.current?.querySelector(`[data-col-id="${colId}"]`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }
  function onBoardScroll() {
    if (isDesktop || !boardRef.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    // só decide a aba quando a rolagem para
    scrollTimer.current = setTimeout(detectColumn, 120);
  }
  function detectColumn() {
    if (!boardRef.current || scrollLock.current) return;
    const box = boardRef.current;
    const left = box.getBoundingClientRect().left;
    let best: { id: string; d: number } | null = null;
    box.querySelectorAll<HTMLElement>("[data-col-id]").forEach((el) => {
      const d = Math.abs(el.getBoundingClientRect().left - left);
      if (!best || d < best.d) best = { id: el.dataset.colId!, d };
    });
    const found = best as { id: string; d: number } | null;
    if (found && found.id !== mobileColId) setMobileColId(found.id);
  }
  const currentMobileCol = mobileColId ?? columns[0]?.id ?? null;
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!currentMobileCol) return;
    const strip = tabsRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-tab-id="${currentMobileCol}"]`);
    if (!strip || !tab) return;
    const left = tab.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - 12), behavior: "smooth" });
    }
  }, [currentMobileCol]);

  // ---------- MENU "⋯" DO QUADRO ----------
  const moreItems: MenuItem[] = [
    { label: "Planejar a semana", icon: <CalendarRange size={13} />, onSelect: () => setWeekOpen(true) },
    { label: "Relatório de status", icon: <FileText size={13} />, onSelect: () => setReportOpen(true) },
    { label: "Com quem está cada coisa", icon: <Users size={13} />, onSelect: () => setPeopleOpen(true) },
    { label: "Rotinas", icon: <Repeat size={13} />, onSelect: () => setRoutinesOpen(true) },
    { label: "Projetos", icon: <FolderKanban size={13} />, onSelect: () => setProjectsOpen(true) },
    { label: "Arquivo de concluídos", icon: <FolderOpen size={13} />, onSelect: () => setArchiveOpen(true) },
    { label: "Nova etapa", icon: <Plus size={13} />, separator: true, onSelect: () => { setEditingColumn(null); setIsColumnModalOpen(true); } },
    { label: "Atalhos de teclado", icon: <Keyboard size={13} />, hint: "?", onSelect: () => setShortcutsOpen(true) },
  ];

  const filterItems: MenuItem[] = [
    { label: "Projeto", heading: true, onSelect: () => {} },
    { label: "Todos os projetos", active: projectFilter === "all", onSelect: () => setProjectFilter("all") },
    ...projects.filter((p) => p.active).map((p) => ({
      label: p.title,
      icon: <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />,
      active: projectFilter === p.id,
      onSelect: () => setProjectFilter(p.id),
    })),
    { label: "Sem projeto", active: projectFilter === "__none", onSelect: () => setProjectFilter("__none") },
    { label: "Com quem", heading: true, separator: true, onSelect: () => {} },
    { label: "Todos", active: assigneeFilter === "all", onSelect: () => setAssigneeFilter("all") },
    { label: "Comigo", active: assigneeFilter === "__me", onSelect: () => setAssigneeFilter("__me") },
    ...assigneeNames.map((n) => ({ label: `Com ${n}`, active: assigneeFilter === n, onSelect: () => setAssigneeFilter(n) })),
  ];

  const chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer shrink-0 ${
      on ? "bg-slate-800 text-white border-slate-600" : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/60"
    }`;

  const projectName = projectFilter === "__none" ? "Sem projeto" : projects.find((p) => p.id === projectFilter)?.title;
  const assigneeName = assigneeFilter === "__me" ? "Comigo" : assigneeFilter !== "all" ? `Com ${assigneeFilter}` : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#050811]">
      {boardError && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-70 px-4 py-2.5 rounded-xl bg-rose-950 border border-rose-500/50 text-xs text-rose-200 shadow-2xl">
          {boardError}
        </div>
      )}

      <ColumnModal
        isOpen={isColumnModalOpen}
        onClose={() => { setIsColumnModalOpen(false); setEditingColumn(null); }}
        column={editingColumn}
        onSave={handleSaveColumn}
      />
      <ProjectsModal isOpen={projectsOpen} onClose={() => setProjectsOpen(false)} projects={projects} onChanged={() => void onReload()} />
      {reportOpen && (
        <ReportModal
          isOpen={reportOpen}
          onClose={() => { setReportOpen(false); setReportAssignee(null); }}
          projects={projects}
          defaultProjectId={projectFilter !== "all" && projectFilter !== "__none" ? projectFilter : null}
          defaultAssignee={reportAssignee ?? (assigneeFilter !== "all" ? assigneeFilter : null)}
        />
      )}
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
      <RoutinesModal isOpen={routinesOpen} onClose={() => setRoutinesOpen(false)} modules={modules} onChanged={() => void onReload()} />
      <ConfirmModal
        isOpen={!!deleteTargetColumnId}
        onClose={() => setDeleteTargetColumnId(null)}
        title="Excluir Etapa do Kanban?"
        description="Tem certeza? Todas as pendências que estiverem dentro desta etapa serão excluídas permanentemente."
        confirmText="Sim, Excluir Etapa"
        danger={true}
        onConfirm={handleConfirmDeleteColumn}
      />

      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setShortcutsOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#0b101f] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Atalhos do Pipeline</h3>
              <button type="button" onClick={() => setShortcutsOpen(false)} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={16} /></button>
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              {[
                ["N", "Nova pendência na primeira etapa"],
                ["/", "Buscar"],
                ["← ↑ ↓ →", "Andar entre as pendências"],
                ["Enter", "Abrir a pendência selecionada"],
                ["Shift + ← / →", "Mover para a etapa anterior / seguinte"],
                ["Esc", "Tirar a seleção"],
                ["?", "Mostrar estes atalhos"],
              ].map(([k, d]) => (
                <li key={k} className="flex items-center justify-between gap-3">
                  <span>{d}</span>
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 font-mono text-[11px] text-slate-200">{k}</kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* BARRA ÚNICA: busca · módulos · foco · filtros · visão · ⋯ */}
      <div className="bg-[#0b101d] border-b border-slate-800/80 px-3 sm:px-6 py-2 flex items-center gap-2 shrink-0">
       <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        <div className="relative w-36 sm:w-48 shrink-0">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar ou #ficha  ( / )"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); (e.target as HTMLInputElement).blur(); } }}
            className="w-full bg-[#070a12] border border-slate-800 pl-8 pr-7 py-1.5 rounded-lg text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer" aria-label="Limpar busca">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="h-5 w-px bg-slate-800 shrink-0" />

        <button type="button" onClick={() => setActiveModuleFilter("all")} className={chip(activeModuleFilter === "all")}>
          Todos <span className="font-mono text-[10px] text-slate-500">{totalCardCount}</span>
        </button>
        {modules.map((m) => (
          <button
            type="button"
            key={m.id}
            onClick={() => setActiveModuleFilter(activeModuleFilter === m.id ? "all" : m.id)}
            className={chip(activeModuleFilter === m.id)}
            style={activeModuleFilter === m.id ? { borderColor: m.color } : undefined}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
            {m.title}
            <span className="font-mono text-[10px] text-slate-500">{getCardCountByModule(m.id)}</span>
          </button>
        ))}

        <div className="h-5 w-px bg-slate-800 shrink-0" />

        <button type="button" onClick={() => setFocusFilter((f) => (f === "urgent" ? "all" : "urgent"))} className={chip(focusFilter === "urgent")}>
          <Flame size={12} className="text-amber-400" /> Urgentes <span className="font-mono text-[10px] text-slate-500">{totalUrgent}</span>
        </button>
        <button type="button" onClick={() => setFocusFilter((f) => (f === "overdue" ? "all" : "overdue"))} className={chip(focusFilter === "overdue")}>
          <Clock size={12} className="text-red-400" /> Vencidas <span className="font-mono text-[10px] text-slate-500">{totalOverdue}</span>
        </button>
        {totalIcebox > 0 && (
          <button type="button" onClick={() => setFocusFilter((f) => (f === "icebox" ? "all" : "icebox"))} className={chip(focusFilter === "icebox")}>
            <Snowflake size={12} className="text-cyan-400" /> Gelo <span className="font-mono text-[10px] text-slate-500">{totalIcebox}</span>
          </button>
        )}


       </div>
        <div className="flex items-center gap-1 shrink-0">
        <Menu
          align="right"
          title="Filtrar por projeto ou pessoa"
          items={filterItems}
          trigger={
            <span className={chip(extraFilters > 0)}>
              <SlidersHorizontal size={12} /> Filtros
              {extraFilters > 0 && <span className="px-1.5 rounded-full bg-violet-500/30 text-violet-200 text-[10px] font-mono">{extraFilters}</span>}
            </span>
          }
        />

          <div className="flex items-center bg-[#070a12] border border-slate-800 p-0.5 rounded-lg">
            {([
              ["compact", <Rows3 key="c" size={14} />, "Compacto"],
              ["detailed", <LayoutGrid key="d" size={14} />, "Detalhado"],
              ["table", <Table key="t" size={14} />, "Lista"],
            ] as const).map(([v, icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewDensity(v)}
                className={`p-1.5 rounded-md cursor-pointer ${viewDensity === v ? "bg-blue-600/20 text-blue-300" : "text-slate-500 hover:text-slate-300"}`}
                title={label}
                aria-label={label}
                aria-pressed={viewDensity === v}
              >
                {icon}
              </button>
            ))}
          </div>
          <Menu
            title="Mais"
            items={moreItems}
            trigger={
              <span className="grid place-items-center w-8 h-8 rounded-lg border border-slate-800 bg-[#070a12] text-slate-400 hover:text-white hover:border-slate-600">
                <MoreHorizontal size={16} />
              </span>
            }
          />
        </div>
      </div>

      {/* Filtros ativos que não aparecem na barra */}
      {(projectName || assigneeName) && (
        <div className="px-3 sm:px-6 pt-2 flex flex-wrap gap-1.5 shrink-0">
          {projectName && (
            <button type="button" onClick={() => setProjectFilter("all")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/40 text-[11px] text-violet-200 cursor-pointer">
              Projeto: {projectName} <X size={11} />
            </button>
          )}
          {assigneeName && (
            <button type="button" onClick={() => setAssigneeFilter("all")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/40 text-[11px] text-violet-200 cursor-pointer">
              {assigneeName} <X size={11} />
            </button>
          )}
        </div>
      )}

      {/* CELULAR: abas das etapas */}
      {viewDensity !== "table" && (
        <div ref={tabsRef} className="sm:hidden flex gap-1.5 overflow-x-auto px-3 pt-2.5 pb-1 shrink-0 [scrollbar-width:none]">
          {visible.map(({ col, cards }) => (
            <button
              key={col.id}
              type="button"
              data-tab-id={col.id}
              onClick={() => goToColumn(col.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border cursor-pointer ${
                currentMobileCol === col.id ? "bg-blue-600 text-white border-blue-500" : "bg-[#0b101d] text-slate-400 border-slate-800"
              }`}
            >
              {col.title}
              <span className={`font-mono text-[10px] ${currentMobileCol === col.id ? "text-blue-100" : "text-slate-500"}`}>{cards.length}</span>
            </button>
          ))}
        </div>
      )}

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
        <div
          ref={boardRef}
          onScroll={onBoardScroll}
          className="flex-1 px-3 py-3 sm:px-6 sm:py-5 overflow-x-auto flex gap-3 items-start snap-x snap-mandatory sm:snap-none scroll-px-3 overscroll-x-contain"
        >
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {visible.map(({ col, cards }, index) => (
              <KanbanColumn
                key={col.id}
                col={col}
                cards={cards}
                density={viewDensity}
                canMoveLeft={index > 0}
                canMoveRight={index < columns.length - 1}
                onMoveLeft={() => void handleMoveColumnPosition(col.id, "left")}
                onMoveRight={() => void handleMoveColumnPosition(col.id, "right")}
                onEdit={() => { setEditingColumn(col); setIsColumnModalOpen(true); }}
                onDelete={() => setDeleteTargetColumnId(col.id)}
                onAddCard={() => onOpenCreateInColumn(col.id)}
                onArchiveDone={col.isDone ? () => setConfirmArchive(true) : undefined}
                onOpenArchive={col.isDone ? () => setArchiveOpen(true) : undefined}
                onQuickAdd={(title) => handleQuickCreate(col.id, title)}
                onCardClick={(cardId) => { setFocusedCardId(cardId); onCardClick(cardId); }}
                modules={modules}
                onChangeModule={onQuickChangeModule}
                onToggleComplete={onToggleComplete}
                stages={stages}
                onMoveCard={(cardId, target) => void handleMoveCardTo(cardId, target)}
                autoCollapse={isDesktop && cards.length === 0 && !searchQuery.trim()}
                dragging={!!activeDraggingCard}
                focusedCardId={focusedCardId}
                quickAddSignal={quickAdd.colId === col.id ? quickAdd.n : 0}
              />
            ))}

            <button
              type="button"
              onClick={() => { setEditingColumn(null); setIsColumnModalOpen(true); }}
              className="hidden sm:flex w-11 shrink-0 self-stretch max-h-80 rounded-2xl border border-dashed border-slate-800 hover:border-blue-500/50 items-center justify-center text-slate-600 hover:text-blue-400 cursor-pointer"
              title="Nova etapa"
              aria-label="Nova etapa"
            >
              <Plus size={16} />
            </button>

            <DragOverlay>
              {activeDraggingCard ? (
                <div className="w-72 bg-[#151d30] px-3 py-2.5 rounded-xl border-2 border-blue-500 shadow-2xl rotate-2 cursor-grabbing pointer-events-none">
                  <p className="text-[13px] font-medium text-white line-clamp-2">{activeDraggingCard.title}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
}
