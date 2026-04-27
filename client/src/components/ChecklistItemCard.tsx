// Editorial Command Center — Checklist Item Card
// Design: thick left-border on active, ink-stamp animation on complete

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { ChecklistItem, priorityConfig, statusConfig, Status } from "@/lib/auditData";
import { useAudit } from "@/contexts/AuditContext";

interface ChecklistItemCardProps {
  item: ChecklistItem;
}

export function ChecklistItemCard({ item }: ChecklistItemCardProps) {
  const { updateItemStatus, itemDiagnostics } = useAudit();
  const [expanded, setExpanded] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [inspectLoading, setInspectLoading] = useState<string | null>(null);
  const [inspectResults, setInspectResults] = useState<Record<string, {
    status: number;
    title: string;
    canonical: string | null;
    robotsMeta: string;
    internalLinks: number;
    externalLinks: number;
  }>>({});
  const [inspectErrors, setInspectErrors] = useState<Record<string, string>>({});
  const diagnosticLinks = itemDiagnostics[item.id] ?? [];

  const extractUrlFromEntry = (entry: string): string | null => {
    const url = entry.match(/https?:\/\/\S+/i)?.[0] ?? null;
    if (!url) return null;
    return url.replace(/[),.;]+$/, "");
  };

  const severityStyle: Record<"error" | "warning" | "info", string> = {
    error: "text-red-700 bg-red-50 border-red-200",
    warning: "text-amber-800 bg-amber-50 border-amber-200",
    info: "text-blue-700 bg-blue-50 border-blue-200",
  };

  const severityLabel: Record<"error" | "warning" | "info", string> = {
    error: "ERROR",
    warning: "WARN",
    info: "INFO",
  };

  useEffect(() => {
    const handleJump = (event: Event) => {
      const custom = event as CustomEvent<{ categoryId?: string; itemId?: string }>;
      if (custom.detail?.itemId === item.id) {
        setExpanded(true);
      }
    };

    window.addEventListener("audit-jump-to-item", handleJump as EventListener);
    return () => {
      window.removeEventListener("audit-jump-to-item", handleJump as EventListener);
    };
  }, [item.id]);

  const priority = priorityConfig[item.priority];
  const statusInfo = statusConfig[item.status];
  const isDone = item.status === "done";
  const isInProgress = item.status === "in-progress";

  const handleStatusCycle = () => {
    const cycle: Status[] = ["todo", "in-progress", "done"];
    const currentIdx = cycle.indexOf(item.status);
    const nextStatus = cycle[(currentIdx + 1) % cycle.length];
    if (nextStatus === "done") {
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 600);
    }
    updateItemStatus(item.id, nextStatus);
  };

  return (
    <motion.div
      id={`item-${item.id}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`checklist-item ${isDone ? "completed" : ""} bg-white rounded-sm mb-2 overflow-hidden`}
      style={{
        boxShadow: "0 1px 3px rgba(26,26,24,0.06)",
        borderLeft: isDone
          ? "3px solid #22c55e"
          : isInProgress
          ? "3px solid #f59e0b"
          : "3px solid transparent",
      }}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          {/* Status toggle button */}
          <button
            onClick={handleStatusCycle}
            className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110 focus:outline-none"
            title={`Status: ${statusInfo.label} — click to advance`}
          >
            <AnimatePresence mode="wait">
              {isDone ? (
                <motion.span
                  key="done"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className={justCompleted ? "stamp-animate" : ""}
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </motion.span>
              ) : isInProgress ? (
                <motion.span
                  key="progress"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                >
                  <Clock className="w-5 h-5 text-amber-500" />
                </motion.span>
              ) : (
                <motion.span
                  key="todo"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                >
                  <Circle className="w-5 h-5 text-gray-300" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p
                className={`item-title font-medium text-sm leading-snug ${
                  isDone ? "line-through text-gray-400" : "text-gray-900"
                }`}
                style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
              >
                {item.title}
              </p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.color} ${priority.bg}`}
                >
                  {item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "🟢"}{" "}
                  {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color} ${statusInfo.bg}`}>
                  {statusInfo.label}
                </span>
              </div>
            </div>

            {item.brokenUrl && (
              <div className="mt-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                <code className="font-mono-editorial text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-xs">
                  {item.brokenUrl}
                </code>
              </div>
            )}

            <p className={`text-xs mt-1.5 leading-relaxed ${isDone ? "text-gray-400" : "text-gray-500"}`}>
              {item.description}
            </p>

            {/* Expand/collapse detail */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> How to fix
                </>
              )}
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded text-xs leading-relaxed text-gray-700">
                    <p className="font-semibold text-amber-800 mb-1.5 uppercase tracking-wide text-[10px]">
                      Action Steps
                    </p>
                    <p>{item.detail}</p>

                    {(diagnosticLinks.length > 0 || (item.evidence?.length ?? 0) > 0) && (
                      <div className="mt-2 pt-2 border-t border-amber-200">
                        <p className="font-semibold text-amber-800 uppercase tracking-wide text-[10px] mb-1">
                          Exact Affected Links
                        </p>
                        <div className="space-y-1">
                          {diagnosticLinks.map((entry) => {
                            const parsedUrl = extractUrlFromEntry(entry.message);
                            const data = parsedUrl ? inspectResults[parsedUrl] : undefined;
                            const error = parsedUrl ? inspectErrors[parsedUrl] : undefined;
                            return (
                              <div key={entry.message}>
                                <div
                                  className={`flex items-start gap-1.5 font-mono-editorial text-[11px] px-1.5 py-1 rounded border ${severityStyle[entry.severity]}`}
                                >
                                  <span className="font-bold text-[9px] mt-0.5 shrink-0">
                                    {severityLabel[entry.severity]}
                                  </span>
                                  <code className="block">{entry.message}</code>
                                </div>
                                {parsedUrl && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setInspectLoading(parsedUrl);
                                      setInspectErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[parsedUrl];
                                        return next;
                                      });
                                      try {
                                        const res = await fetch(`/api/page-inspect?url=${encodeURIComponent(parsedUrl)}`);
                                        if (!res.ok) throw new Error(`Inspect failed (${res.status})`);
                                        const payload = (await res.json()) as {
                                          status: number;
                                          title: string;
                                          canonical: string | null;
                                          robotsMeta: string;
                                          internalLinks: number;
                                          externalLinks: number;
                                        };
                                        setInspectResults((prev) => ({ ...prev, [parsedUrl]: payload }));
                                      } catch (e) {
                                        setInspectErrors((prev) => ({
                                          ...prev,
                                          [parsedUrl]: e instanceof Error ? e.message : "Inspect failed",
                                        }));
                                      } finally {
                                        setInspectLoading(null);
                                      }
                                    }}
                                    className="mt-1 text-[10px] text-amber-700 hover:text-amber-800 font-medium"
                                  >
                                    {inspectLoading === parsedUrl ? "Inspecting..." : "Inspect this URL"}
                                  </button>
                                )}

                                {error && <p className="text-[10px] text-red-600 mt-1">{error}</p>}
                                {data && (
                                  <div className="mt-1 p-2 rounded border border-amber-200 bg-white">
                                    <p className="text-[10px] text-gray-600"><strong>Status:</strong> {data.status}</p>
                                    <p className="text-[10px] text-gray-600"><strong>Title:</strong> {data.title || "(none)"}</p>
                                    <p className="text-[10px] text-gray-600"><strong>Canonical:</strong> {data.canonical ?? "(none)"}</p>
                                    <p className="text-[10px] text-gray-600"><strong>Robots:</strong> {data.robotsMeta || "(none)"}</p>
                                    <p className="text-[10px] text-gray-600"><strong>Links:</strong> {data.internalLinks} internal / {data.externalLinks} external</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {(item.evidence ?? []).map((entry) => (
                            <code key={entry} className="block font-mono-editorial text-[11px] text-amber-800 bg-amber-100 px-1.5 py-1 rounded">
                              {entry}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-amber-200">
                      <p className="font-semibold text-amber-800 uppercase tracking-wide text-[10px] mb-0.5">
                        Google Impact
                      </p>
                      <p className="text-amber-900">{item.impact}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
