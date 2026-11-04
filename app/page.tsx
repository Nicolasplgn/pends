"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Module } from "@prisma/client";
import { 
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, 
  useSensor, useSensors, PointerSensor, useDroppable 
} from "@dnd-kit/core";
import { 
  SortableContext, verticalListSortingStrategy, useSortable 
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Layout, Plus, Calendar, Activity, 
  Clock, AlertTriangle, Layers, LogOut,
  Pencil, Trash2, TrendingUp, Globe, X,
  AlignLeft, MessageSquare, Send, Cpu, ArrowRight,
  ChevronRight, ChevronLeft, CheckCircle2, Circle, CheckCheck,
  Wallet, Receipt, ArrowDownToLine, Zap, AlertCircle, Filter,
  Flame, FileText, History, Menu, BarChart3, PieChart, Check, Eye,
  Sparkles, CheckSquare, ArrowUpRight, Download, Printer, Copy,
  FileSpreadsheet, ShieldAlert, Award
} from "lucide-react";
import { 
  getBoardData, createCard, moveCard, deleteCard,
  getModules, createModule, updateModule, deleteModule, 
  getDashboardStats, createColumn, updateColumn, deleteColumn,
  getCardDetails, updateCardDetails, addComment, updateCardModule,
  toggleCardCompletion,
  getRecurringTasks, createRecurringTask, updateRecurringTask, deleteRecurringTask, spawnCardFromRecurring,
  quickUpdateRecurringAmount,
  loginAction, checkAuthSession, logoutAction
} from "./actions";

type BoardData = NonNullable<Awaited<ReturnType<typeof getBoardData>>>;
type KanbanColumn = BoardData["columns"][number];
type KanbanCardData = KanbanColumn["cards"][number];
type CardDetails = NonNullable<Awaited<ReturnType<typeof getCardDetails>>>;
type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
type NeuralCard = KanbanCardData & { columnTitle: string };
type NeuralNode = Module & {
  x: number;
  y: number;
  cards: NeuralCard[];
  total: number;
  completed: number;
  percent: number;
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function isCardOverdue(dueDate: Date | string | null | undefined, isCompleted?: boolean): boolean {
  if (!dueDate || isCompleted) return false;
  const d = new Date(dueDate);
  const now = new Date();
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);
  return now > endOfDay;
}

function getTaskOverallStatus(task: any) {
  const cards = task.cards ?? [];
  if (cards.length === 0) {
    return {
      type: "none",
      label: "Sem Lançamento",
      color: "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700",
    };
  }

  const overdueCard = cards.find((c: any) => isCardOverdue(c.dueDate, c.completed || c.column?.isDone));
  if (overdueCard) {
    return {
      type: "overdue",
      label: "⚠️ Vencida",
      color: "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse hover:bg-red-500/30",
    };
  }

  const activeCard = cards.find((c: any) => !c.completed && !c.column?.isDone);
  if (activeCard) {
    return {
      type: "active",
      label: "⏳ Lançado no Kanban",
      color: "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30",
    };
  }

  return {
    type: "completed",
    label: "✓ Concluída",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30",
  };
}

