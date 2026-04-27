// Editorial Command Center — Audit State Context
// Manages checklist item statuses with localStorage persistence

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { auditMeta, categories, Category, ChecklistItem, Status } from "@/lib/auditData";

type ReportFormat = "json" | "md";
type ScheduleFrequency = "off" | "daily" | "weekly";

interface RetestHistoryEntry {
  checkedAt: string;
  site: string;
  doneCount: number;
  todoCount: number;
  highTodoCount: number;
}

interface AuditContextValue {
  categories: Category[];
  targetSite: string;
  setTargetSite: (site: string) => void;
  updateItemStatus: (itemId: string, status: Status) => void;
  resetAll: () => void;
  downloadReport: (format: ReportFormat) => void;
  runRetest: (siteOverride?: string) => Promise<void>;
  scheduleFrequency: ScheduleFrequency;
  setScheduleFrequency: (value: ScheduleFrequency) => void;
  retestHistory: RetestHistoryEntry[];
  sendReportEmail: (email: string) => Promise<{ ok: boolean; message: string }>;
  isRetesting: boolean;
  retestProgress: number;
  lastRetestAt: string | null;
  auditDateLabel: string;
  retestNotes: string[];
  itemDiagnostics: Record<string, string[]>;
  totalItems: number;
  completedItems: number;
  overallProgress: number;
  weightedProgress: number;
}

const STORAGE_KEY = "seo-audit-tracker-v1";
const STORAGE_SITE_KEY = "seo-audit-target-site-v1";
const STORAGE_SCHEDULE_KEY = "seo-audit-schedule-v1";
const STORAGE_HISTORY_KEY = "seo-audit-history-v1";

function normalizeSiteInput(site: string): string {
  const trimmed = site.trim().replace(/\s+/g, "");
  if (!trimmed) return auditMeta.site;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return parsed.host.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  }
}

function loadFromStorage(): Record<string, Status> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveToStorage(statuses: Record<string, Status>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  } catch {}
}

function loadTargetSite(): string {
  try {
    const raw = localStorage.getItem(STORAGE_SITE_KEY);
    if (raw) return normalizeSiteInput(raw);
  } catch {}
  return auditMeta.site;
}

function loadScheduleFrequency(): ScheduleFrequency {
  try {
    const raw = localStorage.getItem(STORAGE_SCHEDULE_KEY);
    if (raw === "daily" || raw === "weekly" || raw === "off") return raw;
  } catch {}
  return "off";
}

function loadRetestHistory(): RetestHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as RetestHistoryEntry[];
  } catch {}
  return [];
}

