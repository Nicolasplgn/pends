"use client";

import type { Module } from "@prisma/client";
import type { KanbanColumn } from "../../types";
import { NeuralGraph } from "./NeuralGraph";

interface NeuralViewProps {
  modules: Module[];
  columns: KanbanColumn[];
  onSelectModule: (modId: string) => void;
  onCardClick?: (cardId: string) => void;
}

/** Visão Neural: só a constelação das pendências (estilo graph view do Obsidian). */
export function NeuralView({ modules, columns, onSelectModule, onCardClick }: NeuralViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#06090f] text-slate-200">
      <div className="px-4 sm:px-8 py-3 border-b border-slate-800/80 bg-[#0a0f1d] flex flex-col sm:flex-row sm:items-center justify-between gap-1 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-cyan-400">Visão Neural</span>
          </div>
          <h2 className="text-lg font-black tracking-tight text-white">Constelação das pendências</h2>
        </div>
        <p className="text-[11px] text-slate-500 font-mono">
          Arraste para mover · roda/pinça para zoom · clique numa pendência para abrir · clique num módulo para focar
        </p>
      </div>
      <NeuralGraph modules={modules} columns={columns} onCardClick={onCardClick} onOpenModule={onSelectModule} />
    </div>
  );
}
