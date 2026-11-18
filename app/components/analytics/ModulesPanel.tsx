"use client";

import { useMemo, useState } from "react";
import type { Module } from "@prisma/client";
import type { KanbanColumn } from "../../types";
import { buildModuleNodes } from "../neural/moduleNodes";
import { NeuralGrid } from "../neural/NeuralGrid";
import { NeuralBottomSheet } from "../neural/NeuralBottomSheet";

interface ModulesPanelProps {
  modules: Module[];
  columns: KanbanColumn[];
  moduleSpend?: Record<string, { spent: number; budget: number | null }>;
  onToggleComplete: (cardId: string) => void;
  onCardClick?: (cardId: string) => void;
  onGoToPipeline: (modId: string) => void;
}

/** O antigo "Painel Modular" da Visão Neural, agora dentro do Painel. */
export function ModulesPanel({ modules, columns, moduleSpend, onToggleComplete, onCardClick, onGoToPipeline }: ModulesPanelProps) {
  const nodes = useMemo(() => buildModuleNodes(modules, columns), [modules, columns]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? nodes.find((n) => n.id === openId) ?? null : null;
  const total = columns.reduce((s, c) => s + c.cards.length, 0);
  const done = columns.reduce((s, c) => s + c.cards.filter((x) => x.completed).length, 0);

  return (
    <>
      <NeuralGrid
        embedded
        moduleNodes={nodes}
        totalAllTasks={total}
        completedAllTasks={done}
        onSelectModule={(n) => setOpenId(n.id)}
        onToggleComplete={onToggleComplete}
        onCardClick={onCardClick}
        onGoToPipeline={onGoToPipeline}
        moduleSpend={moduleSpend}
      />
      <NeuralBottomSheet
        selectedModule={open}
        onClose={() => setOpenId(null)}
        onSelectModule={onGoToPipeline}
        onToggleComplete={onToggleComplete}
      />
    </>
  );
}