const AuditContext = createContext<AuditContextValue | null>(null);

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [targetSite, setTargetSiteState] = useState(loadTargetSite);
  const [statuses, setStatuses] = useState<Record<string, Status>>(loadFromStorage);
  const [isRetesting, setIsRetesting] = useState(false);
  const [retestProgress, setRetestProgress] = useState(0);
  const [lastRetestAt, setLastRetestAt] = useState<string | null>(null);
  const [retestNotes, setRetestNotes] = useState<string[]>([]);
  const [itemDiagnostics, setItemDiagnostics] = useState<Record<string, string[]>>({});
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>(loadScheduleFrequency);
  const [retestHistory, setRetestHistory] = useState<RetestHistoryEntry[]>(loadRetestHistory);

  const auditDateLabel = lastRetestAt
    ? new Date(lastRetestAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : auditMeta.auditDate;

  useEffect(() => {
    saveToStorage(statuses);
  }, [statuses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SITE_KEY, targetSite);
    } catch {}
  }, [targetSite]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SCHEDULE_KEY, scheduleFrequency);
    } catch {}
  }, [scheduleFrequency]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(retestHistory));
    } catch {}
  }, [retestHistory]);

  const mergedCategories: Category[] = categories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => ({
      ...item,
      status: statuses[item.id] ?? item.status,
    })),
  }));

  const allItems: ChecklistItem[] = mergedCategories.flatMap((c) => c.items);
  const totalItems = allItems.length;
  const completedItems = allItems.filter((i) => i.status === "done").length;
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const weightedTotal = allItems.reduce((sum, item) => {
    const effort = item.effort ?? 3;
    const confidence = item.confidence ?? 3;
    const impact = priorityWeight[item.priority] ?? 1;
    return sum + (impact * confidence) / effort;
  }, 0);

  const weightedDone = allItems.reduce((sum, item) => {
    const effort = item.effort ?? 3;
    const confidence = item.confidence ?? 3;
    const impact = priorityWeight[item.priority] ?? 1;
    const base = (impact * confidence) / effort;
    const statusFactor = item.status === "done" ? 1 : item.status === "in-progress" ? 0.5 : 0;
    return sum + base * statusFactor;
  }, 0);

  const weightedProgress = weightedTotal > 0 ? Math.round((weightedDone / weightedTotal) * 100) : 0;

  const updateItemStatus = useCallback((itemId: string, status: Status) => {
    setStatuses((prev) => ({ ...prev, [itemId]: status }));
  }, []);

  const setTargetSite = useCallback((site: string) => {
    const normalized = normalizeSiteInput(site);
    if (normalized !== targetSite) {
      // Fresh slate for a new domain — don't carry over stale statuses
      setStatuses({});
      setRetestNotes([]);
      setItemDiagnostics({});
      setLastRetestAt(null);
    }
    setTargetSiteState(normalized);
  }, [targetSite]);

  const resetAll = useCallback(() => {
    setStatuses({});
    setRetestNotes([]);
    setItemDiagnostics({});
  }, []);

  const buildReport = useCallback(() => {
    return {
      meta: {
        site: targetSite,
        niche: auditMeta.niche,
        auditDate: auditDateLabel,
        exportedAt: new Date().toISOString(),
        lastRetestAt,
      },
      summary: {
        totalItems,
        completedItems,
        overallProgress,
        weightedProgress,
      },
      retestNotes,
      diagnostics: itemDiagnostics,
      categories: mergedCategories.map((category) => ({
        id: category.id,
        title: category.title,
        subtitle: category.subtitle,
        items: category.items.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          priority: item.priority,
          effort: item.effort ?? null,
          confidence: item.confidence ?? null,
          owner: item.owner ?? null,
          dueDate: item.dueDate ?? null,
          slaDays: item.slaDays ?? null,
          description: item.description,
          impact: item.impact,
          brokenUrl: item.brokenUrl ?? null,
          evidence: item.evidence ?? [],
          diagnostics: itemDiagnostics[item.id] ?? [],
        })),
      })),
    };
  }, [
    auditDateLabel,
    completedItems,
    itemDiagnostics,
    lastRetestAt,
    mergedCategories,
    overallProgress,
    retestNotes,
    targetSite,
    totalItems,
    weightedProgress,
  ]);

  const downloadReport = useCallback(
    (format: ReportFormat) => {
      const report = buildReport();

      const statusLabel: Record<Status, string> = {
        todo: "To Do",
        "in-progress": "In Progress",
        done: "Done",
      };

      const escapeMd = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
      const fileStamp = new Date().toISOString().slice(0, 10);

      let fileName = `seo-audit-report-${fileStamp}.json`;
      let mimeType = "application/json;charset=utf-8";
      let content = JSON.stringify(report, null, 2);

      if (format === "md") {
        fileName = `seo-audit-report-${fileStamp}.md`;
        mimeType = "text/markdown;charset=utf-8";

        const lines: string[] = [
          `# SEO Audit Report`,
          "",
          `- Site: ${targetSite}`,
          `- Niche: ${auditMeta.niche}`,
          `- Audit Date: ${auditDateLabel}`,
          `- Last Retest: ${lastRetestAt ? new Date(lastRetestAt).toLocaleString() : "Not retested yet"}`,
          `- Exported At: ${new Date().toLocaleString()}`,
          "",
          `## Summary`,
          "",
          `- Progress: ${overallProgress}%`,
          `- Weighted Progress: ${weightedProgress}%`,
          `- Completed: ${completedItems}/${totalItems}`,
          "",
        ];

        if (retestNotes.length > 0) {
          lines.push("## Retest Notes", "");
          for (const note of retestNotes) {
            lines.push(`- ${note}`);
          }
          lines.push("");
        }

        if (Object.keys(itemDiagnostics).length > 0) {
          lines.push("## Item Diagnostics", "");
          for (const [itemId, diag] of Object.entries(itemDiagnostics)) {
            if (diag.length === 0) continue;
            lines.push(`### ${itemId}`, "");
            for (const entry of diag) {
              lines.push(`- ${entry}`);
            }
            lines.push("");
          }
        }

        for (const category of mergedCategories) {
          lines.push(`## ${category.title}`, "", `_${category.subtitle}_`, "");
          lines.push("| Item | Status | Priority | Owner | Due | I/E/C |", "| --- | --- | --- | --- | --- | --- |");
          for (const item of category.items) {
            lines.push(
              `| ${escapeMd(item.title)} | ${statusLabel[item.status]} | ${item.priority} | ${item.owner ?? "-"} | ${item.dueDate ?? "-"} | ${item.priority === "high" ? 3 : item.priority === "medium" ? 2 : 1}/${item.effort ?? 3}/${item.confidence ?? 3} |`
            );
          }
          lines.push("");
        }

        content = lines.join("\n");
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    [
      buildReport,
      completedItems,
      overallProgress,
      retestNotes,
      targetSite,
      totalItems,
      weightedProgress,
    ]
  );

  const sendReportEmail = useCallback(async (email: string) => {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      return { ok: false, message: "Please enter a valid email address." };
    }

    try {
      const res = await fetch("/api/report-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleaned,
          report: buildReport(),
        }),
      });

      const payload = (await res.json()) as { ok?: boolean; message?: string; error?: string; sent?: boolean };

      if (!res.ok) {
        return { ok: false, message: payload.error ?? `Email request failed (${res.status}).` };
      }

      return { ok: true, message: payload.message ?? "Report request recorded." };
    } catch {
      return { ok: false, message: "Email request failed. Please try again." };
    }
  }, [buildReport]);

  const runRetest = useCallback(async (siteOverride?: string) => {
    if (isRetesting) return;
    const site = siteOverride ? normalizeSiteInput(siteOverride) : targetSite;
    setIsRetesting(true);
    setRetestProgress(5);
    setRetestNotes([]);

    let progress = 5;
    const interval = setInterval(() => {
      progress += Math.random() * 10 + 3;
      if (progress >= 80) {
        clearInterval(interval);
        setRetestProgress(80);
        return;
      }
      setRetestProgress(Math.round(progress));
    }, 350);

    try {
      const res = await fetch("/api/retest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site }),
      });

      if (!res.ok) {
        throw new Error(`Retest failed (${res.status})`);
      }

      const data = (await res.json()) as {
        statuses?: Record<string, Status>;
        checkedAt?: string;
        notes?: string[];
        diagnostics?: Record<string, string[]>;
      };

      if (data.statuses) {
        let resolvedStatuses: Record<string, Status> | null = null;
        setStatuses((prev) => {
          resolvedStatuses = { ...prev, ...data.statuses };
          return resolvedStatuses;
        });

        if (resolvedStatuses) {
          const all = categories.flatMap((c) => c.items);
          const doneCount = all.filter((i) => resolvedStatuses?.[i.id] === "done").length;
          const todoCount = all.length - doneCount;
          const highTodoCount = all.filter((i) => i.priority === "high" && resolvedStatuses?.[i.id] !== "done").length;
          setRetestHistory((prev) => [
            {
              checkedAt: data.checkedAt ?? new Date().toISOString(),
              site,
              doneCount,
              todoCount,
              highTodoCount,
            },
            ...prev,
          ].slice(0, 30));
        }
      }

      clearInterval(interval);
      setRetestProgress(100);
      setTimeout(() => setRetestProgress(0), 1200);

      setLastRetestAt(data.checkedAt ?? new Date().toISOString());
      setRetestNotes(Array.isArray(data.notes) ? data.notes : []);
      setItemDiagnostics(
        data.diagnostics && typeof data.diagnostics === "object" ? data.diagnostics : {}
      );
    } catch (err) {
      clearInterval(interval);
      setRetestProgress(0);
      const message = err instanceof Error ? err.message : "Retest failed";
      setRetestNotes([message]);
      setItemDiagnostics({});
    } finally {
      setIsRetesting(false);
    }
  }, [isRetesting, targetSite]);

  useEffect(() => {
    if (scheduleFrequency === "off") return;
    const thresholdMs = scheduleFrequency === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    const timer = setInterval(() => {
      if (isRetesting) return;
      const last = lastRetestAt ? new Date(lastRetestAt).getTime() : 0;
      if (Date.now() - last >= thresholdMs) {
        void runRetest();
      }
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, [isRetesting, lastRetestAt, runRetest, scheduleFrequency]);

  return (
    <AuditContext.Provider
      value={{
        categories: mergedCategories,
        targetSite,
        setTargetSite,
        updateItemStatus,
        resetAll,
        downloadReport,
        sendReportEmail,
        runRetest,
        scheduleFrequency,
        setScheduleFrequency,
        retestHistory,
        isRetesting,
        retestProgress,
        lastRetestAt,
        auditDateLabel,
        retestNotes,
        itemDiagnostics,
        totalItems,
        completedItems,
        overallProgress,
        weightedProgress,
      }}
    >
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used within AuditProvider");
  return ctx;
}
