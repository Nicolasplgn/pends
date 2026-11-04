"use client";

import { useCallback, useEffect, useState } from "react";
import type { Module } from "@prisma/client";
import { Menu } from "lucide-react";

import { 
  getModules, getBoardData, getDashboardStats, getRecurringTasks,
  createModule, updateModule, deleteModule,
  toggleCardCompletion, updateCardModule,
  createCard, quickUpdateRecurringAmount, 
  createRecurringTask, deleteRecurringTask, 
  spawnCardFromRecurring,
  checkAuthSession, logoutAction
} from "./actions";

import type { KanbanColumn, DashboardStats } from "./types";

import { LoginScreen } from "./components/auth/LoginScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { NeuralView } from "./components/neural/NeuralView";
import { AnalyticsDash } from "./components/analytics/AnalyticsDash";
import { KanbanBoard } from "./components/pipeline/KanbanBoard";
import { FinancesHub } from "./components/finances/FinancesHub";

import { CardDetailModal } from "./components/shared/CardDetailModal";
import { ModuleModal } from "./components/shared/ModuleModal";
import { CreateCardModal } from "./components/shared/CreateCardModal";

export default function PendsApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"neural" | "dashboard" | "kanban" | "finances">("neural");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [modules, setModules] = useState<Module[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recurringTasks, setRecurringTasks] = useState<any[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [activeModuleFilter, setActiveModuleFilter] = useState<string>("all");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Modals
  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [createTargetColumnId, setCreateTargetColumnId] = useState<string>("");
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  const loadAll = useCallback(async () => {
    const [mods, board, dash, recur] = await Promise.all([
      getModules(), getBoardData(), getDashboardStats(), getRecurringTasks()
    ]);
    setModules(mods);
    if (board?.columns) setColumns(board.columns);
    setStats(dash);
    setRecurringTasks(recur);
  }, []);

  useEffect(() => {
    checkAuthSession().then((isAuth) => {
      if (isAuth) setIsAuthenticated(true);
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadAll();
    }
  }, [isAuthenticated, loadAll]);

  async function handleLogout() {
    await logoutAction();
    setIsAuthenticated(false);
  }

  function handlePrevMonth() {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  function handleOpenModuleModal(mod?: Module) {
    if (mod) {
      setEditingModule(mod);
    } else {
      setEditingModule(null);
    }
    setShowModuleModal(true);
  }

  async function handleSaveModule(title: string, color: string) {
    if (editingModule) {
      await updateModule(editingModule.id, title, color);
    } else {
      await createModule(title, color);
    }
    setShowModuleModal(false);
    setEditingModule(null);
    void loadAll();
  }

  async function handleDeleteModule(id: string) {
    if (confirm("Deseja realmente remover este módulo?")) {
      if (activeModuleFilter === id) setActiveModuleFilter("all");
      await deleteModule(id);
      void loadAll();
    }
  }

  if (!isAuthenticated) return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="h-screen bg-[#050811] flex overflow-hidden font-sans text-slate-300">
      
      {/* MODAL FICHA DETALHADA DO CARD */}
      <CardDetailModal 
        cardId={selectedCardId} 
        isOpen={!!selectedCardId} 
        onClose={() => setSelectedCardId(null)} 
        modules={modules}
        onReload={loadAll}
      />

      {/* MODAL CRIAÇÃO DE MÓDULO */}
      <ModuleModal
        isOpen={showModuleModal}
        onClose={() => setShowModuleModal(false)}
        editingModule={editingModule}
        onSave={handleSaveModule}
      />

      {/* MODAL CRIAÇÃO DE PENDÊNCIA */}
      <CreateCardModal
        isOpen={showCreateCardModal}
        onClose={() => setShowCreateCardModal(false)}
        modules={modules}
        targetColumnId={createTargetColumnId}
        defaultModuleId={activeModuleFilter !== "all" ? activeModuleFilter : ""}
        onCreate={async (colId, title, modId, priority, desc, dueDate) => {
          await createCard(colId, title, modId, priority, desc, dueDate);
          void loadAll();
        }}
      />

      {/* SIDEBAR GLOBAL */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        modules={modules}
        activeModuleFilter={activeModuleFilter}
        setActiveModuleFilter={setActiveModuleFilter}
        onOpenModuleModal={handleOpenModuleModal}
        onDeleteModule={handleDeleteModule}
        onLogout={() => void handleLogout()}
      />

      {/* ÁREA CENTRAL DO ORQUESTRADOR */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#050811] relative">
        
        {/* BOTÃO HAMBURGUER MOBILE */}
        <div className="md:hidden flex items-center justify-between p-4 bg-[#0a0f1d] border-b border-slate-800 z-30 shrink-0">
          <button 
            type="button" 
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-sm uppercase tracking-wider font-mono text-white">
            {activeTab === "neural" && "Visão Neural"}
            {activeTab === "dashboard" && "Analytics"}
            {activeTab === "kanban" && "Pipeline"}
            {activeTab === "finances" && "Finanças & Gastos"}
          </span>
          <div className="w-8" />
        </div>

        {/* ABA 1: VISÃO NEURAL HÍBRIDA */}
        {activeTab === "neural" && (
          <NeuralView 
            modules={modules} 
            columns={columns} 
            onSelectModule={(modId: string) => { setActiveModuleFilter(modId); setActiveTab("kanban"); }}
            onToggleComplete={async (cardId) => {
              await toggleCardCompletion(cardId);
              void loadAll();
            }}
          />
        )}

        {/* ABA 2: ANALYTICS DASH */}
        {activeTab === "dashboard" && (
          <AnalyticsDash
            stats={stats}
            modules={modules}
            columns={columns}
            recurringTasks={recurringTasks}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onToggleComplete={async (cardId) => {
              await toggleCardCompletion(cardId);
              void loadAll();
            }}
            onOpenFinances={() => setActiveTab("finances")}
          />
        )}

        {/* ABA 3: KANBAN PIPELINE */}
        {activeTab === "kanban" && (
          <KanbanBoard
            columns={columns}
            setColumns={setColumns}
            modules={modules}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            activeModuleFilter={activeModuleFilter}
            setActiveModuleFilter={setActiveModuleFilter}
            onCardClick={(cardId) => setSelectedCardId(cardId)}
            onOpenCreateInColumn={(colId) => {
              setCreateTargetColumnId(colId);
              setShowCreateCardModal(true);
            }}
            onQuickChangeModule={async (cardId, modId) => {
              await updateCardModule(cardId, modId || null);
              void loadAll();
            }}
            onToggleComplete={async (cardId) => {
              await toggleCardCompletion(cardId);
              void loadAll();
            }}
            onReload={loadAll}
          />
        )}

        {/* ABA 4: FINANÇAS & GASTOS HUB */}
        {activeTab === "finances" && (
          <FinancesHub
            recurringTasks={recurringTasks}
            modules={modules}
            columns={columns}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onReload={loadAll}
            onToggleComplete={async (cardId) => {
              await toggleCardCompletion(cardId);
              void loadAll();
            }}
            onCardClick={(cardId) => setSelectedCardId(cardId)}
            onQuickUpdateAmount={async (taskId, amount) => {
              await quickUpdateRecurringAmount(taskId, amount);
              void loadAll();
            }}
            onSaveRecurring={async (title, amount, dueDay, modId) => {
              await createRecurringTask(title, amount, dueDay, modId);
              void loadAll();
            }}
            onDeleteRecurring={async (taskId) => {
              await deleteRecurringTask(taskId);
              void loadAll();
            }}
            onSpawnCard={async (recurringId, amount, month, year) => {
              await spawnCardFromRecurring(recurringId, amount, month, year);
              void loadAll();
            }}
          />
        )}

      </main>
    </div>
  );
}