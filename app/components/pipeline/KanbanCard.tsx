"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Module } from "@prisma/client";
import {
  CheckCircle2, Circle, AlertTriangle, Calendar, ChevronLeft, ChevronRight, Lock, ListChecks, Timer, MoreHorizontal,
  ArrowRightLeft, ExternalLink, Check,
} from "lucide-react";
import type { KanbanCardData } from "../../types";
import { isCardOverdue } from "../../types";
import { daysUntil } from "../finances/format";
import { Avatar } from "./PeopleModal";
import { Menu, type MenuItem } from "./Menu";

function dueChip(dueDate: Date | string | null, completed: boolean) {
  if (!dueDate || completed) return null;
  const d = daysUntil(dueDate);
  if (d < 0) return { label: d === -1 ? "ontem" : `${Math.abs(d)}d atrasada`, cls: "bg-red-500/20 text-red-300 border-red-500/40" };
  if (d === 0) return { label: "hoje", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
  if (d === 1) return { label: "amanhã", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" };
  if (d <= 6) return { label: `em ${d}d`, cls: "bg-slate-800 text-slate-300 border-slate-700" };
  return {
    label: new Date(dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
    cls: "bg-slate-900 text-slate-400 border-slate-800",
  };
}

export interface StageRef {
  id: string;
  title: string;
  isDone: boolean;
}

interface KanbanCardProps {
  card: KanbanCardData;
  density?: "compact" | "detailed";
  onClick?: () => void;
  modules: Module[];
  onChangeModule?: (moduleId: string) => void;
  onToggleComplete?: () => void;
  /** Etapas do quadro (para "Mover para…") e a etapa atual */
  stages: StageRef[];
  columnId: string;
  onMoveTo: (columnId: string) => void;
  /** Destaque da navegação por teclado */
  focused?: boolean;
}

export function KanbanCard({
  card,
  density = "compact",
  onClick,
  modules,
  onChangeModule,
  onToggleComplete,
  stages,
  columnId,
  onMoveTo,
  focused = false,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.2 : 1 };

  const overdue = isCardOverdue(card.dueDate, card.completed);
  const chip = dueChip(card.dueDate, card.completed);
  const checklist = ((card.checklist as unknown) as { done: boolean }[] | null) ?? [];
  const checkDone = checklist.filter((i) => i.done).length;
  const blocked = !!card.blockedBy && !card.blockedBy.completed && !card.blockedBy.column?.isDone;
  const timerOn = !!card.timerStartedAt;
  const hot = !card.completed && (card.priority === "Urgente" || card.priority === "Alta");

  const idx = stages.findIndex((s) => s.id === columnId);
  const prev = idx > 0 ? stages[idx - 1] : null;
  const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;

  const menuItems: MenuItem[] = [
    { label: "Abrir ficha", icon: <ExternalLink size={13} />, onSelect: () => onClick?.(), hint: "Enter" },
    {
      label: card.completed ? "Reabrir" : "Concluir",
      icon: <Check size={13} />,
      onSelect: () => onToggleComplete?.(),
    },
    { label: "Mover para", heading: true, separator: true, onSelect: () => {} },
    ...stages.map((s) => ({
      label: s.title,
      icon: <ArrowRightLeft size={12} />,
      active: s.id === columnId,
      disabled: s.id === columnId,
      onSelect: () => onMoveTo(s.id),
    })),
  ];

  const stopDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

  const moveButtons = (
    <div className="flex items-center gap-0.5 shrink-0 sm:absolute sm:right-1 sm:top-1 sm:z-10 sm:rounded-lg sm:bg-[#1a2236] sm:border sm:border-slate-700 sm:shadow-lg sm:p-0.5 sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto sm:group-focus-within:opacity-100 sm:group-focus-within:pointer-events-auto transition-opacity">
      {prev && (
        <button
          type="button"
          {...stopDrag}
          onClick={(e) => { e.stopPropagation(); onMoveTo(prev.id); }}
          className="hidden sm:grid place-items-center w-6 h-6 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 cursor-pointer"
          title={`Voltar para ${prev.title}`}
          aria-label={`Voltar para ${prev.title}`}
        >
          <ChevronLeft size={14} />
        </button>
      )}
      {next && (
        <button
          type="button"
          {...stopDrag}
          onClick={(e) => { e.stopPropagation(); onMoveTo(next.id); }}
          className="hidden sm:grid place-items-center w-6 h-6 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 cursor-pointer"
          title={`Avançar para ${next.title}`}
          aria-label={`Avançar para ${next.title}`}
        >
          <ChevronRight size={14} />
        </button>
      )}
      <Menu
        title="Mais ações"
        items={menuItems}
        trigger={
          <span className="grid place-items-center w-7 h-7 sm:w-6 sm:h-6 rounded-md text-slate-500 hover:text-white hover:bg-slate-700">
            <MoreHorizontal size={15} />
          </span>
        }
      />
    </div>
  );

  const checkButton = (
    <button
      type="button"
      {...stopDrag}
      onClick={(e) => { e.stopPropagation(); onToggleComplete?.(); }}
      className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer shrink-0 mt-px"
      title={card.completed ? "Reabrir pendência" : "Marcar como concluída"}
      aria-label={card.completed ? "Reabrir pendência" : "Marcar como concluída"}
    >
      {card.completed ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} className={overdue ? "text-red-400" : ""} />}
    </button>
  );

  const meta = (
    <>
      {chip && (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-px rounded border font-mono ${chip.cls}`}>
          <Calendar size={10} /> {chip.label}
        </span>
      )}
      {card.assignee && (
        <span className="inline-flex items-center gap-1 text-[10px] text-violet-300">
          <Avatar name={card.assignee} size={14} /> {card.assignee}
        </span>
      )}
      {card.project && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: card.project.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: card.project.color }} />
          {card.project.title}
        </span>
      )}
      {checklist.length > 0 && (
        <span className={`inline-flex items-center gap-1 text-[10px] font-mono ${checkDone === checklist.length ? "text-emerald-400" : "text-slate-400"}`}>
          <ListChecks size={11} /> {checkDone}/{checklist.length}
        </span>
      )}
      {blocked && (
        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400" title={`Esperando: ${card.blockedBy!.title}`}>
          <Lock size={10} /> esperando
        </span>
      )}
      {timerOn && (
        <span className="inline-flex items-center gap-1 text-[10px] text-rose-400" title="Cronômetro rodando">
          <Timer size={11} className="animate-pulse" />
        </span>
      )}
    </>
  );
  const hasMeta = !!chip || !!card.assignee || !!card.project || checklist.length > 0 || blocked || timerOn;

  const shell = `group relative rounded-xl border cursor-grab select-none transition-colors outline-none ${
    focused ? "ring-2 ring-blue-500/70" : ""
  } ${
    card.completed
      ? "bg-[#0b1424]/70 border-emerald-500/25 opacity-70"
      : overdue
        ? "bg-[#180d12] border-red-500/60"
        : "bg-[#121829] border-slate-800 hover:border-slate-600"
  }`;

  // Barra lateral colorida = módulo; mais grossa e quente quando é Alta/Urgente
  const stripe = (
    <span
      className={`absolute left-0 top-2 bottom-2 rounded-r ${hot ? "w-1" : "w-0.5"}`}
      style={{ backgroundColor: hot ? (card.priority === "Urgente" ? "#ef4444" : "#f59e0b") : card.module?.color ?? "#334155" }}
      aria-hidden
    />
  );

  if (density === "compact") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        data-card-id={card.id}
        onClick={() => { if (!isDragging) onClick?.(); }}
        className={`${shell} pl-3 pr-1.5 py-2 mb-1.5`}
      >
        {stripe}
        <div className="flex items-start gap-2">
          {checkButton}
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] leading-snug font-medium line-clamp-2 ${
              card.completed ? "line-through text-slate-500" : overdue ? "text-red-100" : "text-slate-100"
            }`}>
              {card.priority === "Urgente" && !card.completed && <span className="text-red-400 font-bold mr-1">!</span>}
              {card.title}
            </p>
            {hasMeta && <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">{meta}</div>}
          </div>
          {moveButtons}
        </div>
      </div>
    );
  }

  // MODO DETALHADO
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-card-id={card.id}
      onClick={() => { if (!isDragging) onClick?.(); }}
      className={`${shell} pl-3.5 pr-2 py-3 mb-2`}
    >
      {stripe}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {checkButton}
          <div className="relative" onClick={(e) => e.stopPropagation()} {...stopDrag}>
            <select
              value={card.moduleId || ""}
              onChange={(e) => onChangeModule?.(e.target.value)}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-transparent outline-none cursor-pointer appearance-none"
              style={{
                backgroundColor: card.module ? `${card.module.color}25` : "#1e293b",
                color: card.module ? card.module.color : "#94a3b8",
                border: card.module ? `1px solid ${card.module.color}40` : "1px solid #334155",
              }}
              aria-label="Módulo"
            >
              <option value="" className="bg-[#0f172a] text-white">Sem módulo</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#0f172a] text-white">{m.title}</option>
              ))}
            </select>
          </div>
          {overdue && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
              <AlertTriangle size={10} /> Vencida
            </span>
          )}
          {hot && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
              card.priority === "Urgente" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
            }`}>
              {card.priority}
            </span>
          )}
        </div>
        {moveButtons}
      </div>

      <h4 className={`font-semibold text-sm leading-snug line-clamp-3 ${
        card.completed ? "line-through text-slate-400" : overdue ? "text-red-100" : "text-slate-100"
      }`}>
        {card.title}
      </h4>
      {card.description && <p className="text-xs text-slate-400 line-clamp-2 mt-1">{card.description}</p>}
      {hasMeta && <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2">{meta}</div>}
    </div>
  );
}
