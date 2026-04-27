// Editorial Command Center — Sidebar
// Design: warm parchment sidebar, progress ring, category nav with left-border active state

import {
  Shield,
  Code,
  FileText,
  Layout,
  RotateCcw,
  ExternalLink,
  Download,
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
  Mail,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ProgressRing } from "./ProgressRing";
import { useAudit } from "@/contexts/AuditContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { auditMeta } from "@/lib/auditData";

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

const navColors = [
  "text-red-500",
  "text-amber-500",
  "text-blue-500",
  "text-emerald-500",
  "text-indigo-500",
  "text-teal-500",
  "text-orange-500",
  "text-cyan-500",
  "text-pink-500",
  "text-violet-500",
  "text-lime-600",
  "text-rose-500",
  "text-sky-500",
  "text-fuchsia-500",
];

interface SidebarProps {
  activeCategory: string;
  onCategoryClick: (id: string) => void;
}

export function Sidebar({ activeCategory, onCategoryClick }: SidebarProps) {
  const { t } = useLanguage();
  const {
    categories,
    targetSite,
    setTargetSite,
    overallProgress,
    completedItems,
    totalItems,
    resetAll,
    downloadReport,
    runRetest,
    scheduleFrequency,
    setScheduleFrequency,
    retestHistory,
    sendReportEmail,
    isRetesting,
    retestProgress,
    lastRetestAt,
    auditDateLabel,
    retestNotes,
    health,
  } = useAudit();
  const [draftSite, setDraftSite] = useState(targetSite);
  const [email, setEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailMessageKind, setEmailMessageKind] = useState<"success" | "error" | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    setDraftSite(targetSite);
  }, [targetSite]);

  const siteUrl = `https://${targetSite}`;
  const recentHistory = retestHistory.slice(0, 7);
  const trendDelta = recentHistory.length >= 2
    ? recentHistory[0].doneCount - recentHistory[recentHistory.length - 1].doneCount
    : 0;

  const getCategoryProgress = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return 0;
    const done = cat.items.filter((i) => i.status === "done").length;
    return Math.round((done / cat.items.length) * 100);
  };

  const getCategoryDone = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return { done: 0, total: 0 };
    return { done: cat.items.filter((i) => i.status === "done").length, total: cat.items.length };
  };

  return (
    <aside
      className="w-72 flex-shrink-0 sticky top-0 h-screen overflow-y-auto"
      style={{ background: "oklch(0.965 0.01 85)", borderRight: "1px solid oklch(0.88 0.012 85)" }}
    >
      <div className="p-6">
        {/* Logo / Brand */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-7 h-7 rounded-sm flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "oklch(0.72 0.16 65)", fontFamily: "'Playfair Display', serif" }}
            >
              S
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{t("sidebar.brand")}</span>
          </div>
          <h1
            className="text-base font-bold text-gray-900 leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {targetSite}
          </h1>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 mt-0.5 transition-colors"
          >
            {targetSite} <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              value={draftSite}
              onChange={(e) => setDraftSite(e.target.value.replace(/\s+/g, ""))}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              inputMode="url"
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftSite.trim()) {
                  setTargetSite(draftSite);
                  void runRetest(draftSite);
                }
              }}
              placeholder="example.com"
              className="w-full rounded-sm border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 outline-none focus:border-amber-400"
            />
            <button
              disabled={isRetesting}
              onClick={() => {
                if (!draftSite.trim()) return;
                setTargetSite(draftSite);
                void runRetest(draftSite);
              }}
              className="px-2 py-1 text-[10px] rounded-sm bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("sidebar.go")}
            </button>
          </div>
          {/* Retest progress bar */}
          {retestProgress > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-amber-600 font-medium">
                  {retestProgress < 100 ? t("sidebar.crawling") : `${t("sidebar.done")} ✓`}
                </span>
                <span className="text-[10px] text-gray-400">{retestProgress}%</span>
              </div>
              <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    retestProgress >= 100 ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                  style={{ width: `${retestProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mb-6" />

        {/* Progress Ring */}
        <div className="flex flex-col items-center mb-6">
          <ProgressRing progress={overallProgress} size={96} strokeWidth={7} />
          <p className="text-xs text-gray-500 mt-2 text-center">
            {t("sidebar.tasksComplete", { done: completedItems, total: totalItems })}
          </p>
          {overallProgress === 100 && (
            <p className="text-xs text-emerald-600 font-semibold mt-1">🎉 {t("sidebar.auditComplete")}</p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mb-6" />

        {/* Category Navigation */}
        <nav>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">{t("sidebar.categories")}</p>
          <ul className="space-y-1">
            {categories.map((cat, index) => {
              const { done, total } = getCategoryDone(cat.id);
              const pct = getCategoryProgress(cat.id);
              const isActive = activeCategory === cat.id;
              const Icon = iconMap[cat.icon] || Shield;
              const color = navColors[index % navColors.length];

              return (
                <li key={cat.id}>
                  <button
                    onClick={() => onCategoryClick(cat.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-left transition-all group ${
                      isActive
                        ? "bg-amber-50 border-l-2 border-amber-500 text-amber-800"
                        : "hover:bg-white text-gray-700 border-l-2 border-transparent"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-amber-600" : color}`} />
                    <span className="text-xs font-medium flex-1 leading-tight">{cat.title}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {done}/{total}
                    </span>
                  </button>
                  {/* Mini progress bar */}
                  <div className="mx-3 h-0.5 bg-gray-200 rounded-full mt-0.5 mb-1">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct === 100 ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Divider */}
        <div className="border-t border-gray-200 my-6" />

        {/* Audit Meta */}
        <div className="text-xs text-gray-500 space-y-1.5">
          <p>
            <span className="font-medium text-gray-700">{t("sidebar.auditDate")}:</span> {auditDateLabel}
          </p>
          <p>
            <span className="font-medium text-gray-700">{t("sidebar.niche")}:</span> {auditMeta.niche}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-6" />

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("sidebar.automation")}</p>
          <label className="block text-[11px] text-gray-600 mb-1">{t("sidebar.autoRetest")}</label>
          <select
            value={scheduleFrequency}
            onChange={(e) => setScheduleFrequency(e.target.value as "off" | "daily" | "weekly")}
            className="w-full rounded-sm border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700 outline-none focus:border-amber-400"
          >
            <option value="off">{t("sidebar.off")}</option>
            <option value="daily">{t("sidebar.daily")}</option>
            <option value="weekly">{t("sidebar.weekly")}</option>
          </select>
          <p className="text-[10px] text-gray-400 mt-1">{t("sidebar.runsOpen")}</p>

          <div className="mt-2 p-2 rounded-sm bg-white border border-gray-200">
            <p className="text-[10px] text-gray-500">{t("sidebar.retestTrend")}</p>
            <p className={`text-xs font-semibold ${trendDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {trendDelta >= 0 ? `+${trendDelta}` : trendDelta} {t("sidebar.doneItems")}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("sidebar.emailReport")}</p>
          <div className="flex items-center gap-1.5">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-sm border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 outline-none focus:border-amber-400"
            />
            <button
              disabled={isSendingEmail}
              onClick={async () => {
                setIsSendingEmail(true);
                const result = await sendReportEmail(email);
                setEmailMessage(result.message);
                setEmailMessageKind(result.ok ? "success" : "error");
                if (result.ok) setEmail("");
                setIsSendingEmail(false);
              }}
              className="px-2.5 py-1 text-[10px] rounded-sm bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <Mail className="w-3 h-3" />
              {isSendingEmail ? t("sidebar.sending") : t("sidebar.send")}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{t("sidebar.emailHint")}</p>
          {emailMessage && (
            <p className={`text-[10px] mt-1 ${emailMessageKind === "error" ? "text-red-600" : "text-emerald-700"}`}>
              {emailMessage}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-6" />

        {/* Reset button */}
        <button
          onClick={() => {
            void runRetest();
          }}
          disabled={isRetesting}
          className="mb-2 flex items-center gap-2 text-xs text-gray-500 hover:text-amber-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className={`w-3 h-3 ${isRetesting ? "animate-spin" : ""}`} />
          {isRetesting ? t("sidebar.retesting") : t("sidebar.retestNow")}
        </button>

        {lastRetestAt && (
          <p className="text-[10px] text-gray-400 mb-2">
            {t("sidebar.lastRetest")}: {new Date(lastRetestAt).toLocaleString()}
          </p>
        )}

        {health && (
          <div className="mb-3 p-2 rounded border border-gray-200 bg-white">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">Site Health</span>
              <span
                className={`text-xs font-bold ${
                  health.grade === "A" ? "text-emerald-700"
                    : health.grade === "B" ? "text-emerald-600"
                    : health.grade === "C" ? "text-amber-600"
                    : health.grade === "D" ? "text-orange-600"
                    : "text-red-700"
                }`}
              >
                {health.score}/100 · {health.grade}
              </span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              <span className="text-red-700 font-semibold">{health.errors} errors</span>
              {" · "}
              <span className="text-amber-700 font-semibold">{health.warnings} warnings</span>
              {" · "}
              <span className="text-blue-700 font-semibold">{health.infos} info</span>
            </p>
          </div>
        )}

        {retestNotes.length > 0 && (
          <ul className="text-[10px] text-amber-700 mb-3 space-y-0.5 list-disc list-inside">
            {retestNotes.slice(0, 6).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => downloadReport("json")}
            className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-amber-700 transition-colors"
          >
            <Download className="w-3 h-3" />
            {t("sidebar.downloadJson")}
          </button>
          <button
            onClick={() => downloadReport("md")}
            className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-amber-700 transition-colors"
          >
            <Download className="w-3 h-3" />
            {t("sidebar.downloadMd")}
          </button>
        </div>

        <button
          onClick={() => {
            if (confirm(t("sidebar.resetConfirm"))) resetAll();
          }}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          {t("sidebar.resetAll")}
        </button>
      </div>
    </aside>
  );
}
