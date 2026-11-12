"use client";

import type { Module } from "@prisma/client";
import { 
  Globe, Activity, Layout, Wallet, Sun, 
  Plus, Pencil, Trash2, LogOut, X, Search
} from "lucide-react";

interface SidebarProps {
  activeTab: "today" | "neural" | "dashboard" | "kanban" | "finances";
  setActiveTab: (tab: "today" | "neural" | "dashboard" | "kanban" | "finances") => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  modules: Module[];
  activeModuleFilter: string;
  setActiveModuleFilter: (modId: string) => void;
  onOpenModuleModal: (mod?: Module) => void;
  onDeleteModule: (id: string) => void;
  onLogout: () => void;
  onOpenPalette?: () => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  modules,
  activeModuleFilter,
  setActiveModuleFilter,
  onOpenModuleModal,
  onDeleteModule,
  onLogout,
  onOpenPalette,
}: SidebarProps) {
  return (
    <>
      {/* BACKDROP MOBILE */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ASIDE CONTAINER */}
      <aside className={`fixed inset-y-0 left-0 z-50 md:static w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col shrink-0 transition-transform duration-300 ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        {/* LOGO HEADER */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20">P</div>
            <div>
              <span className="font-bold text-base tracking-wide text-white">PENDS</span>
              <span className="text-[10px] text-blue-400 block font-mono">SYS.VER.8.2 // LIVE</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* BOTÕES DE NAVEGAÇÃO PRINCIPAL */}
        <div className="p-4 space-y-1.5 border-b border-slate-800/80 pb-6">
          <button
            type="button"
            onClick={() => { setActiveTab("today"); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "today" ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Sun size={16} className="text-amber-300" /> Hoje
          </button>
          <button 
            type="button" 
            onClick={() => { setActiveTab("neural"); setMobileMenuOpen(false); }} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "neural" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Globe size={16} className="text-cyan-400"/> Visão Neural
          </button>
          <button 
            type="button" 
            onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "dashboard" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Activity size={16}/> Analytics Dash
          </button>
          <button 
            type="button" 
            onClick={() => { setActiveTab("kanban"); setMobileMenuOpen(false); }} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "kanban" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Layout size={16}/> Pipeline (Kanban)
          </button>
          <button 
            type="button" 
            onClick={() => { setActiveTab("finances"); setMobileMenuOpen(false); }} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "finances" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Wallet size={16} className="text-emerald-400"/> Finanças & Gastos
          </button>
        </div>

        {/* MÓDULOS DE VIDA */}
        <div className="px-4 py-3 flex-1 overflow-y-auto mt-1">
          <div className="flex items-center justify-between mb-3 text-[11px] uppercase font-bold text-slate-400 font-mono">
            <span>Módulos de Vida</span>
            <button 
              type="button" 
              onClick={() => onOpenModuleModal()} 
              className="p-1 hover:bg-blue-600/20 rounded text-blue-400 transition-colors cursor-pointer"
              title="Criar novo módulo"
            >
              <Plus size={15}/>
            </button>
          </div>
          <div className="space-y-1.5">
            {modules.map((m) => (
              <div 
                key={m.id} 
                onClick={() => { setActiveTab("kanban"); setActiveModuleFilter(m.id); setMobileMenuOpen(false); }} 
                className={`group flex items-center justify-between px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all ${
                  activeTab === "kanban" && activeModuleFilter === m.id ? "bg-slate-800/90 text-white shadow-md" : "bg-[#0f172a] border-slate-800/80 hover:border-slate-700 text-slate-300"
                }`} 
                style={{ borderLeftColor: m.color, borderLeftWidth: "3px" }}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate font-medium">{m.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button 
                    type="button" 
                    onClick={() => onOpenModuleModal(m)} 
                    className="p-1 text-slate-400 hover:text-blue-400 rounded cursor-pointer"
                    title="Editar módulo"
                  >
                    <Pencil size={12}/>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => onDeleteModule(m.id)} 
                    className="p-1 text-slate-400 hover:text-red-400 rounded cursor-pointer"
                    title="Excluir módulo"
                  >
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {onOpenPalette && (
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); onOpenPalette(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-800 bg-[#070a12] text-xs text-slate-400 hover:text-white hover:border-slate-600 cursor-pointer"
            >
              <span className="flex items-center gap-2"><Search size={13} /> Buscar / ações</span>
              <kbd className="text-[10px] font-mono border border-slate-700 rounded px-1.5">Ctrl K</kbd>
            </button>
          </div>
        )}

        {/* PERFIL DO USUÁRIO & SAÍDA */}
        <div className="p-4 border-t border-slate-800/80 bg-[#070a12] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-950 border border-blue-800 flex items-center justify-center font-bold text-xs text-blue-300 font-mono">NP</div>
            <div className="text-xs">
              <div className="font-bold text-slate-200">Nicolas</div>
              <div className="text-slate-500 truncate w-32 font-mono text-[10px]">sessão ativa</div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onLogout} 
            className="text-slate-500 hover:text-red-400 cursor-pointer p-1" 
            title="Encerrar Sessão"
          >
            <LogOut size={16}/>
          </button>
        </div>
      </aside>
    </>
  );
}