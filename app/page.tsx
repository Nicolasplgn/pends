"use client";

import { useCallback, useEffect, useState } from "react";
import type { Module } from "@prisma/client";
import { Menu } from "lucide-react";

import { 
  getModules, getBoardData, getDashboardStats,
  createModule, updateModule, deleteModule,
  toggleCardCompletion, updateCardModule,
  createCard, getFinanceSnapshot, exportBackup, sendDigestNow,
  checkAuthSession, logoutAction
} from "./actions";

import type { KanbanColumn, DashboardStats, FinanceSnapshot } from "./types";

import { LoginScreen } from "./components/auth/LoginScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { NeuralView } from "./components/neural/NeuralView";
import { AnalyticsDash } from "./components/analytics/AnalyticsDash";
import { KanbanBoard } from "./components/pipeline/KanbanBoard";
import { FinancesHub } from "./components/finances/FinancesHub";

import { CardDetailModal } from "./components/shared/CardDetailModal";
import { ModuleModal } from "./components/shared/ModuleModal";
import { CreateCardModal } from "./components/shared/CreateCardModal";
import { CommandPalette } from "./components/shared/CommandPalette";

export default function PendsApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"neural" | "dashboard" | "kanban" | "finances">("neural");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [modules, setModules] = useState<Module[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [financeSnap, setFinanceSnap] = useState<FinanceSnapshot | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newTxSignal, setNewTxSignal] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const [activeModuleFilter, setActiveModuleFilter] = useState<string>("all");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [createTargetColumnId, setCreateTargetColumnId] = useState<string>("");
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  const loadAll = useCallback(async () => {
    // Finanças carregam dentro do próprio Hub (getFinanceOverview)
    try {
      const [mods, board, dash] = await Promise.all([getModules(), getBoardData(), getDashboardStats()]);
      setModules(mods);
      if (board?.columns) setColumns(board.columns);
      setStats(dash);
    } catch (err) {
      // Sessão inválida/expirada → volta para o login
      if (!(await checkAuthSession())) setIsAuthenticated(false);
      else console.error("Erro ao carregar dados:", err);
    }
  }, []);

  // PWA: registra o service worker (instalável no celular)
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    checkAuthSession().then((isAuth) => {
      if (isAuth) {
        setIsAuthenticated(true);
        void loadAll();
      }
    });
  }, [loadAll]);

  // Resumo financeiro para Analytics e Neural (segue o mês selecionado)
  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    getFinanceSnapshot(selectedYear, selectedMonth)
      .then((snap) => { if (alive) setFinanceSnap(snap); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isAuthenticated, selectedYear, selectedMonth, activeTab]);

  // Ctrl/⌘ + K abre a paleta de comandos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  async function handleBackup() {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pends-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFlash("Backup baixado");
  }

  async function handleSendDigest() {
    setFlash("Enviando resumo…");
    const res = await sendDigestNow();
    if (!res.ok) setFlash(`Falha no envio: ${"error" in res ? res.error : "erro"}`);
    else if ("simulated" in res && res.simulated) setFlash("Sem RESEND_API_KEY: e-mail simulado no log do servidor");
    else setFlash("Resumo enviado para o seu e-mail");
  }

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

  if (!isAuthenticated) return <LoginScreen onLogin={() => { setIsAuthenticated(true); void loadAll(); }} />;

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

      {paletteOpen && <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        modules={modules}
        columns={columns}
        onNavigate={(tab) => setActiveTab(tab)}
        onNewCard={() => {
          const first = columns.find((c) => !c.isDone) ?? columns[0];
          if (!first) return;
          setCreateTargetColumnId(first.id);
          setShowCreateCardModal(true);
        }}
        onNewTransaction={() => {
          setActiveTab("finances");
          setNewTxSignal(Date.now());
        }}
        onOpenCard={(id) => setSelectedCardId(id)}
        onFilterModule={(id) => {
          setActiveModuleFilter(id);
          setActiveTab("kanban");
        }}
        onSendDigest={() => void handleSendDigest()}
        onBackup={() => void handleBackup()}
      />}

      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-90 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white shadow-2xl font-mono">
          {flash}
        </div>
      )}

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
        onOpenPalette={() => setPaletteOpen(true)}
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
            moduleSpend={financeSnap?.moduleSpend} 
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
            finance={financeSnap}
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
            newTxSignal={newTxSignal}
          />
        )}
      </main>
    </div>
  );
}