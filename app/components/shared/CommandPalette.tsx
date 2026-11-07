"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Module } from "@prisma/client";
import {
  Search, Globe, Activity, Layout, Wallet, Plus, Receipt, Mail, Download, FileText, Layers, CornerDownLeft,
} from "lucide-react";
import type { KanbanColumn } from "../../types";

export type PaletteTab = "neural" | "dashboard" | "kanban" | "finances";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  keywords?: string;
  run: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  columns: KanbanColumn[];
  onNavigate: (tab: PaletteTab) => void;
  onNewCard: () => void;
  onNewTransaction: () => void;
  onOpenCard: (cardId: string) => void;
  onFilterModule: (moduleId: string) => void;
  onSendDigest: () => void;
  onBackup: () => void;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CommandPalette({
  isOpen, onClose, modules, columns, onNavigate, onNewCard, onNewTransaction, onOpenCard, onFilterModule, onSendDigest, onBackup,
}: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);


  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { id: "new-card", label: "Nova pendência", hint: "Pipeline", icon: <Plus size={15} />, keywords: "criar tarefa card", run: onNewCard },
      { id: "new-tx", label: "Novo lançamento", hint: "Finanças", icon: <Receipt size={15} />, keywords: "gasto despesa receita conta pagar", run: onNewTransaction },
      { id: "go-neural", label: "Ir para Visão Neural", icon: <Globe size={15} />, run: () => onNavigate("neural") },
      { id: "go-dash", label: "Ir para Analytics", icon: <Activity size={15} />, keywords: "dashboard relatorio", run: () => onNavigate("dashboard") },
      { id: "go-kanban", label: "Ir para Pipeline", icon: <Layout size={15} />, keywords: "kanban quadro", run: () => onNavigate("kanban") },
      { id: "go-fin", label: "Ir para Finanças", icon: <Wallet size={15} />, keywords: "dinheiro gastos", run: () => onNavigate("finances") },
      { id: "digest", label: "Enviar resumo do dia por e-mail", icon: <Mail size={15} />, keywords: "lembrete notificacao", run: onSendDigest },
      { id: "backup", label: "Baixar backup (JSON)", icon: <Download size={15} />, keywords: "exportar copia seguranca", run: onBackup },
      ...modules.map((m) => ({
        id: `mod-${m.id}`,
        label: `Filtrar módulo: ${m.title}`,
        icon: <Layers size={15} style={{ color: m.color }} />,
        keywords: "modulo",
        run: () => onFilterModule(m.id),
      })),
    ];

    const q = norm(query.trim());
    if (!q) return base;

    const matched = base.filter((c) => norm(`${c.label} ${c.keywords ?? ""}`).includes(q));
    const cards: Command[] = columns
      .flatMap((col) => col.cards.map((card) => ({ card, col })))
      .filter(({ card }) => norm(`${card.title} ${card.description ?? ""}`).includes(q))
      .slice(0, 8)
      .map(({ card, col }) => ({
        id: `card-${card.id}`,
        label: card.title,
        hint: col.title,
        icon: <FileText size={15} className={card.completed ? "text-emerald-500" : "text-blue-400"} />,
        run: () => onOpenCard(card.id),
      }));
    return [...matched, ...cards];
  }, [query, modules, columns, onNavigate, onNewCard, onNewTransaction, onOpenCard, onFilterModule, onSendDigest, onBackup]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!isOpen) return null;

  function exec(c: Command | undefined) {
    if (!c) return;
    onClose();
    c.run();
  }

  return (
    <div className="fixed inset-0 z-80 flex items-start justify-center bg-black/70 backdrop-blur-sm p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4 sm:pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0a0f1d] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 border-b border-slate-800">
          <Search size={16} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, commands.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); exec(commands[active]); }
              else if (e.key === "Escape") onClose();
            }}
            placeholder="Buscar pendência ou ação…"
            className="flex-1 bg-transparent py-4 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <kbd className="text-[10px] font-mono text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {commands.length === 0 ? (
            <p className="text-center text-xs text-slate-500 font-mono py-8">Nada encontrado.</p>
          ) : (
            commands.map((c, i) => (
              <button
                key={c.id}
                data-idx={i}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => exec(c)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm cursor-pointer ${
                  i === active ? "bg-slate-800 text-white" : "text-slate-300"
                }`}
              >
                <span className="text-slate-400 shrink-0">{c.icon}</span>
                <span className="flex-1 truncate">{c.label}</span>
                {c.hint && <span className="text-[10px] font-mono text-slate-500 truncate max-w-32">{c.hint}</span>}
                {i === active && <CornerDownLeft size={12} className="text-slate-500 shrink-0" />}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-[10px] font-mono text-slate-500">
          <span>↑↓ navegar · ↵ abrir</span>
          <span>Ctrl/⌘ + K</span>
        </div>
      </div>
    </div>
  );
}
