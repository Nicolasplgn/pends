import type { Module } from "@prisma/client";
import type { KanbanColumn, NeuralCard, NeuralNode } from "../../types";

/** Agrupa os cards do quadro por módulo (usado no Painel Modular e na gaveta do módulo). */
export function buildModuleNodes(modules: Module[], columns: KanbanColumn[]): NeuralNode[] {
  const map: Record<string, NeuralCard[]> = {};
  modules.forEach((m) => { map[m.id] = []; });
  columns.forEach((col) => {
    col.cards.forEach((card) => {
      if (card.moduleId && map[card.moduleId]) map[card.moduleId].push({ ...card, columnTitle: col.title });
    });
  });
  return modules.map((m) => {
    const cards = map[m.id] || [];
    const completed = cards.filter((c) => c.completed).length;
    return {
      ...m,
      x: 0,
      y: 0,
      cards,
      total: cards.length,
      completed,
      percent: cards.length > 0 ? Math.round((completed / cards.length) * 100) : 0,
    };
  });
}
