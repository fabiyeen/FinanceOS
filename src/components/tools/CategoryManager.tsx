"use client";

import React, { useState } from "react";
import {
  Tag,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Utensils,
  Cpu,
  Repeat,
  Navigation,
  Home,
  Activity,
  Gamepad2,
  TrendingUp,
  Coins,
  Coffee,
  ShoppingBag,
  Zap,
  Sparkles,
  BookOpen,
  HeartPulse,
  Shield,
  Tv,
  Briefcase,
  GraduationCap,
  Plane,
  Car,
  Smartphone,
  Gift,
  DollarSign,
  CreditCard,
  ArrowLeftRight,
  Handshake,
  HelpCircle,
} from "lucide-react";
import { Category } from "../../lib/types";
import { formatCurrency } from "../../lib/mathEngine";
import { playSound, triggerHaptic } from "../../lib/audioHaptics";
import { db } from "../../lib/db/dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../../lib/auth/authContext";
import { saveCategory, deleteCategory } from "../../lib/db/syncEngine";
import { useUIStore } from "../../store/useUIStore";

// Icon dictionary for safe dynamic rendering
export const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Utensils,
  Cpu,
  Repeat,
  Navigation,
  Home,
  Activity,
  Gamepad2,
  TrendingUp,
  Coins,
  Coffee,
  ShoppingBag,
  Zap,
  Sparkles,
  BookOpen,
  HeartPulse,
  Shield,
  Tag,
  Tv,
  Briefcase,
  GraduationCap,
  Plane,
  Car,
  Smartphone,
  Gift,
  DollarSign,
  CreditCard,
  ArrowLeftRight,
  Handshake,
  HelpCircle,
};

export const COLOR_PALETTES = [
  "#00F0FF", // Cyan
  "#00FF88", // Emerald
  "#FF5C00", // Neon Flame
  "#FFB800", // Amber
  "#9D00FF", // Violet
  "#FF0055", // Rose
  "#E056FD", // Neon Pink
  "#38BDF8", // Sky
  "#F43F5E", // Ruby
  "#708090", // Steel Slate
];

