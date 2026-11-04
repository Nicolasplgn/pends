"use client";

import { useState } from "react";
import type { Module } from "@prisma/client";
import { Wallet, Plus, ChevronLeft, ChevronRight, BarChart3, LayoutGrid, Table } from "lucide-react";
import { MONTH_NAMES } from "../../types";
import { FinanceDashboard } from "./FinanceDashboard";
import { FinancePipeline } from "./FinancePipeline";
import { FinanceTable } from "./FinanceTable";
import { RecurringModal } from "./modals/RecurringModal";
import { SpawnBillModal } from "./modals/SpawnBillModal";
import { HistoryModal } from "./modals/HistoryModal";

interface FinancesHubProps {
  recurringTasks: any[];
  modules: Module[];
  columns: any[];
  selectedMonth: number;
  selectedYear: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onReload: () => Promise<void>;
  onToggleComplete: (cardId: string) => Promise<void>;
  onCardClick: (cardId: string) => void;
  onQuickUpdateAmount: (taskId: string, amount: number | null) => Promise<void>;
  onSaveRecurring: (title: string, amount: number | null, dueDay: number | null, moduleId: string) => Promise<void>;
  onDeleteRecurring: (taskId: string) => Promise<void>;
  onSpawnCard: (recurringId: string, amount: number | null, month: number, year: number) => Promise<void>;
}

export function FinancesHub({
  recurringTasks,
  modules,
  columns,
  selectedMonth,
  selectedYear,
  onPrevMonth,
  onNextMonth,
  onReload,
  onToggleComplete,
  onCardClick,
  onQuickUpdateAmount,
  onSaveRecurring,
  onDeleteRecurring,
  onSpawnCard,
}: FinancesHubProps) {
  const [subTab, setSubTab] = useState<"dashboard" | "pipeline" | "table">("dashboard");

  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<any>(null);
  const [inspectingTask, setInspectingTask] = useState<any>(null);
  const [spawnTargetTask, setSpawnTargetTask] = useState<any>(null);

  function handleOpenRecurringModal(task?: any) {
    setEditingRecurring(task || null);
    setShowRecurringModal(true);
  }

  function handleStartSpawn(task: any) {
    setSpawnTargetTask(task);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#050811]">
      
      {/* MODAIS DO MÓDULO FINANCEIRO */}
      <RecurringModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        editingRecurring={editingRecurring}
        modules={modules}
        onSave={async (title, amount, dueDay, modId) => {
          await onSaveRecurring(title, amount, dueDay, modId);
          void onReload();
        }}
      />

      <SpawnBillModal
        spawnTargetTask={spawnTargetTask}
        onClose={() => setSpawnTargetTask(null)}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onConfirmSpawn={async (recId, amt, m, y) => {
          await onSpawnCard(recId, amt, m, y);
          void onReload();
        }}
      />

      <HistoryModal
        inspectingTask={inspectingTask}
        onClose={() => setInspectingTask(null)}
        onToggleComplete={onToggleComplete}
        onStartSpawn={handleStartSpawn}
      />

      {/* HEADER DO HUB FINANCEIRO */}
      <div className="h-auto border-b border-slate-800/80 p-4 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between bg-[#0a0f1d] gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-white font-bold font-mono uppercase text-sm">
            <Wallet size={18} className="text-emerald-400" />
            <span>Finanças & Gastos</span>
          </div>

          <div className="flex items-center gap-2 bg-[#070a12] border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
            <button type="button" onClick={onPrevMonth} className="p-1 hover:text-white text-slate-400 cursor-pointer">
              <ChevronLeft size={14}/>
            </button>
            <span className="font-bold text-emerald-400 uppercase tracking-wider px-1 text-[11px]">
              {MONTH_NAMES[selectedMonth]} / {selectedYear}
            </span>
            <button type="button" onClick={onNextMonth} className="p-1 hover:text-white text-slate-400 cursor-pointer">
              <ChevronRight size={14}/>
            </button>
          </div>
        </div>

        {/* SUB-ABAS (DASHBOARD, PIPELINE, PLANILHA) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#070a12] border border-slate-800 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setSubTab("dashboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                subTab === "dashboard" ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 size={14} />
              <span>Dash de Gastos</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab("pipeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                subTab === "pipeline" ? "bg-blue-600/20 text-blue-300 border border-blue-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid size={14} />
              <span>Pipeline de Contas</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                subTab === "table" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-white"
              }`}
            >
              <Table size={14} />
              <span>Planilha</span>
            </button>
          </div>

          <button 
            type="button"
            onClick={() => handleOpenRecurringModal()} 
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/30"
          >
            <Plus size={15}/> Nova Conta
          </button>
        </div>
      </div>

      {/* CONTEÚDO DA SUB-ABA */}
      {subTab === "dashboard" && (
        <FinanceDashboard 
          recurringTasks={recurringTasks} 
          selectedMonth={selectedMonth} 
          selectedYear={selectedYear} 
        />
      )}

      {subTab === "pipeline" && (
        <FinancePipeline 
          columns={columns}
          modules={modules}
          onToggleComplete={onToggleComplete}
          onCardClick={onCardClick}
        />
      )}

      {subTab === "table" && (
        <div className="p-4 sm:p-8 overflow-y-auto flex-1">
          <FinanceTable 
            recurringTasks={recurringTasks}
            onQuickUpdateAmount={onQuickUpdateAmount}
            onOpenHistory={(task) => setInspectingTask(task)}
            onStartSpawn={(task) => handleStartSpawn(task)}
            onOpenRecurringModal={(task) => handleOpenRecurringModal(task)}
            onDeleteRecurring={async (taskId) => {
              if (confirm("Deseja realmente excluir esta rotina?")) {
                await onDeleteRecurring(taskId);
                void onReload();
              }
            }}
          />
        </div>
      )}

    </div>
  );
}