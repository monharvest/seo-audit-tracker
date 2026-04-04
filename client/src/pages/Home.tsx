// Editorial Command Center — Main Home Page
// Design: Warm off-white parchment + amber accent, Playfair Display headings
// Layout: Sticky left sidebar + scrollable main canvas

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { CategorySection } from "@/components/CategorySection";
import { useAudit } from "@/contexts/AuditContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { auditMeta } from "@/lib/auditData";
import { AlertCircle, TrendingUp, CheckSquare, Menu, X, ArrowUp } from "lucide-react";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/91669536/ccegjvaAzvKR2wfVRWYon7/hero-banner-XTqjDPugbWyjqvBzeGTAn8.webp";
const JUMP_EVENT = "audit-jump-to-item";

export default function Home() {
  const { categories, targetSite, overallProgress, completedItems, totalItems, auditDateLabel } = useAudit();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [activeCategory, setActiveCategory] = useState("eeat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHighPriorityList, setShowHighPriorityList] = useState(false);
  const [showGoUp, setShowGoUp] = useState(false);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const siteUrl = `https://${targetSite}`;

  const handleCategoryClick = (id: string) => {
    setActiveCategory(id);
    setSidebarOpen(false);
    const el = document.getElementById(`category-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Track active category on scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowGoUp(window.scrollY > 320);
      const catIds = categories.map((c) => c.id);
      for (const id of [...catIds].reverse()) {
        const el = document.getElementById(`category-${id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) {
            setActiveCategory(id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [categories]);

  const highPriorityRemaining = categories
    .flatMap((c) => c.items)
    .filter((i) => i.priority === "high" && i.status !== "done").length;

  const highPriorityFlagged = categories.flatMap((category) =>
    category.items
      .filter((item) => item.priority === "high" && item.status !== "done")
      .map((item) => ({
        id: item.id,
        title: item.title,
        categoryId: category.id,
        categoryTitle: category.title,
      }))
  );

  const jumpToItem = (categoryId: string, itemId: string) => {
    setActiveCategory(categoryId);
    setSidebarOpen(false);
    setShowHighPriorityList(false);
    window.dispatchEvent(new CustomEvent(JUMP_EVENT, { detail: { categoryId, itemId } }));
    const categoryEl = document.getElementById(`category-${categoryId}`);
    if (categoryEl) {
      categoryEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Give scroll time, then jump to the exact checklist item.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(JUMP_EVENT, { detail: { categoryId, itemId } }));
      const itemEl = document.getElementById(`item-${itemId}`);
      if (itemEl) {
        itemEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 220);
  };

  return (
    <div className="min-h-screen flex" style={{ background: "oklch(0.975 0.008 85)" }}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: sticky, mobile: drawer */}
      <div
        className={`fixed lg:sticky top-0 left-0 h-screen z-50 lg:z-auto transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar activeCategory={activeCategory} onCategoryClick={handleCategoryClick} />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30 border-b"
          style={{ background: "oklch(0.975 0.008 85)", borderColor: "oklch(0.88 0.012 85)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded text-gray-600 hover:text-amber-600 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
            {t("home.title")}
          </h1>
          <div className="text-xs font-semibold text-amber-600">{overallProgress}%</div>
        </div>

        {/* Hero Section */}
        <div className="relative overflow-hidden" style={{ minHeight: 280 }}>
          <img
            src={HERO_BG}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.55 }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(247,245,240,0.92) 40%, rgba(247,245,240,0.6) 100%)" }} />
          <div className="relative px-8 py-10 max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-sm"
                style={{ background: "oklch(0.72 0.16 65)", color: "white" }}
              >
                {t("home.report")}
              </span>
              <span className="text-[10px] text-gray-500 font-medium">{auditDateLabel}</span>
            </div>
            <h1
              className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-3"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t("home.heading")}
              <br />
              <span style={{ color: "oklch(0.72 0.16 65)" }}>{targetSite}</span>
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed max-w-xl mb-5">
              {auditMeta.executiveSummary}
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-sm"
                style={{ background: "rgba(255,255,255,0.8)", border: "1px solid oklch(0.88 0.012 85)" }}
              >
                <CheckSquare className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-xs text-gray-500">{t("home.progress")}</p>
                  <p className="text-sm font-bold text-gray-900">
                    {completedItems}/{totalItems} {t("home.tasks")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHighPriorityList((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-2 rounded-sm text-left transition-colors hover:bg-white"
                style={{ background: "rgba(255,255,255,0.8)", border: "1px solid oklch(0.88 0.012 85)" }}
                title={t("home.redFlagged")}
              >
                <AlertCircle className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-xs text-gray-500">{t("home.highPriority")}</p>
                  <p className="text-sm font-bold text-gray-900">{highPriorityRemaining} {t("home.remaining")}</p>
                </div>
              </button>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-sm"
                style={{ background: "rgba(255,255,255,0.8)", border: "1px solid oklch(0.88 0.012 85)" }}
              >
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-xs text-gray-500">{t("home.overallScore")}</p>
                  <p className="text-sm font-bold text-gray-900">{overallProgress}% {t("home.complete")}</p>
                </div>
              </div>
            </div>

            {showHighPriorityList && (
              <div
                className="mt-4 p-3 rounded-sm"
                style={{ background: "rgba(255,255,255,0.82)", border: "1px solid oklch(0.88 0.012 85)" }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-red-600 mb-2">
                  {t("home.redFlagged")}
                </p>
                {highPriorityFlagged.length === 0 ? (
                  <p className="text-xs text-emerald-700">{t("home.noRedFlags")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {highPriorityFlagged.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => jumpToItem(item.categoryId, item.id)}
                        className="w-full text-left px-2.5 py-2 rounded-sm bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
                      >
                        <p className="text-xs font-semibold text-red-700 leading-snug">{item.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{item.categoryTitle}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Executive Summary Banner */}
        <div
          className="mx-6 mt-6 p-4 rounded-sm flex items-start gap-3"
          style={{ background: "oklch(0.95 0.06 85)", border: "1px solid oklch(0.88 0.012 85)" }}
        >
          <div
            className="w-1 self-stretch rounded-full flex-shrink-0"
            style={{ background: "oklch(0.72 0.16 65)" }}
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-1">
              {t("home.auditorNote")}
            </p>
            <p className="text-xs text-gray-700 leading-relaxed">
              {t("home.noteBody")}
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed mt-1.5">
              {t("home.dataHandling")}
            </p>
            <button
              type="button"
              onClick={() => setLocation("/privacy-security")}
              className="mt-2 text-[11px] font-medium text-amber-700 hover:text-amber-800"
            >
              {t("home.readPolicy")}
            </button>
          </div>
        </div>

        {/* Checklist Categories */}
        <div className="px-6 py-6">
          {categories.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              isActive={activeCategory === cat.id}
            />
          ))}
        </div>

        {/* Footer */}
        <footer
          className="px-6 py-8 mt-4 border-t text-center"
          style={{ borderColor: "oklch(0.88 0.012 85)" }}
        >
          <p className="text-xs text-gray-400">
            {t("home.auditFor", { site: targetSite, date: auditDateLabel, auditor: auditMeta.auditor })}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {t("home.localSave")}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:underline"
            >
              {targetSite}
            </a>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            <button type="button" onClick={() => setLocation("/privacy-security")} className="text-amber-600 hover:underline">{t("home.policyInfo")}</button>
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <a href="/privacy-security#privacy" className="text-amber-600 hover:underline">Privacy</a>
            <span aria-hidden="true">|</span>
            <a href="/privacy-security#security" className="text-amber-600 hover:underline">Security</a>
            <span aria-hidden="true">|</span>
            <a href="/privacy-security#cookies" className="text-amber-600 hover:underline">Cookies</a>
            <span aria-hidden="true">|</span>
            <a href="/privacy-security#terms" className="text-amber-600 hover:underline">Terms</a>
          </div>
        </footer>
      </main>

      {showGoUp && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-40 lg:bottom-6 lg:right-6 w-10 h-10 rounded-full shadow-md border border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
          aria-label={t("home.goTop")}
          title={t("home.goTop")}
        >
          <ArrowUp className="w-4 h-4 mx-auto" />
        </button>
      )}
    </div>
  );
}