interface CategoryManagerProps {
  isModal?: boolean;
  onClose?: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ isModal = false, onClose }) => {
  const { user } = useAuth();
  const rawCategories = useLiveQuery(() => db.categories.toArray()) ?? [];
  const settings = useLiveQuery(() => db.settings.get("main"));

  const currency = settings?.currency || "IDR";
  const locale = settings?.locale || "id-ID";

  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Tag");
  const [selectedColor, setSelectedColor] = useState("#00F0FF");
  const [budgetCap, setBudgetCap] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteCandidate, setDeleteCandidate] = useState<Category | null>(null);
  const [affectedTxCount, setAffectedTxCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered and sorted by order
  const categories = [...rawCategories]
    .filter((c) => c.type === activeTab)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleOpenAdd = () => {
    playSound("click", true);
    setEditingCategory(null);
    setName("");
    setSelectedIcon(activeTab === "income" ? "TrendingUp" : "Tag");
    setSelectedColor(activeTab === "income" ? "#00FF88" : "#00F0FF");
    setBudgetCap("");
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    playSound("click", true);
    setEditingCategory(cat);
    setName(cat.name);
    setSelectedIcon(cat.icon || "Tag");
    setSelectedColor(cat.color || "#00F0FF");
    setBudgetCap(cat.budgetCap ? String(cat.budgetCap) : "");
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Category name cannot be empty");
      return;
    }

    const parsedCap = budgetCap ? parseFloat(budgetCap) : undefined;
    if (editingCategory) {
      // Edit existing
      const updated: Category = {
        ...editingCategory,
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
        budgetCap: parsedCap,
      };

      await saveCategory(updated, user?.uid);
    } else {
      // Create new
      const maxOrder = categories.reduce((max, c) => Math.max(max, c.order ?? 0), -1);
      const newCat: Category = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: name.trim(),
        type: activeTab,
        icon: selectedIcon,
        color: selectedColor,
        budgetCap: parsedCap,
        order: maxOrder + 1,
      };

      await saveCategory(newCat, user?.uid);
    }

    playSound("success", true);
    triggerHaptic(20);
    setIsEditModalOpen(false);
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    playSound("click", true);
    triggerHaptic(15);

    const currentItem = { ...categories[index] };
    const targetItem = { ...categories[targetIndex] };

    const tempOrder = currentItem.order ?? index;
    currentItem.order = targetItem.order ?? targetIndex;
    targetItem.order = tempOrder;

    // Ensure distinct order if previously matching
    if (currentItem.order === targetItem.order) {
      currentItem.order = targetIndex;
      targetItem.order = index;
    }

    await saveCategory(currentItem, user?.uid);
    await saveCategory(targetItem, user?.uid);
  };

  const handleInitiateDelete = async (cat: Category) => {
    playSound("click", true);
    triggerHaptic(20);

    const count = await db.transactions.where("categoryId").equals(cat.id).count();
    setAffectedTxCount(count);
    setDeleteCandidate(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    playSound("click", true);
    triggerHaptic(40);

    try {
      if (affectedTxCount > 0) {
        // Find or create fallback uncategorized bucket
        let uncat = await db.categories.get("cat_uncategorized");
        if (!uncat) {
          uncat = {
            id: "cat_uncategorized",
            name: "Uncategorized",
            type: deleteCandidate.type,
            icon: "HelpCircle",
            color: "#708090",
            order: 999,
          };
          await saveCategory(uncat, user?.uid);
        }

        // Reassign affected transactions
        await db.transactions.where("categoryId").equals(deleteCandidate.id).modify({ categoryId: uncat.id });
      }

      // Delete category locally and from cloud
      await deleteCategory(deleteCandidate.id, user?.uid);

      playSound("delete", true);
      setDeleteCandidate(null);
    } catch (err) {
      console.error("[CategoryManager] Delete failure:", err);
      alert("Failed to delete category");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Categories &amp; Priority
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex p-1 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100">
            <button
              onClick={() => {
                playSound("tab", true);
                setActiveTab("expense");
              }}
              className={`px-3 py-1 text-xs rounded-lg transition-all font-medium ${
                activeTab === "expense"
                  ? "bg-white/[0.1] text-white font-semibold shadow-sm border border-white/[0.12] dark:bg-white/[0.1] dark:text-white light:bg-slate-900 light:text-white"
                  : "text-zinc-400 hover:text-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200 light:text-slate-500 light:hover:text-slate-900"
              }`}
            >
              Expense ({rawCategories.filter((c) => c.type === "expense").length})
            </button>
            <button
              onClick={() => {
                playSound("tab", true);
                setActiveTab("income");
              }}
              className={`px-3 py-1 text-xs rounded-lg transition-all font-medium ${
                activeTab === "income"
                  ? "bg-white/[0.1] text-white font-semibold shadow-sm border border-white/[0.12] dark:bg-white/[0.1] dark:text-white light:bg-slate-900 light:text-white"
                  : "text-zinc-400 hover:text-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200 light:text-slate-500 light:hover:text-slate-900"
              }`}
            >
              Income ({rawCategories.filter((c) => c.type === "income").length})
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Category List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {categories.map((cat, idx) => {
          const IconComp = CATEGORY_ICON_MAP[cat.icon] || Tag;
          const isFirst = idx === 0;
          const isLast = idx === categories.length - 1;

          return (
            <div
              key={cat.id}
              className="flex items-center justify-between p-3.5 rounded-2xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] hover:border-white/[0.14] transition-all group shadow-xs"
            >
              <div className="flex items-center gap-3">
                {/* Reorder Arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMove(idx, "up")}
                    disabled={isFirst}
                    className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                    title="Move Priority Up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleMove(idx, "down")}
                    disabled={isLast}
                    className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                    title="Move Priority Down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Icon Preview */}
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100"
                  style={{ color: cat.color }}
                >
                  <IconComp className="h-4 w-4" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{cat.name}</span>
                    {cat.isDefault && (
                      <span className="text-[10px] text-[var(--text-muted)] border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 rounded-full px-2 py-0.2">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono-num">
                    {cat.budgetCap ? (
                      <span className="text-emerald-500 tabular-nums">
                        Cap: {formatCurrency(cat.budgetCap, currency, locale)}/mo
                      </span>
                    ) : (
                      <span>Uncapped</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(cat)}
                  className="p-1.5 rounded-lg border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  title="Edit Category"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleInitiateDelete(cat)}
                  className="p-1.5 rounded-lg border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/30 transition-colors"
                  title="Delete Category"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Category Dialog */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-hidden pb-[env(safe-area-inset-bottom)]">
          <div
            className="w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border border-white/[0.1] dark:border-white/[0.1] light:border-slate-200 bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between border-b border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-4 bg-[var(--bg-canvas)]/30">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {editingCategory ? "Edit Category" : `New ${activeTab === "expense" ? "Expense" : "Income"} Category`}
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveCategory} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Groceries, Freelance, Subscriptions"
                    required
                    className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500/50 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                    Monthly Budget Cap ({currency}) [Optional]
                  </label>
                  <input
                    type="number"
                    value={budgetCap}
                    onChange={(e) => setBudgetCap(e.target.value)}
                    placeholder="e.g. 5000000"
                    className="w-full rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-[var(--bg-surface)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500/50 focus:outline-none transition-colors font-mono-num"
                  />
                </div>

                {/* Color Palette Chips */}
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-2">
                    Color Accent
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`h-6 w-6 rounded-full border-2 transition-transform ${
                          selectedColor === color ? "scale-125 border-white shadow-sm" : "border-transparent hover:scale-110"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon Grid */}
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-2">
                    Icon
                  </label>
                  <div className="grid grid-cols-7 gap-1.5 p-2.5 rounded-xl bg-white/[0.02] dark:bg-white/[0.02] light:bg-slate-100 border border-white/[0.06] dark:border-white/[0.06] light:border-slate-200 max-h-40 overflow-y-auto custom-scrollbar">
                    {Object.keys(CATEGORY_ICON_MAP).map((iconKey) => {
                      const Comp = CATEGORY_ICON_MAP[iconKey];
                      const isSelected = selectedIcon === iconKey;
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setSelectedIcon(iconKey)}
                          className={`flex items-center justify-center p-2 rounded-lg border transition-colors ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
                          }`}
                        >
                          <Comp className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-500 font-medium">
                    {formError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 border-t border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-4 bg-[var(--bg-canvas)]/30 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-100 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-semibold text-white transition-all shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  <span>{editingCategory ? "Save Changes" : "Create Category"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.1] dark:border-white/[0.1] light:border-slate-200 bg-[var(--bg-surface)] shadow-2xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-sm font-semibold">
                Delete Category: {deleteCandidate.name}
              </h4>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {affectedTxCount > 0 ? (
                <>
                  Warning: <span className="text-[var(--text-primary)] font-semibold">{affectedTxCount}</span> transactions are currently assigned to this category. Deleting it will reassign them to{" "}
                  <span className="text-emerald-500 font-semibold">Uncategorized</span> so your balances remain accurate.
                </>
              ) : (
                "No transactions are assigned to this category. It can be safely deleted."
              )}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="flex-1 rounded-xl border border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 bg-white/[0.03] dark:bg-white/[0.03] light:bg-slate-100 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-semibold text-white transition-all shadow-sm disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeleting ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Standalone Modal wrapper for quick access from QuickTransactionModal
export const CategoryManagerModal: React.FC = () => {
  const { isCategoryManagerOpen, setCategoryManagerOpen, soundEnabled } = useUIStore();
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isCategoryManagerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSound("click", soundEnabled);
        setCategoryManagerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCategoryManagerOpen, setCategoryManagerOpen, soundEnabled]);

  if (!isCategoryManagerOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          playSound("click", soundEnabled);
          setCategoryManagerOpen(false);
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="w-full max-w-3xl max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border border-white/[0.1] dark:border-white/[0.1] light:border-slate-200 bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between border-b border-white/[0.08] dark:border-white/[0.08] light:border-slate-200 px-5 py-4 bg-[var(--bg-canvas)]/30">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Category Settings
            </h3>
          </div>
          <button
            onClick={() => {
              playSound("click", soundEnabled);
              setCategoryManagerOpen(false);
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <CategoryManager isModal={true} onClose={() => setCategoryManagerOpen(false)} />
        </div>
      </div>
    </div>
  );
};