// --- TELA DE LOGIN SEGURA ---
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginAction(email, password);
      if (res.success) {
        onLogin();
      } else {
        setError(res.error || "Credenciais inválidas.");
      }
    } catch {
      setError("Erro ao autenticar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050811] font-mono text-slate-200 p-4">
      <div className="bg-[#0b101d] border border-blue-900/40 p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-600/15 rounded-full blur-2xl" />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black tracking-wider shadow-lg shadow-blue-500/20">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-sans">PENDS // HUB</h1>
            <span className="text-[10px] text-blue-400 font-mono">SYS.VER.8.2 // SECURE_AUTH</span>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-xl text-xs mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <div>
            <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">E-mail</label>
            <input 
              type="email" 
              required
              className="w-full bg-[#070a12] border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition-all"
              placeholder="seu-email@dominio.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Senha</label>
            <input 
              type="password" 
              required
              className="w-full bg-[#070a12] border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            {loading ? "Verificando..." : "Acessar Sistema"}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- CARD KANBAN ---
function KanbanCard({ 
  card, 
  onClick, 
  onNextStage, 
  modules, 
  onChangeModule,
  onToggleComplete
}: { 
  card: KanbanCardData; 
  onClick?: () => void;
  onNextStage?: () => void;
  modules: Module[];
  onChangeModule?: (moduleId: string) => void;
  onToggleComplete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.2 : 1 };

  const overdue = isCardOverdue(card.dueDate, card.completed);

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={() => {
        if (!isDragging && onClick) onClick();
      }}
      className={`p-3.5 mb-2.5 rounded-2xl border cursor-grab hover:shadow-xl transition-all relative group ${
        card.completed 
          ? "bg-[#0b1424] border-emerald-500/40 opacity-75" 
          : overdue
            ? "bg-[#180d12] border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30"
            : "bg-[#121829] border-slate-800/80 hover:border-slate-600"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleComplete) onToggleComplete();
            }}
            className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
            title={card.completed ? "Reabrir pendência" : "Marcar como concluída"}
          >
            {card.completed ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : (
              <Circle size={16} className={overdue ? "text-red-400" : ""} />
            )}
          </button>

          <div className="relative" onClick={e => e.stopPropagation()}>
            <select
              value={card.moduleId || ""}
              onChange={e => onChangeModule && onChangeModule(e.target.value)}
              className="text-[10px] font-bold px-2 py-0.5 rounded shadow-sm bg-transparent outline-none cursor-pointer appearance-none pr-3"
              style={{ 
                backgroundColor: card.module ? `${card.module.color}25` : "#1e293b", 
                color: card.module ? card.module.color : "#94a3b8", 
                border: card.module ? `1px solid ${card.module.color}40` : "1px solid #334155" 
              }}
            >
              {modules.map(m => (
                <option key={m.id} value={m.id} className="bg-[#0f172a] text-white">
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {overdue && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
              <AlertTriangle size={10} /> Vencida
            </span>
          )}

          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
            card.completed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
            card.priority === 'Urgente' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
            card.priority === 'Alta' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            'bg-slate-800 text-slate-400'
          }`}>
            {card.completed ? "Concluído" : card.priority}
          </span>
        </div>
      </div>

      <h4 className={`font-semibold text-sm mb-1 leading-snug line-clamp-2 ${
        card.completed ? "line-through text-slate-400" : overdue ? "text-red-200" : "text-slate-200"
      }`}>
        {card.title}
      </h4>

      {card.description && (
        <p className="text-xs text-slate-400 line-clamp-1 mb-2 font-sans">{card.description}</p>
      )}

      <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 mt-2">
        {card.dueDate ? (
          <div className={`text-[10px] flex items-center gap-1.5 font-mono ${
            overdue ? "text-red-400 font-bold" : "text-slate-500"
          }`}>
            <Calendar size={11} className={overdue ? "text-red-400" : "text-blue-400"}/> 
            {overdue ? `Venceu em ${new Date(card.dueDate).toLocaleDateString('pt-BR')}` : new Date(card.dueDate).toLocaleDateString('pt-BR')}
          </div>
        ) : (
          <span className="text-[10px] text-slate-600 font-mono">Sem prazo</span>
        )}

        {onNextStage && !card.completed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNextStage();
            }}
            className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 hover:text-blue-400 bg-slate-800/60 hover:bg-slate-800 px-2 py-0.5 rounded cursor-pointer transition-colors"
          >
            <span>Avançar</span>
            <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// --- COLUNA DROPPABLE ---
function KanbanColumnDroppable({
  col,
  cards,
  onEdit,
  onDelete,
  onAddCard,
  onCardClick,
  modules,
  onNextStage,
  onChangeModule,
  onToggleComplete
}: {
  col: KanbanColumn;
  cards: KanbanCardData[];
  onEdit: () => void;
  onDelete: () => void;
  onAddCard: () => void;
  onCardClick: (cardId: string) => void;
  modules: Module[];
  onNextStage: (cardId: string) => void;
  onChangeModule: (cardId: string, modId: string) => void;
  onToggleComplete: (cardId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div 
      ref={setNodeRef}
      className={`w-80 shrink-0 bg-[#0f172a] border rounded-2xl flex flex-col max-h-full shadow-2xl transition-all duration-200 ${
        isOver 
          ? "border-blue-500 bg-[#0f1b35] ring-2 ring-blue-500/40" 
          : col.isDone 
            ? "border-emerald-800/60 bg-[#0b1424]/40" 
            : "border-slate-800"
      }`}
    >
      <div className="p-3.5 font-bold text-xs uppercase tracking-wider text-slate-400 font-mono flex justify-between items-center border-b border-slate-800/80 group">
        <div className="flex items-center gap-2">
          <span>{col.title}</span>
          {col.isDone && (
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1">
              <CheckCheck size={10} /> FINAL
            </span>
          )}
          <span className="bg-slate-800 text-blue-400 px-2 py-0.5 rounded text-[11px] font-mono">
            {cards.length}
          </span>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={onEdit} className="p-1 hover:text-blue-400 text-slate-500 rounded cursor-pointer"><Pencil size={12}/></button>
          <button type="button" onClick={onDelete} className="p-1 hover:text-red-400 text-slate-500 rounded cursor-pointer"><Trash2 size={12}/></button>
        </div>
      </div>

      <div className="p-2.5 overflow-y-auto flex-1 min-h-37.5">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard 
              key={card.id} 
              card={card} 
              onClick={() => onCardClick(card.id)}
              modules={modules}
              onNextStage={() => onNextStage(card.id)}
              onChangeModule={(modId) => onChangeModule(card.id, modId)}
              onToggleComplete={() => onToggleComplete(card.id)}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div className={`text-center py-12 text-xs font-mono rounded-xl border-2 border-dashed m-1 transition-colors ${
            isOver ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-slate-800/60 text-slate-600"
          }`}>
            {isOver ? "Solte para mover aqui" : "Nenhuma pendência aqui"}
          </div>
        )}
      </div>

      <div className="p-2.5 border-t border-slate-800/60 bg-[#0a0f1d]/50 rounded-b-2xl">
        <button 
          type="button"
          onClick={onAddCard}
          className="w-full py-2 px-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus size={14}/> Adicionar Pendência
        </button>
      </div>
    </div>
  );
}

// --- FICHA DETALHADA DO CARD ---
function CardDetailModal({ cardId, isOpen, onClose, modules, onReload }: {
  cardId: string | null;
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  onReload: () => void;
}) {
  const [data, setData] = useState<CardDetails | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [dueDate, setDueDate] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (!isOpen || !cardId) return;
    let cancelled = false;

    getCardDetails(cardId).then(card => {
      if (cancelled || !card) return;
      setData(card);
      setTitle(card.title);
      setDesc(card.description || "");
      setPriority(card.priority);
      setDueDate(card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : "");
      setModuleId(card.moduleId || "");
      setLoadedFor(cardId);
    });

    return () => { cancelled = true; };
  }, [isOpen, cardId]);

  const loading = !cardId || loadedFor !== cardId;

  async function handleSave(overrides?: { title?: string; desc?: string; priority?: string; dueDate?: string; moduleId?: string; }) {
    if (!cardId) return;
    await updateCardDetails(
      cardId,
      overrides?.title ?? title,
      overrides?.desc ?? desc,
      overrides?.priority ?? priority,
      overrides?.dueDate ?? dueDate,
      overrides?.moduleId ?? moduleId
    );
    onReload();
  }

  async function handleAddComment() {
    if (!cardId || !commentText.trim()) return;
    await addComment(cardId, commentText);
    setCommentText("");
    const updated = await getCardDetails(cardId);
    setData(updated);
  }

  async function handleDelete() {
    if (!cardId) return;
    if (confirm("Deseja realmente apagar esta pendência?")) {
      await deleteCard(cardId);
      onClose();
      onReload();
    }
  }

  if (!isOpen) return null;

  const overdue = isCardOverdue(data?.dueDate, data?.completed);

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f172a] border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#0a0f1d]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-1 rounded">
              FICHA #{cardId?.substring(0, 6)}
            </span>
            <span className="text-xs text-slate-500 font-mono">Etapa: {data?.column?.title}</span>
            {data?.completed ? (
              <span className="text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                ✓ Concluída
              </span>
            ) : overdue ? (
              <span className="text-[10px] font-mono uppercase bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle size={11} /> Vencida
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleDelete} className="p-2 text-slate-500 hover:text-red-400 rounded cursor-pointer"><Trash2 size={16}/></button>
            <button type="button" onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded cursor-pointer"><X size={18}/></button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono">Carregando detalhes...</div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Título da Pendência</label>
              <input 
                className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-base font-semibold text-white outline-none focus:border-blue-500"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => { void handleSave(); }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Módulo</label>
                <select 
                  className="w-full bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white outline-none cursor-pointer"
                  value={moduleId}
                  onChange={e => { const val = e.target.value; setModuleId(val); void handleSave({ moduleId: val }); }}
                >
                  <option value="">Sem Módulo</option>
                  {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Prioridade</label>
                <select 
                  className="w-full bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white outline-none cursor-pointer"
                  value={priority}
                  onChange={e => { const val = e.target.value; setPriority(val); void handleSave({ priority: val }); }}
                >
                  <option>Baixa</option>
                  <option>Normal</option>
                  <option>Alta</option>
                  <option>Urgente</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Prazo / Vencimento</label>
                <input 
                  type="date"
                  className={`w-full bg-[#070a12] border p-2 rounded-xl text-xs font-mono outline-none ${
                    overdue ? "border-red-500 text-red-400 font-bold" : "border-slate-800 text-white"
                  }`}
                  value={dueDate}
                  onChange={e => { const val = e.target.value; setDueDate(val); void handleSave({ dueDate: val }); }}
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5 mb-1.5">
                <AlignLeft size={14} className="text-blue-400"/> Descrição e Informações Adicionais
              </label>
              <textarea 
                rows={4}
                className="w-full bg-[#070a12] border border-slate-800 p-3 rounded-xl text-xs leading-relaxed text-slate-200 outline-none focus:border-blue-500 resize-none"
                placeholder="Insira detalhes..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onBlur={() => { void handleSave(); }}
              />
            </div>

            <div className="border-t border-slate-800/80 pt-4">
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5 mb-3">
                <MessageSquare size={14} className="text-emerald-400"/> Observações / Histórico
              </label>
              
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {(data?.comments ?? []).map((c) => (
                  <div key={c.id} className="p-2.5 bg-[#070a12] border border-slate-800/80 rounded-xl text-xs">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span className="font-bold text-blue-400">{c.user}</span>
                      <span>{new Date(c.createdAt).toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <p className="text-slate-300">{c.text}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input 
                  className="flex-1 bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                  placeholder="Escrever uma observação..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void handleAddComment(); }}
                />
                <button type="button" onClick={() => { void handleAddComment(); }} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl cursor-pointer">
                  <Send size={15}/>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// --- VISÃO NEURAL HÍBRIDA (REDE ORBITAL + PAINEL MODULAR + BOTTOM SHEET) ---
function NeuralNetworkView({ modules, columns, onSelectModule, onToggleComplete }: {
  modules: Module[];
  columns: KanbanColumn[];
  onSelectModule: (modId: string) => void;
  onToggleComplete: (cardId: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"orbit" | "grid">("orbit");
  const [selectedModule, setSelectedModule] = useState<NeuralNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NeuralNode | null>(null);
  const [activeHudTab, setActiveHudTab] = useState<"urgent" | "deadlines" | "notes" | "all">("urgent");

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
  const completedAllTasks = columns.reduce((acc: number, c) => acc + c.cards.filter(card => card.completed).length, 0);
  const globalCompletionRate = totalAllTasks > 0 ? Math.round((completedAllTasks / totalAllTasks) * 100) : 0;

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
      const completed = cards.filter(c => c.completed).length;
      return {
        ...m,
        x,
        y,
        cards,
        total: cards.length,
        completed,
        percent: cards.length > 0 ? Math.round((completed / cards.length) * 100) : 0
      };
    });
  }, [modules, moduleCardsMap]);

  const hudPosition = useMemo(() => {
    if (!hoveredNode) return null;
    const { x, y } = hoveredNode;
    const isLeft = x <= 360;
    const posX = isLeft ? x + 72 : x - 72;
    const transformX = isLeft ? "0%" : "-100%";

    let transformY = "-50%";
    if (y < 240) transformY = "-15%";
    else if (y > 480) transformY = "-82%";

    return {
      left: posX,
      top: y,
      transform: `translate(${transformX}, ${transformY})`
    };
  }, [hoveredNode]);

  const allUrgentCards = useMemo(() => {
    const list: NeuralCard[] = [];
    columns.forEach(col => {
      col.cards.forEach(card => {
        if (!card.completed && (card.priority === "Urgente" || card.priority === "Alta")) {
          list.push({ ...card, columnTitle: col.title });
        }
      });
    });
    return list;
  }, [columns]);

  const allOverdueCards = useMemo(() => {
    const list: NeuralCard[] = [];
    columns.forEach(col => {
      col.cards.forEach(card => {
        if (!card.completed && isCardOverdue(card.dueDate)) {
          list.push({ ...card, columnTitle: col.title });
        }
      });
    });
    return list;
  }, [columns]);

  const urgentCards = useMemo(() => {
    if (!selectedModule) return [];
    return selectedModule.cards.filter(c => !c.completed && (c.priority === 'Urgente' || c.priority === 'Alta'));
  }, [selectedModule]);

  const overdueAndUpcoming = useMemo(() => {
    if (!selectedModule) return [];
    return selectedModule.cards.filter(c => !c.completed && c.dueDate);
  }, [selectedModule]);

  const cardsWithNotes = useMemo(() => {
    if (!selectedModule) return [];
    return selectedModule.cards.filter(c => c.description && c.description.trim().length > 0);
  }, [selectedModule]);

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

      {/* ÁREA DE EXIBIÇÃO: MODO 1 (REDE ORBITAL SINÁPTICA) */}
      {viewMode === "orbit" && (
        <div className="flex-1 relative flex items-center justify-center overflow-hidden select-none p-4 sm:p-6">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0b1120_1px,transparent_1px),linear-gradient(to_bottom,#0b1120_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

          <div className="absolute top-4 left-6 z-20 hidden sm:block">
            <p className="text-[11px] text-slate-500 font-mono">
              💡 Passe o mouse em qualquer nó para abrir o HUD ou toque para abrir a gaveta completa.
            </p>
          </div>

          <div className="relative w-180 h-180 flex items-center justify-center shrink-0 scale-75 sm:scale-100">
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <circle cx="360" cy="360" r="230" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 8" className="opacity-60" />
              <circle cx="360" cy="360" r="140" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 6" className="opacity-40" />
              
              {moduleNodes.map(n => {
                const isHovered = hoveredNode?.id === n.id;
                return (
                  <g key={n.id}>
                    <line 
                      x1="360" 
                      y1="360" 
                      x2={n.x} 
                      y2={n.y} 
                      stroke={n.color} 
                      strokeWidth={isHovered ? "3" : "1.5"} 
                      strokeOpacity={isHovered ? "0.9" : "0.35"} 
                      strokeDasharray={isHovered ? "0" : "6 4"}
                      className="transition-all duration-300" 
                    />
                    <circle cx={n.x} cy={n.y} r="28" fill={n.color} fillOpacity={isHovered ? "0.2" : "0.08"} />
                  </g>
                );
              })}
            </svg>

            <div className="absolute z-10 flex flex-col items-center justify-center w-44 h-44 rounded-full bg-[#0a0f1d] border-2 border-blue-500/40 shadow-[0_0_50px_rgba(37,99,235,0.25)] backdrop-blur-md cursor-default">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/50 flex items-center justify-center text-blue-400 mb-2">
                <Cpu size={26} className="animate-pulse" />
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest">NÚCLEO CENTRAL</span>
              <span className="text-3xl font-mono font-black text-white">{totalAllTasks}</span>
              <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider mt-0.5">Pendências</span>
            </div>

            {moduleNodes.map(node => {
              const isHovered = hoveredNode?.id === node.id;
              return (
                <div 
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => {
                    setSelectedModule(node);
                    setActiveHudTab("urgent");
                  }}
                  style={{ 
                    left: `${node.x}px`, 
                    top: `${node.y}px`, 
                    transform: 'translate(-50%, -50%)', 
                    borderColor: isHovered ? node.color : `${node.color}60` 
                  }}
                  className={`absolute z-20 group cursor-pointer flex flex-col items-center justify-center w-28 h-28 rounded-3xl bg-[#0f172a] border-2 shadow-2xl transition-all duration-300 ${
                    isHovered ? "scale-110 z-40 ring-4 ring-offset-2 ring-offset-black" : "hover:scale-105"
                  }`}
                >
                  <div 
                    className={`absolute inset-0 rounded-3xl blur-md transition-opacity ${
                      isHovered ? "opacity-60" : "opacity-20"
                    }`}
                    style={{ backgroundColor: node.color }}
                  />

                  <div className="w-3.5 h-3.5 rounded-full mb-1.5 shadow-sm" style={{ backgroundColor: node.color }} />
                  
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider text-center font-mono leading-tight px-1.5 line-clamp-2">
                    {node.title}
                  </span>

                  <span className="text-[10px] font-mono text-slate-400 mt-1">
                    {node.total} tarefas
                  </span>

                  <div className="w-14 bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${node.percent}%`, backgroundColor: node.color }} />
                  </div>
                </div>
              );
            })}

            {hoveredNode && !selectedModule && hudPosition && (
              <div 
                style={{
                  position: "absolute",
                  zIndex: 60,
                  left: `${hudPosition.left}px`,
                  top: `${hudPosition.top}px`,
                  transform: hudPosition.transform,
                  borderColor: `${hoveredNode.color}90`,
                  boxShadow: `0 0 35px ${hoveredNode.color}25, 0 20px 40px rgba(0,0,0,0.85)`
                }}
                className="w-80 bg-[#0c1220]/95 border-2 rounded-3xl p-4 backdrop-blur-md pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95"
              >
                <div className="flex items-center justify-between border-b border-slate-800/90 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: hoveredNode.color }} />
                    <h4 className="font-bold font-mono text-white text-xs uppercase">{hoveredNode.title}</h4>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-full">
                    {hoveredNode.percent}%
                  </span>
                </div>

                <div className="space-y-2 mb-2.5">
                  {hoveredNode.cards.slice(0, 3).map(c => {
                    const overdue = isCardOverdue(c.dueDate, c.completed);
                    return (
                      <div key={c.id} className="p-2 rounded-xl bg-[#070b14] border border-slate-800/80 text-xs">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`font-semibold line-clamp-1 flex-1 ${c.completed ? "line-through text-slate-500" : "text-slate-200"}`}>
                            {c.title}
                          </span>
                          <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded uppercase ${
                            c.completed ? "bg-emerald-950 text-emerald-400" :
                            overdue ? "bg-red-950 text-red-400 font-bold" : "bg-slate-800 text-slate-400"
                          }`}>
                            {c.completed ? "Feito" : overdue ? "Vencida" : c.priority}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {hoveredNode.cards.length === 0 && (
                    <div className="text-center py-3 text-slate-500 text-xs font-mono">Sem pendências ativas.</div>
                  )}
                </div>

                <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Toque para abrir a central</span>
                  <Eye size={12} className="text-cyan-400" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ÁREA DE EXIBIÇÃO: MODO 2 (PAINEL MODULAR COM RADAR CRÍTICO) */}
      {viewMode === "grid" && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">

            {/* HERO KPIS */}
            <div className="md:col-span-2 bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-all">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/80">
                    NÚCLEO DO SISTEMA
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {modules.length} Módulos Ativos
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">
                  Você tem {totalAllTasks} pendências mapeadas.
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-lg font-sans">
                  {allOverdueCards.length > 0 
                    ? `Atenção: ${allOverdueCards.length} tarefas estão com prazo vencido e exigem resolução.`
                    : "Todas as suas tarefas estão dentro do cronograma previsto."}
                </p>
              </div>

              <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-slate-800/80">
                <div className="bg-[#070b14]/70 p-3 rounded-2xl border border-slate-800/60">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Concluídas</span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">{completedAllTasks}</span>
                </div>
                <div className="bg-[#070b14]/70 p-3 rounded-2xl border border-slate-800/60">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">A Fazer</span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-white">{totalAllTasks - completedAllTasks}</span>
                </div>
                <div className="bg-[#070b14]/70 p-3 rounded-2xl border border-slate-800/60">
                  <span className="text-[10px] font-mono uppercase text-red-400 block mb-1">Atrasadas</span>
                  <span className={`text-xl sm:text-2xl font-bold font-mono ${allOverdueCards.length > 0 ? "text-red-400 animate-pulse" : "text-slate-500"}`}>
                    {allOverdueCards.length}
                  </span>
                </div>
              </div>
            </div>

            {/* RADAR CRÍTICO */}
            <div className="bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 shadow-xl flex flex-col justify-between group hover:border-slate-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Flame size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase font-mono">Radar Crítico</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Alta prioridade</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-full">
                    {allUrgentCards.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {allUrgentCards.slice(0, 3).map(card => (
                    <div key={card.id} className="p-2.5 rounded-xl bg-[#070b14] border border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-200">{card.title}</span>
                      <button 
                        type="button" 
                        onClick={() => onToggleComplete(card.id)}
                        className="p-1 hover:text-emerald-400 text-slate-500 cursor-pointer shrink-0"
                        title="Concluir"
                      >
                        <Circle size={15} />
                      </button>
                    </div>
                  ))}
                  {allUrgentCards.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs font-mono">Nenhuma prioridade urgente.</div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/60 mt-4 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                <span>Tempo Real</span>
                <Zap size={13} className="text-amber-400" />
              </div>
            </div>

            {/* PRAZOS */}
            <div className="bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 shadow-xl flex flex-col justify-between group hover:border-slate-700 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase font-mono">Prazos</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Controle de datas</span>
                    </div>
                  </div>
                  {allOverdueCards.length > 0 && (
                    <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950/60 border border-red-800 px-2 py-0.5 rounded-full animate-pulse">
                      ⚠️ {allOverdueCards.length} vencidas
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {allOverdueCards.slice(0, 3).map(card => (
                    <div key={card.id} className="p-2.5 rounded-xl bg-[#160b10] border border-red-500/40 flex items-center justify-between gap-2 text-xs">
                      <div className="truncate">
                        <span className="truncate font-semibold text-red-200 block">{card.title}</span>
                        <span className="text-[9px] font-mono text-red-400">
                          Venceu em {card.dueDate ? new Date(card.dueDate).toLocaleDateString('pt-BR') : ""}
                        </span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => onToggleComplete(card.id)}
                        className="p-1 hover:text-emerald-400 text-red-400 cursor-pointer shrink-0"
                        title="Concluir"
                      >
                        <Circle size={15} />
                      </button>
                    </div>
                  ))}
                  {allOverdueCards.length === 0 && (
                    <div className="text-center py-8 text-emerald-400/80 text-xs font-mono">✓ Tudo em dia! Sem atrasos.</div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/60 mt-4 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                <span>Cronograma</span>
                <Clock size={13} className="text-blue-400" />
              </div>
            </div>

            {/* CARTÕES MODULARES */}
            {moduleNodes.map((node) => {
              const hasOverdue = node.cards.some(c => isCardOverdue(c.dueDate, c.completed));
              return (
                <div 
                  key={node.id}
                  onClick={() => {
                    setSelectedModule(node);
                    setActiveHudTab("urgent");
                  }}
                  className={`bg-[#0b101f] border rounded-3xl p-5 shadow-xl flex flex-col justify-between cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden group ${
                    hasOverdue ? "border-red-500/60 ring-1 ring-red-500/30" : "border-slate-800/90 hover:border-slate-600"
                  }`}
                >
                  <div 
                    className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-20 transition-opacity group-hover:opacity-40"
                    style={{ backgroundColor: node.color }}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full shadow-md shrink-0" style={{ backgroundColor: node.color }} />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono line-clamp-1">
                          {node.title}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/70 px-2 py-0.5 rounded-full">
                        {node.percent}%
                      </span>
                    </div>

                    <div className="w-full bg-[#070b14] h-2 rounded-full overflow-hidden border border-slate-800/80 mb-4 p-0.5">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${node.percent}%`, backgroundColor: node.color }} 
                      />
                    </div>

                    <div className="space-y-2 mb-4">
                      {node.cards.slice(0, 3).map(card => {
                        const overdue = isCardOverdue(card.dueDate, card.completed);
                        return (
                          <div 
                            key={card.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                              card.completed 
                                ? "bg-[#070b14]/50 border-slate-800/60 opacity-60" 
                                : overdue 
                                  ? "bg-[#180d12] border-red-500/50" 
                                  : "bg-[#070b14] border-slate-800"
                            }`}
                          >
                            <span className={`font-semibold line-clamp-1 flex-1 ${
                              card.completed ? "line-through text-slate-500" : overdue ? "text-red-200" : "text-slate-200"
                            }`}>
                              {card.title}
                            </span>
                            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                              card.completed ? "bg-emerald-950 text-emerald-400" :
                              overdue ? "bg-red-950 text-red-400" :
                              card.priority === 'Urgente' ? 'bg-red-500/20 text-red-400' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {card.completed ? "Feito" : overdue ? "Vencida" : card.priority}
                            </span>
                          </div>
                        );
                      })}
                      {node.cards.length === 0 && (
                        <div className="text-center py-5 text-slate-600 text-xs font-mono">Nenhuma pendência ativa.</div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">
                      {node.total} tarefas • {node.completed} prontas
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
                      <span>Abrir</span>
                      <ArrowUpRight size={14} />
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      )}

      {/* BOTTOM SHEET TÁTIL */}
      {selectedModule && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedModule(null)}
        >
          <div 
            className="w-full sm:max-w-2xl bg-[#0b101f] border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.9)] max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden text-slate-200"
            style={{ borderTopColor: selectedModule.color }}
            onClick={e => e.stopPropagation()}
          >
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
            </div>

            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#070b14]/90">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: selectedModule.color }} />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <span>{selectedModule.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800">
                      {selectedModule.total} tarefas
                    </span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Conclusão: {selectedModule.percent}% • {selectedModule.completed} de {selectedModule.total} feitas
                  </span>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => setSelectedModule(null)} 
                className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50 hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#070a12] px-4 sm:px-6 py-2.5 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto shrink-0">
              <button 
                type="button"
                onClick={() => setActiveHudTab("urgent")} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
                  activeHudTab === "urgent" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Flame size={12} className="text-amber-400" />
                <span>Críticas ({urgentCards.length})</span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveHudTab("deadlines")} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
                  activeHudTab === "deadlines" ? "bg-red-500/20 text-red-300 border border-red-500/40" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Clock size={12} className="text-red-400" />
                <span>Prazos ({overdueAndUpcoming.length})</span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveHudTab("notes")} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
                  activeHudTab === "notes" ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText size={12} className="text-blue-400" />
                <span>Observações ({cardsWithNotes.length})</span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveHudTab("all")} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
                  activeHudTab === "all" ? "bg-slate-800 text-white border border-slate-700" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers size={12} />
                <span>Todas ({selectedModule.cards.length})</span>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
              {(() => {
                let displayCards: NeuralCard[] = [];
                if (activeHudTab === "urgent") displayCards = urgentCards;
                else if (activeHudTab === "deadlines") displayCards = overdueAndUpcoming;
                else if (activeHudTab === "notes") displayCards = cardsWithNotes;
                else displayCards = selectedModule.cards;

                if (displayCards.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 font-mono text-xs">
                      Nenhuma pendência encontrada nesta categoria.
                    </div>
                  );
                }

                return displayCards.map((c) => {
                  const overdue = isCardOverdue(c.dueDate, c.completed);
                  return (
                    <div 
                      key={c.id} 
                      className={`p-3.5 rounded-2xl border transition-all ${
                        c.completed 
                          ? "bg-[#080d1a] border-emerald-950/60 opacity-60" 
                          : overdue 
                            ? "bg-[#180d12] border-red-500/60" 
                            : "bg-[#0e1424] border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <button
                            type="button"
                            onClick={() => onToggleComplete(c.id)}
                            className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                          >
                            {c.completed ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Circle size={18} />}
                          </button>
                          <span className={`font-semibold text-sm truncate ${c.completed ? "line-through text-slate-500" : "text-white"}`}>
                            {c.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                          {c.columnTitle}
                        </span>
                      </div>

                      {c.description && (
                        <div className="bg-[#070a12] p-2.5 rounded-xl border border-slate-800/80 text-xs text-slate-300 font-sans mt-2 whitespace-pre-wrap leading-relaxed">
                          {c.description}
                        </div>
                      )}

                      {c.dueDate && (
                        <div className={`text-[10px] font-mono mt-2 flex items-center gap-1.5 ${
                          overdue ? "text-red-400 font-bold" : "text-slate-400"
                        }`}>
                          <Calendar size={11} className={overdue ? "text-red-400" : "text-blue-400"} />
                          <span>{overdue ? `Venceu em: ${new Date(c.dueDate).toLocaleDateString('pt-BR')}` : `Vencimento: ${new Date(c.dueDate).toLocaleDateString('pt-BR')}`}</span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            <div className="p-4 sm:p-5 bg-[#070b14] border-t border-slate-800 flex justify-between items-center shrink-0">
              <button 
                type="button"
                onClick={() => setSelectedModule(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold rounded-xl cursor-pointer"
              >
                Fechar
              </button>
              <button 
                type="button"
                onClick={() => {
                  onSelectModule(selectedModule.id);
                  setSelectedModule(null);
                }}
                className="py-2.5 px-5 rounded-xl font-bold text-xs uppercase tracking-wider font-mono text-white flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: selectedModule.color }}
              >
                <span>Acessar Pipeline</span>
                <ArrowRight size={15} />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// --- MODAL DE RELATÓRIO EXECUTIVO OFICIAL (100% TIPADO SEM ERROS) ---
function ExecutiveReportModal({
  isOpen,
  onClose,
  stats,
  modules,
  columns,
  recurringTasks,
  selectedMonth,
  selectedYear
}: {
  isOpen: boolean;
  onClose: () => void;
  stats: DashboardStats | null;
  modules: Module[];
  columns: KanbanColumn[];
  recurringTasks: any[];
  selectedMonth: number;
  selectedYear: number;
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !stats) return null;

  // Desestruturação segura para eliminar erro 'stats is possibly null' em closures
  const { total: totalTasks, completed: totalCompleted, completionRate, inProgress, todo, moduleMetrics } = stats;

  // Correção da busca direta na coluna 'col.isDone', pois o card individual não tem propriedade 'card.column'
  const overdueCards = columns.flatMap(col => col.cards.filter(card => !card.completed && !col.isDone && isCardOverdue(card.dueDate)));
  const urgentCards = columns.flatMap(col => col.cards.filter(card => !card.completed && !col.isDone && (card.priority === "Urgente" || card.priority === "Alta")));
  const totalFinancial = recurringTasks.reduce((acc, r) => acc + (r.amount || 0), 0);

  function handlePrint() {
    window.print();
  }

  function handleCopySummary() {
    const summary = `
========================================
📋 RELATÓRIO EXECUTIVO PENDS
Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}
Usuário: Nicolas Gonçalves
========================================

📊 TELEMETRIA DE PRODUTIVIDADE:
- Total de Tarefas: ${totalTasks}
- Concluídas: ${totalCompleted} (${completionRate}%)
- Em Andamento: ${inProgress + todo}
- Atrasadas / Vencidas: ${overdueCards.length}
- Alta Prioridade / Urgentes: ${urgentCards.length}

💰 CONTROLE FINANCEIRO (${MONTH_NAMES[selectedMonth]}/${selectedYear}):
- Custo Mapeado Previsto: ${totalFinancial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
- Contas Cadastradas: ${recurringTasks.length}

📂 CARGA POR MÓDULO DE VIDA:
${moduleMetrics.map(m => `• ${m.title}: ${m.done}/${m.total} (${m.percent}%) - ${m.pending} pendentes`).join("\n")}

⚠️ RISCOS E ATENÇÃO IMEDIATA:
${overdueCards.length > 0 ? overdueCards.map(c => `[VENCIDA] ${c.title} (Prazo: ${c.dueDate ? new Date(c.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'})`).join("\n") : "✓ Nenhuma pendência vencida."}
========================================
`.trim();

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b101f] border border-blue-900/40 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER DO RELATÓRIO */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-[#070b14] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
                  DIAGNÓSTICO OFICIAL
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans mt-0.5">
                Relatório Executivo Pends // Telemetria & Finanças
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copiar resumo em texto"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              title="Imprimir ou Salvar em PDF"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">PDF / Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CORPO DO DOCUMENTO */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-sm font-sans bg-[#050811]">
          
          {/* SÍNTESE EM NÚMEROS */}
          <div>
            <h4 className="text-xs font-bold uppercase font-mono text-cyan-400 tracking-wider mb-3 flex items-center gap-1.5">
              <Award size={14} /> 1. Painel Geral de Desempenho
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0b101f] p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Total de Tarefas</span>
                <span className="text-2xl font-black font-mono text-white">{totalTasks}</span>
              </div>
              <div className="bg-[#0b101f] p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Taxa de Conclusão</span>
                <span className="text-2xl font-black font-mono text-emerald-400">{completionRate}%</span>
                <span className="text-[10px] text-slate-500 block font-mono mt-0.5">{totalCompleted} entregues</span>
              </div>
              <div className="bg-[#0b101f] p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Em Andamento</span>
                <span className="text-2xl font-black font-mono text-cyan-400">{inProgress + todo}</span>
                <span className="text-[10px] text-slate-500 block font-mono mt-0.5">{inProgress} ativas</span>
              </div>
              <div className="bg-[#0b101f] p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-red-400 block mb-1">Atrasadas / Críticas</span>
                <span className="text-2xl font-black font-mono text-red-400">{overdueCards.length + urgentCards.length}</span>
                <span className="text-[10px] text-red-400/80 block font-mono mt-0.5">{overdueCards.length} vencidas</span>
              </div>
            </div>
          </div>

          {/* BALANÇO POR MÓDULO */}
          <div>
            <h4 className="text-xs font-bold uppercase font-mono text-cyan-400 tracking-wider mb-3 flex items-center gap-1.5">
              <Layers size={14} /> 2. Distribuição por Módulo de Vida
            </h4>
            <div className="bg-[#0b101f] rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070b14] text-[10px] font-mono uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Módulo</th>
                    <th className="p-3.5">Total</th>
                    <th className="p-3.5">Concluídas</th>
                    <th className="p-3.5">Pendentes</th>
                    <th className="p-3.5 text-right">Progresso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {moduleMetrics.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-900/40">
                      <td className="p-3.5 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                        <span className="font-bold text-white font-sans">{m.title}</span>
                      </td>
                      <td className="p-3.5 text-slate-300">{m.total}</td>
                      <td className="p-3.5 text-emerald-400 font-bold">{m.done}</td>
                      <td className="p-3.5 text-amber-400">{m.pending}</td>
                      <td className="p-3.5 text-right font-bold text-cyan-400">{m.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BALANÇO FINANCEIRO */}
          <div>
            <h4 className="text-xs font-bold uppercase font-mono text-cyan-400 tracking-wider mb-3 flex items-center gap-1.5">
              <Wallet size={14} /> 3. Projeção Financeira Integrada ({MONTH_NAMES[selectedMonth]}/{selectedYear})
            </h4>
            <div className="bg-[#0b101f] p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono text-slate-400 block mb-1">Custo Total Previsto no Período</span>
                <span className="text-3xl font-black font-mono text-emerald-400">
                  {totalFinancial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-[10px] font-mono text-slate-500 block mt-1">
                  Mapeamento baseado em {recurringTasks.length} contas e rotinas configuradas
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recurringTasks.slice(0, 4).map(r => (
                  <div key={r.id} className="p-2.5 rounded-xl bg-[#070b14] border border-slate-800 text-xs font-mono">
                    <span className="text-slate-400 block text-[10px] truncate max-w-32">{r.title}</span>
                    <span className="text-emerald-400 font-bold">
                      {r.amount ? r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "R$ 0,00"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MATRIZ DE RISCO / VENCIDAS */}
          <div>
            <h4 className="text-xs font-bold uppercase font-mono text-red-400 tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldAlert size={14} /> 4. Matriz de Atenção (Vencidas e Críticas)
            </h4>
            <div className="space-y-2">
              {overdueCards.map(c => (
                <div key={c.id} className="p-3 rounded-xl bg-[#160b10] border border-red-500/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-red-200 block">{c.title}</span>
                    <span className="text-[10px] font-mono text-red-400">
                      Módulo: {c.module?.title || "Geral"} • Venceu em: {c.dueDate ? new Date(c.dueDate).toLocaleDateString('pt-BR') : ""}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold uppercase bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded">
                    ⚠️ Vencida
                  </span>
                </div>
              ))}

              {overdueCards.length === 0 && (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-400 text-xs font-mono flex items-center gap-2">
                  <Check size={16} /> Nenhuma pendência em atraso no sistema. Excelente gestão de cronograma!
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RODAPÉ */}
        <div className="p-4 bg-[#070b14] border-t border-slate-800 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-mono text-slate-500">
            Pends ERP // Relatório gerado com isolamento de schema PostgreSQL
          </span>
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold rounded-xl cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
}

// --- APLICAÇÃO PRINCIPAL ---
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
  const [kanbanMonthFilter, setKanbanMonthFilter] = useState<"month" | "all">("all");

  const [activeModuleFilter, setActiveModuleFilter] = useState<string>("all");
  const [activeDraggingCard, setActiveDraggingCard] = useState<KanbanCardData | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [createTargetColumnId, setCreateTargetColumnId] = useState<string>("");
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<any>(null);

  const [inspectingTaskId, setInspectingTaskId] = useState<string | null>(null);

  // ESTADO DO RELATÓRIO EXECUTIVO
  const [showReportModal, setShowReportModal] = useState(false);

  const inspectingTask = useMemo(() => {
    if (!inspectingTaskId) return null;
    return recurringTasks.find(r => r.id === inspectingTaskId) || null;
  }, [recurringTasks, inspectingTaskId]);

  const [editingInlineId, setEditingInlineId] = useState<string | null>(null);
  const [inlineAmountInput, setInlineAmountInput] = useState<string>("");

  const [spawnTargetTask, setSpawnTargetTask] = useState<any>(null);
  const [spawnAmountInput, setSpawnAmountInput] = useState("");
  const [spawnMonth, setSpawnMonth] = useState<number>(new Date().getMonth());
  const [spawnYear, setSpawnYear] = useState<number>(new Date().getFullYear());

  const [newTitle, setNewTitle] = useState("");
  const [newModuleId, setNewModuleId] = useState("");
  const [newPriority, setNewPriority] = useState("Normal");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [modTitle, setModTitle] = useState("");
  const [modColor, setModColor] = useState("#3B82F6");

  const [recTitle, setRecTitle] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recDueDay, setRecDueDay] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
    checkAuthSession().then(isAuth => {
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

  // EXPORTADOR CSV
  function handleExportCSV() {
    const rows: string[][] = [
      ["ID", "Título", "Módulo", "Prioridade", "Vencimento", "Status", "Descrição"]
    ];

    columns.forEach(col => {
      col.cards.forEach(card => {
        const isDone = card.completed || col.isDone;
        rows.push([
          card.id,
          `"${(card.title || "").replace(/"/g, '""')}"`,
          card.module?.title || "Geral",
          card.priority,
          card.dueDate ? new Date(card.dueDate).toLocaleDateString('pt-BR') : "Sem prazo",
          isDone ? "Concluída" : col.title,
          `"${(card.description || "").replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(";")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_Pends_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrevMonth() {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  }

  function handleNextMonth() {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  }

  function handleOpenCreateInColumn(colId: string) {
    setCreateTargetColumnId(colId);
    setNewModuleId(activeModuleFilter !== "all" ? activeModuleFilter : "");
    setShowCreateCardModal(true);
  }

  async function handleCreateCard() {
    if (!newTitle.trim() || !createTargetColumnId) return;
    await createCard(createTargetColumnId, newTitle, newModuleId, newPriority, newDesc, newDueDate);
    setShowCreateCardModal(false);
    setNewTitle(""); setNewDesc(""); setNewDueDate(""); setNewPriority("Normal");
    void loadAll();
  }

  async function handleAddColumn() {
    const title = prompt("Digite o nome da nova Etapa do Kanban:");
    if (title && title.trim()) {
      const isDone = confirm("Esta etapa representa a CONCLUSÃO / ENTREGA das pendências?");
      await createColumn(title.trim(), isDone);
      void loadAll();
    }
  }

  async function handleEditColumn(col: KanbanColumn) {
    const newTitle = prompt("Novo nome para a etapa:", col.title);
    if (newTitle && newTitle.trim()) {
      const isDone = confirm("Esta etapa representa a CONCLUSÃO / FINALIZAÇÃO das pendências?");
      await updateColumn(col.id, newTitle.trim(), isDone);
      void loadAll();
    }
  }

  async function handleDeleteColumn(colId: string) {
    if (confirm("Tem certeza? Todas as pendências desta etapa serão excluídas!")) {
      await deleteColumn(colId);
      void loadAll();
    }
  }

  function handleOpenModuleModal(mod?: Module) {
    if (mod) {
      setEditingModule(mod); setModTitle(mod.title); setModColor(mod.color);
    } else {
      setEditingModule(null); setModTitle(""); setModColor("#3B82F6");
    }
    setShowModuleModal(true);
  }

  async function handleSaveModule() {
    if (!modTitle.trim()) return;
    if (editingModule) {
      await updateModule(editingModule.id, modTitle, modColor);
    } else {
      await createModule(modTitle, modColor);
    }
    setShowModuleModal(false); setModTitle(""); setEditingModule(null);
    void loadAll();
  }

  async function handleDeleteModule(id: string) {
    if (confirm("Deseja realmente remover este módulo?")) {
      if (activeModuleFilter === id) setActiveModuleFilter("all");
      await deleteModule(id);
      void loadAll();
    }
  }

  function handleOpenRecurringModal(task?: any) {
    if (task) {
      setEditingRecurring(task);
      setRecTitle(task.title);
      setRecAmount(task.amount ? task.amount.toString() : "");
      setRecDueDay(task.dueDay ? task.dueDay.toString() : "");
      setNewModuleId(task.moduleId || "");
    } else {
      setEditingRecurring(null);
      setRecTitle("");
      setRecAmount("");
      setRecDueDay("");
      setNewModuleId("");
    }
    setShowRecurringModal(true);
  }

  async function handleSaveRecurring() {
    if (!recTitle.trim()) return;
    const finalAmount = recAmount ? parseFloat(recAmount) : null;
    const finalDueDay = recDueDay ? parseInt(recDueDay) : null;

    if (editingRecurring) {
      await updateRecurringTask(editingRecurring.id, recTitle, finalAmount, finalDueDay, newModuleId);
    } else {
      await createRecurringTask(recTitle, finalAmount, finalDueDay, newModuleId);
    }

    setShowRecurringModal(false);
    setEditingRecurring(null);
    setRecTitle(""); setRecAmount(""); setRecDueDay("");
    void loadAll();
  }

  async function handleSaveInlineAmount(taskId: string) {
    const val = inlineAmountInput ? parseFloat(inlineAmountInput) : null;

    setRecurringTasks(prev => prev.map(t => t.id === taskId ? { ...t, amount: val, updatedAt: new Date() } : t));
    setEditingInlineId(null);
    setInlineAmountInput("");

    await quickUpdateRecurringAmount(taskId, val);
    void loadAll();
  }

  function handleStartSpawn(task: any) {
    setSpawnTargetTask(task);
    setSpawnAmountInput(task.amount ? task.amount.toString() : "");
    setSpawnMonth(selectedMonth);
    setSpawnYear(selectedYear);
  }

  async function handleConfirmSpawn() {
    if (!spawnTargetTask) return;
    await spawnCardFromRecurring(
      spawnTargetTask.id, 
      spawnAmountInput ? parseFloat(spawnAmountInput) : null,
      spawnMonth,
      spawnYear
    );
    setSpawnTargetTask(null);
    setSpawnAmountInput("");
    alert(`Pendência lançada no Kanban para ${MONTH_NAMES[spawnMonth]}/${spawnYear}!`);
    void loadAll();
  }

  async function handleDeleteRecurring(id: string) {
    if(confirm("Excluir esta rotina?")) {
      await deleteRecurringTask(id);
      void loadAll();
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = event.active.id as string;
    for (const col of columns) {
      const found = col.cards.find(c => c.id === activeId);
      if (found) { setActiveDraggingCard(found); break; }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDraggingCard(null);
    if (!over || active.id === over.id) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const sourceCol = columns.find(col => col.cards.some(c => c.id === activeCardId));
    if (!sourceCol) return;

    let targetColId = columns.find(col => col.id === overId)?.id;
    if (!targetColId) targetColId = columns.find(col => col.cards.some(c => c.id === overId))?.id;
    if (!targetColId || targetColId === sourceCol.id) return;

    const targetCol = columns.find(c => c.id === targetColId);
    const movingCard = sourceCol.cards.find(c => c.id === activeCardId);
    if (!movingCard || !targetCol) return;

    setColumns(prev => prev.map(col => {
      if (col.id === sourceCol.id) return { ...col, cards: col.cards.filter(c => c.id !== activeCardId) };
      if (col.id === targetColId) {
        return { 
          ...col, 
          cards: [...col.cards, { 
            ...movingCard, columnId: targetColId, completed: targetCol.isDone, completedAt: targetCol.isDone ? new Date() : null
          }] 
        };
      }
      return col;
    }));

    await moveCard(activeCardId, targetColId);
    void loadAll();
  }

  async function handleQuickAdvance(cardId: string) {
    const currentColIndex = columns.findIndex(col => col.cards.some(c => c.id === cardId));
    if (currentColIndex === -1 || currentColIndex >= columns.length - 1) return;
    const nextCol = columns[currentColIndex + 1];

    setColumns(prev => {
      let moved: KanbanCardData | null = null;
      const step1 = prev.map(col => {
        const found = col.cards.find(c => c.id === cardId);
        if (found) { moved = found; return { ...col, cards: col.cards.filter(c => c.id !== cardId) }; }
        return col;
      });
      if (!moved) return prev;
      return step1.map(col => {
        if (col.id === nextCol.id) {
          return { ...col, cards: [...col.cards, { ...moved!, columnId: nextCol.id, completed: nextCol.isDone, completedAt: nextCol.isDone ? new Date() : null }] };
        }
        return col;
      });
    });

    await moveCard(cardId, nextCol.id);
    void loadAll();
  }

  async function handleToggleComplete(cardId: string) {
    await toggleCardCompletion(cardId);
    void loadAll();
  }

  async function handleQuickChangeModule(cardId: string, newModuleId: string) {
    const selectedMod = modules.find(m => m.id === newModuleId);
    setColumns(prev => prev.map(col => ({
      ...col, cards: col.cards.map(c => c.id === cardId ? { ...c, moduleId: newModuleId || null, module: selectedMod || null } : c)
    })));
    await updateCardModule(cardId, newModuleId || null);
    void loadAll();
  }

  if (!isAuthenticated) return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;

  const getCardCountByModule = (modId: string) => columns.reduce((acc, col) => acc + col.cards.filter(c => c.moduleId === modId).length, 0);
  const totalCardCount = columns.reduce((acc, col) => acc + col.cards.length, 0);
  const activeModuleObj = modules.find(m => m.id === activeModuleFilter);

  const totalMensal = recurringTasks.reduce((acc, r) => acc + (r.amount || 0), 0);

  return (
    <div className="h-screen bg-[#050811] flex overflow-hidden font-sans text-slate-300">
      
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* MODAL DETALHES CARD */}
      <CardDetailModal 
        cardId={selectedCardId} 
        isOpen={!!selectedCardId} 
        onClose={() => setSelectedCardId(null)} 
        modules={modules}
        onReload={loadAll}
      />

      {/* MODAL DE RELATÓRIO EXECUTIVO OFICIAL */}
      <ExecutiveReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        stats={stats}
        modules={modules}
        columns={columns}
        recurringTasks={recurringTasks}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* SIDEBAR RESPONSIVA */}
      <aside className={`fixed inset-y-0 left-0 z-50 md:static w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col shrink-0 transition-transform duration-300 ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
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
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-1.5 border-b border-slate-800/80 pb-6">
          <button type="button" onClick={() => { setActiveTab("neural"); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${activeTab === "neural" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}>
            <Globe size={16} className="text-cyan-400"/> Visão Neural
          </button>
          <button type="button" onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${activeTab === "dashboard" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}>
            <Activity size={16}/> Analytics Dash
          </button>
          <button type="button" onClick={() => { setActiveTab("kanban"); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${activeTab === "kanban" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}>
            <Layout size={16}/> Pipeline (Kanban)
          </button>
          <button type="button" onClick={() => { setActiveTab("finances"); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${activeTab === "finances" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}>
            <Wallet size={16} className="text-emerald-400"/> Finanças & Rotinas
          </button>
        </div>

        <div className="px-4 py-3 flex-1 overflow-y-auto mt-1">
          <div className="flex items-center justify-between mb-3 text-[11px] uppercase font-bold text-slate-400 font-mono">
            <span>Módulos de Vida</span>
            <button type="button" onClick={() => handleOpenModuleModal()} className="p-1 hover:bg-blue-600/20 rounded text-blue-400 transition-colors cursor-pointer"><Plus size={15}/></button>
          </div>
          <div className="space-y-1.5">
            {modules.map((m) => (
              <div key={m.id} onClick={() => { setActiveTab("kanban"); setActiveModuleFilter(m.id); setMobileMenuOpen(false); }} className={`group flex items-center justify-between px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all ${activeTab === "kanban" && activeModuleFilter === m.id ? "bg-slate-800/90 text-white shadow-md" : "bg-[#0f172a] border-slate-800/80 hover:border-slate-700 text-slate-300"}`} style={{ borderLeftColor: m.color, borderLeftWidth: "3px" }}>
                <div className="flex items-center gap-2 truncate"><span className="truncate font-medium">{m.title}</span></div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={() => handleOpenModuleModal(m)} className="p-1 text-slate-400 hover:text-blue-400 rounded cursor-pointer"><Pencil size={12}/></button>
                  <button type="button" onClick={() => { void handleDeleteModule(m.id); }} className="p-1 text-slate-400 hover:text-red-400 rounded cursor-pointer"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800/80 bg-[#070a12] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-950 border border-blue-800 flex items-center justify-center font-bold text-xs text-blue-300 font-mono">NP</div>
            <div className="text-xs">
              <div className="font-bold text-slate-200">Nicolas</div>
              <div className="text-slate-500 truncate w-32 font-mono text-[10px]">trabalhonicolasplg...</div>
            </div>
          </div>
          <button type="button" onClick={() => void handleLogout()} className="text-slate-500 hover:text-red-400 cursor-pointer" title="Encerrar Sessão"><LogOut size={16}/></button>
        </div>
      </aside>

      {/* ÁREA CENTRAL */}
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
            {activeTab === "finances" && "Finanças"}
          </span>
          <div className="w-8" />
        </div>

        {/* ABA 1: VISÃO NEURAL HÍBRIDA */}
        {activeTab === "neural" && (
          <NeuralNetworkView 
            modules={modules} 
            columns={columns} 
            onSelectModule={(modId: string) => { setActiveModuleFilter(modId); setActiveTab("kanban"); }}
            onToggleComplete={handleToggleComplete}
          />
        )}
        
        {/* ABA 2: ANALYTICS DASH NOVO PADRÃO DE DESIGN COM GERADOR DE RELATÓRIO */}
        {activeTab === "dashboard" && !stats && (
          <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-sm">
            Carregando telemetria analítica...
          </div>
        )}
        {activeTab === "dashboard" && stats && (
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-6">
            
            {/* CABEÇALHO DO ANALYTICS COM BOTÕES DE RELATÓRIO */}
            <div className="bg-[#0b101f] border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold">
                    PENDS // ANALYTICS INTELLIGENCE
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Painel de Desempenho & Diagnóstico
                </h2>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Métricas de produtividade, auditoria de gargalos e geração de relatórios executivos.
                </p>
              </div>

              {/* BOTÕES DE AÇÃO: RELATÓRIO E EXPORTAÇÃO */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 bg-[#070b14] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
                  title="Baixar todas as pendências em arquivo .CSV para Excel"
                >
                  <Download size={14} className="text-emerald-400" />
                  <span>Exportar CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  <FileText size={15} />
                  <span>Gerar Relatório Executivo</span>
                </button>
              </div>
            </div>

            {/* TOP 4 KPIS NOVO PADRÃO VISUAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-mono uppercase text-slate-400">Total de Pendências</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Layers size={16} />
                  </div>
                </div>
                <div className="text-3xl font-mono font-black text-white">{stats.total}</div>
                <div className="text-[11px] text-slate-500 mt-2 font-mono">Mapeadas no Kanban</div>
              </div>

              <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-mono uppercase text-slate-400">Taxa de Conclusão</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div className="text-3xl font-mono font-black text-emerald-400">{stats.completionRate}%</div>
                <div className="text-[11px] text-slate-500 mt-2 font-mono">{stats.completed} entregues no total</div>
              </div>

              <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-mono uppercase text-slate-400">Em Andamento</span>
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Clock size={16} />
                  </div>
                </div>
                <div className="text-3xl font-mono font-black text-cyan-400">{stats.inProgress + stats.todo}</div>
                <div className="text-[11px] text-slate-500 mt-2 font-mono">{stats.inProgress} ativas // {stats.todo} a iniciar</div>
              </div>

              <div className="bg-[#0b101f] p-5 sm:p-6 rounded-3xl border border-slate-800/90 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-mono uppercase text-red-400">Atenção Crítica</span>
                  <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                    <AlertTriangle size={16} />
                  </div>
                </div>
                <div className={`text-3xl font-mono font-black ${stats.overdue + stats.urgent > 0 ? "text-red-400 animate-pulse" : "text-slate-500"}`}>
                  {stats.overdue + stats.urgent}
                </div>
                <div className="text-[11px] text-slate-500 mt-2 font-mono">{stats.overdue} vencidas // {stats.urgent} urgentes</div>
              </div>
            </div>

            {/* SEÇÃO PRINCIPAL: CARGA POR MÓDULO & PRÓXIMOS PRAZOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CARGA POR MÓDULO */}
              <div className="lg:col-span-2 bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                      <BarChart3 size={16} className="text-blue-400" />
                      <span>Carga & Volume por Módulo</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-sans">
                      Distribuição em tempo real do progresso das áreas de vida
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-1 rounded-full">
                    {stats.moduleMetrics.length} Módulos
                  </span>
                </div>

                <div className="space-y-5">
                  {stats.moduleMetrics.map((mod) => (
                    <div key={mod.id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: mod.color }}/>
                          <span className="font-semibold text-slate-200">{mod.title}</span>
                          <span className="text-slate-500 text-[11px] font-mono">({mod.total} tarefas)</span>
                        </div>
                        <div className="font-mono text-slate-400 text-xs">
                          <span className="text-emerald-400 font-bold">{mod.done}</span> / <span className="text-amber-400">{mod.pending}</span> ({mod.percent}%)
                        </div>
                      </div>
                      
                      <div className="w-full bg-[#070b14] h-2.5 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                        <div 
                          className="h-full rounded-full transition-all duration-500 shadow-sm" 
                          style={{ width: `${mod.percent}%`, backgroundColor: mod.color }} 
                        />
                      </div>
                    </div>
                  ))}

                  {stats.moduleMetrics.length === 0 && (
                    <div className="text-center py-8 text-slate-600 font-mono text-xs">
                      Nenhum módulo encontrado.
                    </div>
                  )}
                </div>
              </div>

              {/* AGENDA DE PRÓXIMOS PRAZOS INTERATIVA */}
              <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                      <Calendar size={16} className="text-blue-400"/>
                      <span>Próximos Prazos</span>
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                      AGENDA
                    </span>
                  </div>

                  <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
                    {stats.upcomingDeadlines.map((item) => {
                      const overdue = isCardOverdue(item.dueDate);
                      return (
                        <div 
                          key={item.id} 
                          className={`p-3 rounded-2xl border flex items-center justify-between transition-colors ${
                            overdue ? "border-red-500/40 bg-red-950/10" : "bg-[#070b14] border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className={`text-xs font-semibold truncate ${overdue ? "text-red-300" : "text-slate-200"}`}>
                              {item.title}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: item.moduleColor }}>
                                {item.moduleName}
                              </span>
                              <span className={`text-[10px] font-mono ${overdue ? "text-red-400 font-bold" : "text-slate-400"}`}>
                                {item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR') : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                              overdue ? "bg-red-500/20 text-red-400 border border-red-500/40" :
                              item.priority === 'Urgente' ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {overdue ? "Vencida" : item.priority}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleComplete(item.id)}
                              className="text-slate-500 hover:text-emerald-400 p-1 cursor-pointer transition-colors"
                              title="Concluir tarefa"
                            >
                              <Circle size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {stats.upcomingDeadlines.length === 0 && (
                      <div className="text-center py-12 text-slate-600 font-mono text-xs">
                        Nenhum prazo cadastrado para os próximos dias.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/60 mt-4 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                  <span>Conclusão em 1 toque</span>
                  <CheckSquare size={13} className="text-emerald-400" />
                </div>
              </div>

            </div>

            {/* SEÇÃO INFERIOR: DISTRIBUIÇÃO PIPELINE & CONTROLE FINANCEIRO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* DISTRIBUIÇÃO DO PIPELINE */}
              <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-4 flex items-center gap-2">
                  <PieChart size={16} className="text-cyan-400" />
                  <span>Distribuição no Pipeline</span>
                </h3>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-2xl text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">A Fazer</span>
                    <span className="text-2xl font-bold font-mono text-slate-200">{stats.todo}</span>
                    <span className="text-[10px] font-mono text-slate-500 block mt-1">
                      {stats.total > 0 ? Math.round((stats.todo / stats.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-2xl text-center">
                    <span className="text-[10px] font-mono uppercase text-cyan-400 block mb-1">Andamento</span>
                    <span className="text-2xl font-bold font-mono text-cyan-400">{stats.inProgress}</span>
                    <span className="text-[10px] font-mono text-slate-500 block mt-1">
                      {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-2xl text-center">
                    <span className="text-[10px] font-mono uppercase text-emerald-400 block mb-1">Concluídas</span>
                    <span className="text-2xl font-bold font-mono text-emerald-400">{stats.completed}</span>
                    <span className="text-[10px] font-mono text-slate-500 block mt-1">
                      {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* CONTROLE FINANCEIRO VINCULADO */}
              <div className="bg-[#0b101f] p-5 sm:p-7 rounded-3xl border border-slate-800/90 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-1 flex items-center gap-2">
                    <Wallet size={16} className="text-emerald-400" />
                    <span>Controle Financeiro Mensal</span>
                  </h3>
                  <div className="text-3xl font-black font-mono text-emerald-400 mt-2">
                    {totalMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                    {recurringTasks.length} contas e rotinas ativas em {MONTH_NAMES[selectedMonth]}/{selectedYear}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("finances")}
                  className="w-full sm:w-auto px-5 py-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-2xl text-xs font-bold font-mono transition-all cursor-pointer text-center shadow-lg"
                >
                  Abrir Planilha ➔
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ABA DA PLANILHA (FINANÇAS) */}
        {activeTab === "finances" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-auto sm:h-16 border-b border-slate-800/80 p-4 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between bg-[#0a0f1d] gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-white font-bold font-mono uppercase text-sm">
                  <Wallet size={18} className="text-emerald-400" />
                  <span>Finanças</span>
                </div>

                <div className="flex items-center gap-2 bg-[#070a12] border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
                  <button type="button" onClick={handlePrevMonth} className="p-1 hover:text-white text-slate-400 cursor-pointer" title="Mês Anterior">
                    <ChevronLeft size={14}/>
                  </button>
                  <span className="font-bold text-emerald-400 uppercase tracking-wider px-1 text-[11px]">
                    {MONTH_NAMES[selectedMonth]} / {selectedYear}
                  </span>
                  <button type="button" onClick={handleNextMonth} className="p-1 hover:text-white text-slate-400 cursor-pointer" title="Próximo Mês">
                    <ChevronRight size={14}/>
                  </button>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => handleOpenRecurringModal()} 
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/30"
              >
                <Plus size={15}/> Cadastrar Rotina
              </button>
            </div>

            <div className="p-4 sm:p-8 overflow-y-auto flex-1">
              <div className="bg-[#0f172a] p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-xl mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-[11px] uppercase text-slate-400 font-mono tracking-wider mb-1">
                    Custo Mapeado em {MONTH_NAMES[selectedMonth]}/{selectedYear}
                  </h3>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                    {totalMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    ⚡ Dica: Dê 1 clique no valor de qualquer conta para atualizar o saldo da fatura na hora!
                  </span>
                </div>
                <Receipt size={36} className="text-slate-800" />
              </div>

              <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-175">
                  <thead className="bg-[#0b101d] text-[10px] font-bold text-slate-500 uppercase font-mono border-b border-slate-800">
                    <tr>
                      <th className="p-4">Título / Conta</th>
                      <th className="p-4">Módulo</th>
                      <th className="p-4">Dia Venc.</th>
                      <th className="p-4">Valor Atual (1 Clique p/ Editar)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-sm text-slate-300">
                    {recurringTasks.map(task => {
                      const overallStatus = getTaskOverallStatus(task);
                      const isEditingThis = editingInlineId === task.id;

                      return (
                        <tr key={task.id} className="hover:bg-[#121829] transition-colors">
                          <td className="p-4 font-semibold text-slate-200">
                            {task.title}
                          </td>
                          <td className="p-4">
                            {task.module ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded font-mono" style={{ backgroundColor: `${task.module.color}20`, color: task.module.color }}>
                                {task.module.title}
                              </span>
                            ) : <span className="text-slate-600 text-xs">-</span>}
                          </td>
                          <td className="p-4 font-mono text-slate-400">{task.dueDay ? `Todo dia ${task.dueDay}` : "Variável"}</td>
                          
                          <td className="p-4 font-mono">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                <input
                                  type="number"
                                  step="0.01"
                                  autoFocus
                                  placeholder="0.00"
                                  value={inlineAmountInput}
                                  onChange={e => setInlineAmountInput(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") void handleSaveInlineAmount(task.id);
                                    if (e.key === "Escape") setEditingInlineId(null);
                                  }}
                                  className="w-28 bg-[#070a12] border border-blue-500 p-1.5 rounded text-xs text-white outline-none font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => { void handleSaveInlineAmount(task.id); }}
                                  className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                                  title="Confirmar"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingInlineId(null)}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  setEditingInlineId(task.id);
                                  setInlineAmountInput(task.amount ? task.amount.toString() : "");
                                }}
                                className="group cursor-pointer inline-flex flex-col"
                                title="Clique para editar este valor na hora"
                              >
                                <div className="flex items-center gap-1.5">
                                  {task.amount ? (
                                    <span className="font-bold text-emerald-400 group-hover:underline">
                                      {task.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 font-mono text-xs italic group-hover:underline">
                                      Clique p/ definir saldo
                                    </span>
                                  )}
                                  <Pencil size={11} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                                </div>
                                <span className="text-[9px] text-slate-500 font-mono">
                                  {task.updatedAt ? `Atualizado ${new Date(task.updatedAt).toLocaleDateString('pt-BR')}` : ""}
                                </span>
                              </div>
                            )}
                          </td>
                          
                          <td className="p-4">
                            <button
                              type="button"
                              onClick={() => setInspectingTaskId(task.id)}
                              className={`text-[10px] font-bold px-3 py-1 rounded-full border font-mono flex items-center gap-1 cursor-pointer transition-all shadow-sm ${overallStatus.color}`}
                              title="Clique para ver o histórico de todos os meses"
                            >
                              <span>{overallStatus.label}</span>
                              <span className="text-slate-500 mx-0.5">:</span>
                              <span className="text-[9px] text-slate-300 underline font-sans">detalhes</span>
                            </button>
                          </td>

                          <td className="p-4 flex items-center justify-end gap-1.5">
                            <button 
                              type="button"
                              onClick={() => handleStartSpawn(task)} 
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded text-[10px] font-bold uppercase font-mono transition-colors cursor-pointer"
                            >
                              <ArrowDownToLine size={12}/> Gerar
                            </button>
                            
                            <button 
                              type="button"
                              onClick={() => handleOpenRecurringModal(task)} 
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                              title="Configurações completas"
                            >
                              <Pencil size={14}/>
                            </button>

                            <button 
                              type="button"
                              onClick={() => { void handleDeleteRecurring(task.id); }} 
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={14}/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA KANBAN */}
        {activeTab === "kanban" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-[#0b101d] border-b border-slate-800/80 px-4 sm:px-8 py-2.5 flex items-center justify-between overflow-x-auto shrink-0 gap-3">
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 bg-[#070a12] border border-slate-800 px-3 py-1 rounded-xl font-mono text-xs">
                  <button type="button" onClick={handlePrevMonth} className="p-1 hover:text-white text-slate-400 cursor-pointer">
                    <ChevronLeft size={13}/>
                  </button>
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                    {MONTH_NAMES[selectedMonth]} / {selectedYear}
                  </span>
                  <button type="button" onClick={handleNextMonth} className="p-1 hover:text-white text-slate-400 cursor-pointer">
                    <ChevronRight size={13}/>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setKanbanMonthFilter(f => f === "all" ? "month" : "all")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border shrink-0 ${
                    kanbanMonthFilter === "month"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                      : "bg-[#070a12] text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Filter size={12} />
                  <span>{kanbanMonthFilter === "month" ? `Filtrado: ${MONTH_NAMES[selectedMonth]}` : "Ver Todos"}</span>
                </button>

                <div className="h-5 w-px bg-slate-800 mx-1" />

                <button type="button" onClick={() => setActiveModuleFilter("all")} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border shrink-0 ${activeModuleFilter === "all" ? "bg-blue-600 text-white border-blue-400" : "bg-[#070a12] text-slate-400 border-slate-800 hover:text-white"}`}>
                  <span>Todos</span><span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-black/40">{totalCardCount}</span>
                </button>
                {modules.map((m) => {
                  const count = getCardCountByModule(m.id);
                  const isSelected = activeModuleFilter === m.id;
                  return (
                    <button type="button" key={m.id} onClick={() => setActiveModuleFilter(m.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border shrink-0 ${isSelected ? "bg-slate-800 text-white shadow-md" : "bg-[#070a12] text-slate-400 border-slate-800 hover:text-slate-200"}`} style={{ borderColor: isSelected ? m.color : undefined }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} /><span>{m.title}</span><span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-black/40 text-slate-400">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 p-4 sm:p-8 overflow-x-auto flex gap-5 items-start">
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                {columns.map(col => {
                  const filteredCards = col.cards.filter((card) => {
                    const matchesModule = activeModuleFilter === "all" || card.moduleId === activeModuleFilter;
                    if (!matchesModule) return false;

                    if (kanbanMonthFilter === "month") {
                      if (!card.dueDate) return true;
                      const d = new Date(card.dueDate);
                      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
                    }

                    return true;
                  });

                  return (
                    <KanbanColumnDroppable
                      key={col.id} col={col} cards={filteredCards}
                      onEdit={() => { void handleEditColumn(col); }} onDelete={() => { void handleDeleteColumn(col.id); }} onAddCard={() => handleOpenCreateInColumn(col.id)}
                      onCardClick={(cardId) => setSelectedCardId(cardId)} modules={modules} onNextStage={handleQuickAdvance} onChangeModule={handleQuickChangeModule} onToggleComplete={handleToggleComplete}
                    />
                  );
                })}
                <button type="button" onClick={() => { void handleAddColumn(); }} className="w-72 shrink-0 border-2 border-dashed border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/30 p-5 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-blue-400 text-xs font-bold font-mono transition-all cursor-pointer">
                  <Plus size={16}/> NOVA ETAPA
                </button>
                <DragOverlay>
                  {activeDraggingCard ? (
                    <div className="w-80 bg-[#151d30] p-4 rounded-2xl border-2 border-blue-500 shadow-2xl opacity-90 rotate-2 cursor-grabbing pointer-events-none">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white bg-blue-600 block w-max mb-1">{activeDraggingCard.module?.title || "Geral"}</span>
                      <h4 className="font-bold text-white text-sm">{activeDraggingCard.title}</h4>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
        )}

      </main>

      {/* MODAL HISTÓRICO MULTIMESES */}
      {inspectingTask && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setInspectingTaskId(null)}
        >
          <div 
            className="bg-[#0f172a] border border-blue-900/50 rounded-3xl w-full max-w-xl shadow-2xl text-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-800 bg-[#0a0f1d] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                    {inspectingTask.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Rastreamento de Lançamentos em Todos os Meses
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setInspectingTaskId(null)} 
                className="p-1.5 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X size={18}/>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
              <div className="text-[11px] font-mono text-slate-400 uppercase font-bold mb-2">
                Histórico de Lançamentos no Kanban:
              </div>

              {(inspectingTask.cards ?? []).map((card: any) => {
                const overdue = isCardOverdue(card.dueDate, card.completed || card.column?.isDone);
                const d = card.dueDate ? new Date(card.dueDate) : new Date(card.createdAt);
                const isPaid = card.completed || card.column?.isDone;

                return (
                  <div 
                    key={card.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                      isPaid 
                        ? "bg-[#0b1424] border-emerald-500/40" 
                        : overdue 
                          ? "bg-[#180d12] border-red-500/60" 
                          : "bg-[#111827] border-slate-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleToggleComplete(card.id);
                          }}
                          className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                        >
                          {isPaid ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} />}
                        </button>
                        <span className={`font-semibold text-sm ${isPaid ? "line-through text-slate-400" : "text-white"}`}>
                          {MONTH_NAMES[d.getMonth()]} / {d.getFullYear()}
                        </span>
                      </div>
                      
                      <div className="text-[10px] text-slate-400 font-mono mt-1 ml-6">
                        Etapa no Kanban: <span className="text-blue-300 font-bold">{card.column?.title}</span> • {card.dueDate ? `Vencimento: ${new Date(card.dueDate).toLocaleDateString('pt-BR')}` : "Sem data"}
                      </div>
                    </div>

                    <div>
                      {isPaid ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ✓ Pago
                        </span>
                      ) : overdue ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                          ⚠️ Vencida
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          ⏳ Aberto
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {(inspectingTask.cards ?? []).length === 0 && (
                <div className="text-center py-10 text-slate-500 font-mono text-xs">
                  Nenhum mês gerado para esta conta ainda.
                </div>
              )}
            </div>

            <div className="p-4 bg-[#070b14] border-t border-slate-800 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => setInspectingTaskId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold rounded-xl cursor-pointer"
              >
                Fechar Janela
              </button>

              <button
                type="button"
                onClick={() => {
                  const taskToSpawn = inspectingTask;
                  setInspectingTaskId(null);
                  handleStartSpawn(taskToSpawn);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold uppercase rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <Plus size={14} /> Gerar Para Outro Mês
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PLANILHA / ROTINA */}
      {showRecurringModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowRecurringModal(false)}
        >
          <div 
            className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl text-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wider font-mono flex items-center gap-2">
              <Wallet size={16} className="text-emerald-400"/> {editingRecurring ? "Editar Conta / Rotina" : "Cadastrar Conta / Rotina"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Título / Conta</label>
                <input className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-emerald-500" placeholder="Ex: Cartão Nubank" value={recTitle} onChange={e => setRecTitle(e.target.value)} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block">Valor Atual (R$)</label>
                  <span className="text-[10px] text-slate-500 font-mono">Pode alterar a qualquer momento</span>
                </div>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-emerald-500 font-mono" 
                  placeholder="Ex: 1450.00 (ou deixe em branco se não souber)" 
                  value={recAmount} 
                  onChange={e => setRecAmount(e.target.value)} 
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Dia do Vencimento no Mês</label>
                <input type="number" min="1" max="31" className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-emerald-500 font-mono" placeholder="Ex: 10" value={recDueDay} onChange={e => setRecDueDay(e.target.value)} />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Módulo Vinculado</label>
                <select className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-emerald-500 cursor-pointer" value={newModuleId} onChange={e => setNewModuleId(e.target.value)}>
                  <option value="">Nenhum</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowRecurringModal(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer">Cancelar</button>
              <button type="button" onClick={() => { void handleSaveRecurring(); }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-500 cursor-pointer">
                {editingRecurring ? "Salvar Alterações" : "Salvar Rotina"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA LANÇAR NO KANBAN COM ESCOLHA DE MÊS */}
      {spawnTargetTask && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSpawnTargetTask(null)}
        >
          <div 
            className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl text-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-2 uppercase tracking-wider font-mono">
              Lançar Fatura no Kanban
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-sans">
              Conta: <span className="font-bold text-white">"{spawnTargetTask.title}"</span>. Escolha o mês de vencimento e confirme o valor:
            </p>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Mês de Destino</label>
                  <select
                    value={spawnMonth}
                    onChange={e => setSpawnMonth(parseInt(e.target.value))}
                    className="w-full bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white font-mono outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={name} value={i}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Ano</label>
                  <select
                    value={spawnYear}
                    onChange={e => setSpawnYear(parseInt(e.target.value))}
                    className="w-full bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs text-white font-mono outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {[2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Valor a Pagar (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  autoFocus
                  placeholder="Ex: 1420.50"
                  value={spawnAmountInput}
                  onChange={e => setSpawnAmountInput(e.target.value)}
                  className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div className="bg-[#070a12] p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 font-mono">
                📅 Vencimento exato: <span className="text-white font-bold">{spawnTargetTask.dueDay || 1}/{spawnMonth + 1}/{spawnYear}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setSpawnTargetTask(null)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer">Cancelar</button>
              <button 
                type="button" 
                onClick={() => { void handleConfirmSpawn(); }} 
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-500 cursor-pointer"
              >
                Lançar no Kanban
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA PENDÊNCIA MANUAL */}
      {showCreateCardModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateCardModal(false)}
        >
          <div 
            className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl w-full max-w-lg shadow-2xl text-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wider font-mono">Nova Pendência</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Título</label>
                <input className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-blue-500" placeholder="Ex: Pagar fatura da energia" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Módulo</label>
                  <select className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-blue-500 cursor-pointer" value={newModuleId} onChange={e => setNewModuleId(e.target.value)}>
                    <option value="">Selecione um módulo</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Prioridade</label>
                  <select className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-blue-500 cursor-pointer" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                    <option>Baixa</option><option>Normal</option><option>Alta</option><option>Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Data Limite / Vencimento</label>
                <input type="date" className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Descrição</label>
                <textarea rows={3} className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-xs text-white outline-none focus:border-blue-500 resize-none" placeholder="Detalhes opcionais..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowCreateCardModal(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer">Cancelar</button>
              <button type="button" onClick={() => { void handleCreateCard(); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-500 cursor-pointer">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MÓDULO */}
      {showModuleModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModuleModal(false)}
        >
          <div 
            className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl w-96 shadow-2xl text-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wider font-mono">{editingModule ? "Editar Módulo" : "Novo Módulo"}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Nome do Módulo</label>
                <input className="w-full bg-[#070a12] border border-slate-800 p-2.5 rounded-xl text-sm text-white outline-none focus:border-blue-500" placeholder="Ex: Finanças..." value={modTitle} onChange={e => setModTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">Cor (Hexadecimal)</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={modColor} onChange={e => setModColor(e.target.value)} className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer p-0" />
                  <input type="text" value={modColor} onChange={e => setModColor(e.target.value)} placeholder="#3B82F6" className="flex-1 bg-[#070a12] border border-slate-800 p-2 rounded-xl text-xs font-mono uppercase text-white outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowModuleModal(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer">Cancelar</button>
              <button type="button" onClick={() => { void handleSaveModule(); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-500 cursor-pointer">{editingModule ? "Salvar" : "Criar"}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
