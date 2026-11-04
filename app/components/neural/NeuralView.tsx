"use client";

import { useMemo, useState } from "react";
import type { Module } from "@prisma/client";
import { Globe, Layers } from "lucide-react";
import type { KanbanColumn, NeuralCard, NeuralNode } from "../../types";
import { isCardOverdue } from "../../types";
import { NeuralOrbit } from "./NeuralOrbit";
import { NeuralGrid } from "./NeuralGrid";
import { NeuralBottomSheet } from "./NeuralBottomSheet";

interface NeuralViewProps {
  modules: Module[];
  columns: KanbanColumn[];
  onSelectModule: (modId: string) => void;
  onToggleComplete: (cardId: string) => void;
}

export function NeuralView({
  modules,
  columns,
  onSelectModule,
  onToggleComplete,
}: NeuralViewProps) {
  const [viewMode, setViewMode] = useState<"orbit" | "grid">("orbit");
  const [selectedModule, setSelectedModule] = useState<NeuralNode | null>(null);

  // Mapeamento das pendências por módulo
  const moduleCardsMap = useMemo(() => {
    const map: Record<string, NeuralCard[]> = {};
    modules.forEach((m) => { map[m.id] = []; });
    columns.forEach((col) => {
      col.cards.forEach((card) => {
        if (card.moduleId && map[card.moduleId]) {
          map[card.moduleId].push({ ...card, columnTitle: col.title });
        }
      });
    });
    return map;
  }, [modules, columns]);

  const totalAllTasks = columns.reduce((acc: number, c) => acc + c.cards.length, 0);
  const completedAllTasks = columns.reduce((acc: number, c) => acc + c.cards.filter((card) => card.completed).length, 0);
  const globalCompletionRate = totalAllTasks > 0 ? Math.round((completedAllTasks / totalAllTasks) * 100) : 0;

  // Nós com cálculo polar para órbita e métricas de progresso
  const moduleNodes: NeuralNode[] = useMemo(() => {
    const count = modules.length;
    const centerX = 360;
    const centerY = 360;
    const radius = 230;

    if (count === 0) return [];

    return modules.map((m, index) => {
      const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      const cards = moduleCardsMap[m.id] || [];
      const completed = cards.filter((c) => c.completed).length;
      return {
        ...m,
        x,
        y,
        cards,
        total: cards.length,
        completed,
        percent: cards.length > 0 ? Math.round((completed / cards.length) * 100) : 0,
      };
    });
  }, [modules, moduleCardsMap]);

  // Listas globais para o Radar
  const allUrgentCards = useMemo(() => {
    const list: NeuralCard[] = [];
    columns.forEach((col) => {
      col.cards.forEach((card) => {
        if (!card.completed && (card.priority === "Urgente" || card.priority === "Alta")) {
          list.push({ ...card, columnTitle: col.title });
        }
      });
    });
    return list;
  }, [columns]);

  const allOverdueCards = useMemo(() => {
    const list: NeuralCard[] = [];
    columns.forEach((col) => {
      col.cards.forEach((card) => {
        if (!card.completed && isCardOverdue(card.dueDate)) {
          list.push({ ...card, columnTitle: col.title });
        }
      });
    });
    return list;
  }, [columns]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#050811] text-slate-200">
      
      {/* HEADER DE COMANDO // SELETOR DE VISÃO */}
      <div className="p-4 sm:px-8 border-b border-slate-800/80 bg-[#0a0f1d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-cyan-400">
              PENDS // VISÃO NEURAL INTEGRADA
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white font-sans">
            Rede Sináptica & Central de Módulos
          </h2>
        </div>

        {/* TOGGLE: ORBITAL vs MODULAR */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#070b14] border border-slate-800 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setViewMode("orbit")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "orbit"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Globe size={14} />
              <span className="hidden sm:inline">Constelação Orbital</span>
              <span className="sm:hidden">Orbital</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Painel Modular</span>
              <span className="sm:hidden">Módulos</span>
            </button>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-[#070b14] border border-slate-800 font-mono text-xs flex items-center gap-2">
            <span className="text-slate-400">Entrega:</span>
            <span className="font-bold text-emerald-400">{globalCompletionRate}%</span>
          </div>
        </div>
      </div>

{/* RENDERIZAÇÃO DA VISÃO ESCOLHIDA */}
{viewMode === "orbit" ? (
        <NeuralOrbit
          moduleNodes={moduleNodes}
          totalAllTasks={totalAllTasks}
          onSelectNode={(node) => setSelectedModule(node)}
          onToggleComplete={onToggleComplete} // ✅ SÓ PRECISAVA ADICIONAR ISSO AQUI
        />
      ) : (
        <NeuralGrid
          moduleNodes={moduleNodes}
          totalAllTasks={totalAllTasks}
          completedAllTasks={completedAllTasks}
          allUrgentCards={allUrgentCards}
          allOverdueCards={allOverdueCards}
          onSelectModule={(node) => setSelectedModule(node)}
          onToggleComplete={onToggleComplete}
        />
      )}

      {/* BOTTOM SHEET TÁTIL */}
      <NeuralBottomSheet
        selectedModule={selectedModule}
        onClose={() => setSelectedModule(null)}
        onSelectModule={onSelectModule}
        onToggleComplete={onToggleComplete}
      />

    </div>
  );
}