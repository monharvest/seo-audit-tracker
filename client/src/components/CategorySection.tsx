// Editorial Command Center — Category Section
// Design: thick top border, serif heading, amber progress bar

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Code,
  FileText,
  Layout,
  Search,
  Gauge,
  Link2,
  Layers3,
  Network,
  BarChart3,
  Bot,
  ClipboardList,
  Files,
  PlugZap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import { Category } from "@/lib/auditData";
import { ChecklistItemCard } from "./ChecklistItemCard";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Code,
  FileText,
  Layout,
  Search,
  Gauge,
  Link2,
  Layers3,
  Network,
  BarChart3,
  Bot,
  ClipboardList,
  Files,
  PlugZap,
};

interface CategorySectionProps {
  category: Category;
  isActive: boolean;
}

export function CategorySection({ category, isActive }: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const handleJump = (event: Event) => {
      const custom = event as CustomEvent<{ categoryId?: string; itemId?: string }>;
      if (custom.detail?.categoryId === category.id) {
        setCollapsed(false);
      }
    };

    window.addEventListener("audit-jump-to-item", handleJump as EventListener);
    return () => {
      window.removeEventListener("audit-jump-to-item", handleJump as EventListener);
    };
  }, [category.id]);

  const totalItems = category.items.length;
  const doneItems = category.items.filter((i) => i.status === "done").length;
  const inProgressItems = category.items.filter((i) => i.status === "in-progress").length;
  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const isComplete = doneItems === totalItems;

  const Icon = iconMap[category.icon] || Shield;

  return (
    <div
      id={`category-${category.id}`}
      className={`category-section mb-8 scroll-mt-6 ${isActive ? "ring-2 ring-amber-200 ring-offset-2 rounded-sm" : ""}`}
    >
      {/* Category Header */}
      <div
        className="flex items-start justify-between gap-4 py-4 cursor-pointer group"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-sm flex-shrink-0 mt-0.5 ${
              isComplete ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
            }`}
          >
            {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
          </div>
          <div>
            <h2
              className="text-lg font-bold text-gray-900 leading-tight group-hover:text-amber-700 transition-colors"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {category.title}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {category.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              {doneItems}/{totalItems}
            </p>
            <p className="text-xs text-gray-500">completed</p>
          </div>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : "bg-amber-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          {doneItems} done
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          {inProgressItems} in progress
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
          {totalItems - doneItems - inProgressItems} to do
        </span>
      </div>

      {/* Items */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            {category.items.map((item) => (
              <ChecklistItemCard key={item.id} item={item} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
