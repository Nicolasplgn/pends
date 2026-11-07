"use client";

import { useCallback, useEffect, useState } from "react";
import type { Module } from "@prisma/client";
import { Menu } from "lucide-react";

import { 
  getModules, getBoardData, getDashboardStats,
  createModule, updateModule, deleteModule,
  toggleCardCompletion, updateCardModule,
  createCard,
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

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [activeModuleFilter, setActiveModuleFilter] = useState<string>("all");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [createTargetColumnId, setCreateTargetColumnId] = useState<string>("");
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  const loadAll = useCallback(async () => {
    // Finanças carregam dentro do próprio Hub (getFinanceOverview)
    const [mods, board, dash] = await Promise.all([getModules(), getBoardData(), getDashboardStats()]);
    setModules(mods);
    if (board?.columns) setColumns(board.columns);
    setStats(dash);
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
      
      <CardDetailModal 
        cardId={selectedCardId} 
        isOpen={!!selectedCardId} 
        onClose={() => setSelectedCardId(null)} 
        modules={modules}
        onReload={loadAll}
      />

      <ModuleModal
        isOpen={showModuleModal}
        onClose={() => setShowModuleModal(false)}
        editingModule={editingModule}
        onSave={handleSaveModule}
      />

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

      <main className="flex-1 flex flex-col overflow-hidden bg-[#050811] relative">
        <div className="md:hidden flex items-center justify-between p-4 bg-[#0a0f1d] border-b border-slate-800 z-30 shrink-0">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white">
            <Menu size={20} />
          </button>
          <span className="font-bold text-sm uppercase tracking-wider font-mono text-white">
            {activeTab === "neural" ? "Visão Neural" : activeTab === "dashboard" ? "Analytics" : activeTab === "kanban" ? "Pipeline" : "Finanças & Gastos"}
          </span>
          <div className="w-8" />
        </div>

        {activeTab === "neural" && (
          <NeuralView 
            modules={modules} 
            columns={columns} 
            onSelectModule={(modId: string) => { setActiveModuleFilter(modId); setActiveTab("kanban"); }}
            onToggleComplete={async (cardId) => { await toggleCardCompletion(cardId); void loadAll(); }}
            onCardClick={(cardId) => setSelectedCardId(cardId)}
          />
        )}

        {activeTab === "dashboard" && (
          <AnalyticsDash
            stats={stats}
            modules={modules}
            columns={columns}
            recurringTasks={[]} // Retirado do antigo sistema, analytics foca no Work OS
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onSelectMonthYear={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
            onToggleComplete={async (cardId) => { await toggleCardCompletion(cardId); void loadAll(); }}
            onOpenFinances={() => setActiveTab("finances")}
          />
        )}

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
            onOpenCreateInColumn={(colId) => { setCreateTargetColumnId(colId); setShowCreateCardModal(true); }}
            onQuickChangeModule={async (cardId, modId) => { await updateCardModule(cardId, modId || null); void loadAll(); }}
            onToggleComplete={async (cardId) => { await toggleCardCompletion(cardId); void loadAll(); }}
            onReload={loadAll}
          />
        )}

        {activeTab === "finances" && (
          <FinancesHub
            modules={modules}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onSelectMonthYear={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
            onOpenCard={(cardId) => setSelectedCardId(cardId)}
            onExternalChange={() => void loadAll()}
          />
        )}
      </main>
    </div>
  );
}