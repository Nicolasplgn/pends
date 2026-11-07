"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2, Circle, Pencil, Trash2, Kanban, Repeat, Layers, CreditCard, Zap, Barcode, Wallet, ExternalLink,
} from "lucide-react";
import type { FinanceTx } from "../../types";
import { PAY_METHOD_LABEL } from "../../types";
import { brl, daysUntil, dueLabel, fmtDate } from "./format";

export function Panel({
  title, icon, right, children, className = "",
}: { title?: ReactNode; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-[#0a0f1d] ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800/80">
          <h3 className="flex items-center gap-2 text-[11px] font-bold text-white uppercase tracking-wider font-mono">
            {icon}
            {title}
          </h3>
          {right}
        </header>
      )}
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

export function MethodIcon({ method, size = 11 }: { method: string; size?: number }) {
  if (method === "CREDIT_CARD") return <CreditCard size={size} className="text-amber-400" />;
  if (method === "PIX") return <Zap size={size} className="text-cyan-400" />;
  if (method === "DEBIT") return <Wallet size={size} className="text-violet-400" />;
  return <Barcode size={size} className="text-slate-400" />;
}

export function Bar({ value, max, color, over }: { value: number; max: number; color: string; over?: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${over ? "animate-pulse" : ""}`}
        style={{ width: `${pct}%`, backgroundColor: over ? "#f43f5e" : color }}
      />
    </div>
  );
}

interface TxRowProps {
  tx: FinanceTx;
  moduleColor?: string;
  showYear?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onKanban: () => void;
  onOpenCard?: (cardId: string) => void;
}

export function TxRow({
  tx, moduleColor = "#64748b", showYear, selected, onSelect, onToggle, onEdit, onDelete, onKanban, onOpenCard,
}: TxRowProps) {
  const income = tx.type === "INCOME";
  const diff = daysUntil(tx.dueDate);
  // Entrada não "atrasa": só conta pagar tem alerta de vencimento
  const overdue = !income && !tx.paid && diff < 0;
  const soon = !income && !tx.paid && diff >= 0 && diff <= 3;

  return (
    <div
      className={`group flex items-center gap-2 sm:gap-2.5 px-2 sm:px-2.5 py-2.5 sm:py-2 rounded-xl border transition-colors ${
        selected
          ? "border-blue-500/60 bg-blue-500/5"
          : overdue
            ? "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50"
            : "border-transparent hover:border-slate-800 hover:bg-[#050811]"
      }`}
    >
      {onSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onSelect}
          className="accent-blue-500 w-3.5 h-3.5 shrink-0 cursor-pointer"
          aria-label="Selecionar lançamento"
        />
      )}

      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 cursor-pointer p-1 -m-1"
        title={tx.paid ? (income ? "Marcar como não recebido" : "Marcar como não pago") : income ? "Marcar como recebido" : "Marcar como pago"}
      >
        {tx.paid ? (
          <CheckCircle2 size={18} className="text-emerald-400" />
        ) : (
          <Circle size={18} className={overdue ? "text-rose-400" : income ? "text-emerald-700 hover:text-emerald-400" : "text-slate-600 hover:text-emerald-400"} />
        )}
      </button>

      <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: moduleColor }} />

      <div className="flex-1 min-w-0" onClick={onEdit} role="button">
        <p className={`text-[13px] font-semibold truncate cursor-pointer ${tx.paid && !income ? "text-slate-500 line-through" : "text-slate-100"}`}>
          {tx.description}
        </p>
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <MethodIcon method={tx.paymentMethod} /> {PAY_METHOD_LABEL[tx.paymentMethod] ?? tx.paymentMethod}
          </span>
          <span className="truncate max-w-28">{tx.category}</span>
          {tx.isInstallment && (
            <span className="flex items-center gap-0.5 text-violet-400">
              <Layers size={10} /> {tx.installmentCurrent}/{tx.installmentTotal}
            </span>
          )}
          {tx.recurringTaskId && (
            <span className="flex items-center gap-0.5 text-sky-400">
              <Repeat size={10} /> fixa
            </span>
          )}
          {tx.card && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenCard?.(tx.card!.id); }}
              className="flex items-center gap-0.5 text-blue-400 hover:underline cursor-pointer"
              title={`Card: ${tx.card.title}`}
            >
              <Kanban size={10} /> {tx.card.column?.isDone ? "card concluído" : tx.card.column?.title ?? "card"}
            </button>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-[13px] font-bold font-mono ${income ? "text-emerald-400" : tx.paid ? "text-slate-500" : "text-slate-100"}`}>
          {income ? "+" : "−"} {brl(tx.amount)}
        </p>
        <p
          className={`text-[10px] font-mono ${
            tx.paid ? "text-emerald-600" : overdue ? "text-rose-400 font-bold" : soon ? "text-amber-400" : "text-slate-500"
          }`}
        >
          {income
            ? `${tx.paid ? "recebido" : "previsto"} · ${fmtDate(tx.dueDate, showYear)}`
            : tx.paid
              ? `pago · ${fmtDate(tx.dueDate, showYear)}`
              : `${fmtDate(tx.dueDate, showYear)} · ${dueLabel(tx.dueDate)}`}
        </p>
      </div>

      {/* No celular as ações ficam dentro do modal (toque na linha) */}
      <div className="hidden sm:flex items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {!tx.card && (
          <IconBtn title="Criar pendência no Kanban" onClick={onKanban}>
            <Kanban size={13} />
          </IconBtn>
        )}
        {tx.card && onOpenCard && (
          <IconBtn title="Abrir card" onClick={() => onOpenCard(tx.card!.id)}>
            <ExternalLink size={13} />
          </IconBtn>
        )}
        <IconBtn title="Editar" onClick={onEdit}>
          <Pencil size={13} />
        </IconBtn>
        <IconBtn title="Excluir" onClick={onDelete} danger>
          <Trash2 size={13} />
        </IconBtn>
      </div>
    </div>
  );
}

export function IconBtn({
  children, onClick, title, danger,
}: { children: ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded-lg text-slate-500 cursor-pointer transition-colors hover:bg-slate-800 ${
        danger ? "hover:text-rose-400" : "hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-xs text-slate-500 font-mono">{children}</div>;
}
