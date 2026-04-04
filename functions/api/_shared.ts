type AuditStatus = "todo" | "in-progress" | "done";

export interface RetestPayload {
  statuses: Record<string, AuditStatus>;
  checkedAt: string;
  notes: string[];
  diagnostics: Record<string, string[]>;
}

interface SitemapAuditResult {
  entries: Array<{ url: string; lastmod: string | null }>;
  duplicateUrls: string[];
  sitemapWarnings: string[];
}

interface PageSpeedResult {
  strategy: "mobile" | "desktop";
  performanceScore: number;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  renderBlockingSavingsMs: number | null;
  unusedJsSavingsBytes: number | null;
}

interface CompetitorSnapshot {
  title: string;
  heading: string;
  sampleH2: string;
}

interface CompetitorBaseline {
  [url: string]: CompetitorSnapshot;
}

const competitorBaselineMemory: CompetitorBaseline = {};

export interface WorkerEnv {
  PAGE_SPEED_API_KEY?: string;
  RESEND_API_KEY?: string;
  REPORT_FROM_EMAIL?: string;
  SEO_COMPETITOR_MONITORING?: string;
}

function normalizePath(urlValue: string): string | null {
  if (!urlValue) return null;
  if (urlValue.startsWith("mailto:") || urlValue.startsWith("tel:") || urlValue.startsWith("javascript:")) {
    return null;
  }
  try {
    const parsed = new URL(urlValue, "https://placeholder.local");
    const pathPart = parsed.pathname || "/";
    const normalized = `${pathPart}${parsed.search || ""}`;
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  } catch {
    return null;
  }
}

function extractInternalPaths(html: string, base: string): string[] {
  const matches = html.matchAll(/href\s*=\s*["']([^"']+)["']/gi);
  const out = new Set<string>();
  const baseHost = new URL(base).host;

  for (const match of matches) {
    const href = match[1]?.trim();
    if (!href || href.startsWith("#")) continue;

    try {
      const fullUrl = new URL(href, base);
      if (fullUrl.host !== baseHost) continue;
      const normalized = normalizePath(fullUrl.toString());
      if (!normalized || normalized === "//") continue;
      out.add(normalized);
    } catch {
      // ignore malformed URLs
    }
  }

  return [...out];
}

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; html: string }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "seo-audit-tracker/1.0",
      },
    });
    const html = await res.text();
    return { ok: res.ok, status: res.status, html };
  } catch {
    return { ok: false, status: 0, html: "" };
  }
}

async function fetchPageSpeed(url: string, strategy: "mobile" | "desktop", env: WorkerEnv): Promise<{ ok: boolean; data?: PageSpeedResult; error?: string }> {
  try {
    const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("strategy", strategy);
    endpoint.searchParams.set("category", "performance");
    if (env.PAGE_SPEED_API_KEY) endpoint.searchParams.set("key", env.PAGE_SPEED_API_KEY);

    const res = await fetch(endpoint.toString(), {
      headers: { "user-agent": "seo-audit-tracker/1.0" },
    });

    if (!res.ok) {
      return { ok: false, error: `PageSpeed request failed (${res.status}) for ${strategy}` };
    }

    const json = await res.json() as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number } };
        audits?: Record<string, { numericValue?: number }>;
      };
    };

    const audits = json.lighthouseResult?.audits ?? {};
    const score = json.lighthouseResult?.categories?.performance?.score;

    return {
      ok: true,
      data: {
        strategy,
        performanceScore: score != null ? Math.round(score * 100) : 0,
        lcpMs: audits["largest-contentful-paint"]?.numericValue ?? null,
        inpMs: audits["interaction-to-next-paint"]?.numericValue ?? null,
        cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
        tbtMs: audits["total-blocking-time"]?.numericValue ?? null,
        renderBlockingSavingsMs: audits["render-blocking-resources"]?.numericValue ?? null,
        unusedJsSavingsBytes: audits["unused-javascript"]?.numericValue ?? null,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown PSI error" };
  }
}

function extractTag(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const matched = html.match(regex)?.[1] ?? "";
  return matched.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractFirstHeading(html: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  return h1.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractFirstH2(html: string): string {
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "";
  return h2.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractCanonicalHref(html: string): string | null {
  const href = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i)?.[1]
    ?? null;
  return href?.trim() ?? null;
}

function extractMetaRobots(html: string): string {
  const value = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']robots["'][^>]*>/i)?.[1]
    ?? "";
  return value.toLowerCase();
}

function isPathDisallowed(pathname: string, disallowRules: string[]): boolean {
  for (const rule of disallowRules) {
    if (!rule || rule === "/") continue;
    if (pathname.startsWith(rule)) return true;
  }
  return false;
}

function parseIsoDateSafe(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ageInDays(fromDate: Date): number {
  const now = Date.now();
  return Math.floor((now - fromDate.getTime()) / (1000 * 60 * 60 * 24));
}

async function fetchSitemapAudit(base: string): Promise<SitemapAuditResult> {
  const candidates = [`${base}/sitemap_index.xml`, `${base}/sitemap.xml`];
  const queue = [...candidates];
  const visited = new Set<string>();
  const seenUrls = new Set<string>();
  const locCounts = new Map<string, number>();
  const out: Array<{ url: string; lastmod: string | null }> = [];
  const sitemapWarnings: string[] = [];
  const MAX_SITEMAPS = 16;
  const MAX_URLS = 120;

  while (queue.length > 0 && visited.size < MAX_SITEMAPS && out.length < MAX_URLS) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    const res = await fetchHtml(sitemapUrl);
    if (!res.ok) {
      sitemapWarnings.push(`${sitemapUrl} fetch failed (${res.status || "network-error"})`);
      continue;
    }

    const xml = res.html;
    const hasSitemapIndex = /<sitemapindex[\s>]/i.test(xml);
    const hasUrlEntries = /<url[\s>]/i.test(xml);
    if (!hasSitemapIndex && !hasUrlEntries) {
      sitemapWarnings.push(`${sitemapUrl} returned XML with no <url> or <sitemap> entries.`);
    }

    if (hasSitemapIndex) {
      const childSitemaps = [...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi)].slice(0, 30);
      for (const child of childSitemaps) {
        const chunk = child[1] ?? "";
        const loc = chunk.match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]?.trim();
        if (loc && !visited.has(loc)) queue.push(loc);
      }
    }

    const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].slice(0, 100);
    for (const entry of entries) {
      if (out.length >= MAX_URLS) break;
      const chunk = entry[1] ?? "";
      const loc = chunk.match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]?.trim();
      const lastmod = chunk.match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim() ?? null;
      if (!loc) continue;
      locCounts.set(loc, (locCounts.get(loc) ?? 0) + 1);
      if (seenUrls.has(loc)) continue;
      seenUrls.add(loc);
      out.push({ url: loc, lastmod });
    }
  }

  const duplicateUrls = [...locCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([loc, count]) => `${loc} appears ${count} times across sitemap files`);

  return {
    entries: out,
    duplicateUrls,
    sitemapWarnings: sitemapWarnings.slice(0, 10),
  };
}

async function collectUnderlinkedPages(base: string, seedHtml: string): Promise<string[]> {
  const rootPath = normalizePath(base) || "/";
  const queue = extractInternalPaths(seedHtml, base).slice(0, 18);
  const visited = new Set<string>([rootPath]);
  const inbound = new Map<string, number>();
  inbound.set(rootPath, 1);

  for (const pathValue of queue) {
    inbound.set(pathValue, (inbound.get(pathValue) ?? 0) + 1);
  }

  for (const pagePath of queue) {
    if (visited.has(pagePath)) continue;
    visited.add(pagePath);

    const page = await fetchHtml(new URL(pagePath, base).toString());
    if (!page.ok) continue;

    const links = extractInternalPaths(page.html, base).slice(0, 25);
    for (const targetPath of links) {
      inbound.set(targetPath, (inbound.get(targetPath) ?? 0) + 1);
    }
  }

  return [...inbound.entries()]
    .filter(([pathValue, count]) => {
      if (pathValue === rootPath || count > 1) return false;
      if (pathValue.startsWith("/wp-json")) return false;
      if (pathValue.includes("/feed/")) return false;
      if (pathValue.includes("?")) return false;
      return true;
    })
    .sort((a, b) => a[1] - b[1])
    .slice(0, 8)
    .map(([pathValue, count]) => `${new URL(pathValue, base).toString()} (internal links: ${count})`);
}

function readCompetitorBaseline(): CompetitorBaseline {
  return { ...competitorBaselineMemory };
}

function writeCompetitorBaseline(value: CompetitorBaseline) {
  for (const key of Object.keys(competitorBaselineMemory)) {
    delete competitorBaselineMemory[key];
  }
  Object.assign(competitorBaselineMemory, value);
}

export async function inspectPage(target: string) {
  const page = await fetchHtml(target);
  const html = page.html || "";
  const baseHost = (() => {
    try {
      return new URL(target).host;
    } catch {
      return "";
    }
  })();

  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter(Boolean);

  let internalLinks = 0;
  let externalLinks = 0;
  for (const href of links) {
    try {
      const u = new URL(href, target);
      if (u.host === baseHost) internalLinks += 1;
      else externalLinks += 1;
    } catch {
      // ignore malformed links
    }
  }

  return {
    status: page.status,
    title: extractTag(html, "title"),
    canonical: extractCanonicalHref(html),
    robotsMeta: extractMetaRobots(html),
    internalLinks,
    externalLinks,
  };
}

export async function sendReportEmailIfConfigured(env: WorkerEnv, input: {
  email: string;
  site?: string;
  report?: unknown;
}): Promise<{ sent: boolean; message: string }> {
  if (!env.RESEND_API_KEY || !env.REPORT_FROM_EMAIL) {
    return {
      sent: false,
      message: "Email delivery is not configured on this server yet. Request processed without storage.",
    };
  }

  const subject = `SEO Audit Report${input.site ? ` - ${input.site}` : ""}`;
  const reportJson = JSON.stringify(input.report ?? {}, null, 2).slice(0, 200000);
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">SEO Audit Report</h2>
      <p style="margin-top: 0;">Site: <strong>${input.site ?? "(unknown)"}</strong></p>
      <p>Report payload is attached below for quick reference.</p>
      <pre style="white-space: pre-wrap; background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; font-size: 12px;">${reportJson
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.REPORT_FROM_EMAIL,
      to: [input.email],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      sent: false,
      message: `Email provider rejected request (${response.status}). ${text.slice(0, 120)}`,
    };
  }

  return {
    sent: true,
    message: "Report email sent successfully.",
  };
}

export async function runAutomatedRetest(site: string, env: WorkerEnv): Promise<RetestPayload> {
  const base = site.startsWith("http") ? site : `https://${site}`;
  const notes: string[] = [];
  const statuses: Record<string, AuditStatus> = {};
  const diagnostics: Record<string, string[]> = {};

  const [home, about] = await Promise.all([
    fetchHtml(base),
    fetchHtml(`${base}/about`),
  ]);

  const psiResults = await Promise.all([
    fetchPageSpeed(base, "mobile", env),
    fetchPageSpeed(base, "desktop", env),
  ]);

  const psiOk = psiResults.filter((r) => r.ok && r.data).map((r) => r.data as PageSpeedResult);
  const psiErrors = psiResults.filter((r) => !r.ok).map((r) => r.error ?? "Unknown PSI error");
  const hasPageSpeedKey = Boolean(env.PAGE_SPEED_API_KEY);

  if (psiOk.length > 0) {
    const cwvIssues: string[] = [];
    const renderIssues: string[] = [];

    for (const r of psiOk) {
      const prefix = `[${r.strategy}]`;
      if (r.performanceScore < 80) cwvIssues.push(`${prefix} performance score ${r.performanceScore} (target >= 80)`);
      if (r.lcpMs != null && r.lcpMs > 2500) cwvIssues.push(`${prefix} LCP ${Math.round(r.lcpMs)}ms (target <= 2500ms)`);
      if (r.inpMs != null && r.inpMs > 200) cwvIssues.push(`${prefix} INP ${Math.round(r.inpMs)}ms (target <= 200ms)`);
      if (r.cls != null && r.cls > 0.1) cwvIssues.push(`${prefix} CLS ${r.cls.toFixed(3)} (target <= 0.100)`);

      if (r.renderBlockingSavingsMs != null && r.renderBlockingSavingsMs > 200) {
        renderIssues.push(`${prefix} render-blocking opportunity ${Math.round(r.renderBlockingSavingsMs)}ms`);
      }
      if (r.unusedJsSavingsBytes != null && r.unusedJsSavingsBytes > 50_000) {
        renderIssues.push(`${prefix} unused JS ${Math.round(r.unusedJsSavingsBytes / 1024)}KB`);
      }
      if (r.tbtMs != null && r.tbtMs > 300) {
        renderIssues.push(`${prefix} total blocking time ${Math.round(r.tbtMs)}ms`);
      }
    }

    diagnostics["perf-1"] = cwvIssues;
    statuses["perf-1"] = cwvIssues.length === 0 ? "done" : "todo";
    diagnostics["perf-2"] = [...renderIssues, ...psiErrors];
    statuses["perf-2"] = diagnostics["perf-2"].length === 0 ? "done" : "todo";
  } else {
    diagnostics["perf-1"] = [
      hasPageSpeedKey
        ? "PageSpeed Insights data is currently unavailable for this site."
        : "PageSpeed API key is not configured. Core Web Vitals checks are marked in-progress.",
      ...psiErrors,
    ];
    diagnostics["perf-2"] = [...diagnostics["perf-1"]];
    statuses["perf-1"] = "in-progress";
    statuses["perf-2"] = "in-progress";
  }

  if (!home.ok) {
    notes.push(`Home page fetch failed with status ${home.status || "network-error"}.`);
  }

  const methodologyPaths = [
    "/our-review-methodology/",
    "/review-methodology/",
    "/methodology/",
    "/how-we-review/",
    "/how-we-test/",
    "/editorial-process/",
  ];
  let methodologyFound: string | null = null;
  for (const mp of methodologyPaths) {
    const r = await fetchHtml(`${base}${mp}`);
    if (r.ok) {
      methodologyFound = mp;
      break;
    }
  }
  statuses["eeat-2"] = methodologyFound ? "done" : "todo";

  const brokenLinks: string[] = [];
  if (home.ok) {
    const internalPaths = extractInternalPaths(home.html, base).slice(0, 30);
    const probeResults = await Promise.all(
      internalPaths.map(async (p) => {
        const url = new URL(p, base).toString();
        const r = await fetchHtml(url);
        return !r.ok && r.status >= 400 ? `${url} (${r.status})` : null;
      })
    );
    brokenLinks.push(...probeResults.filter((r): r is string => r !== null));
  }

  diagnostics["tech-1"] = brokenLinks;
  statuses["tech-1"] = brokenLinks.length === 0 ? "done" : "todo";

  const homeLower = home.html.toLowerCase();
  const aboutLower = about.html.toLowerCase();

  statuses["eeat-4"] = homeLower.includes("affiliate") ? "done" : "todo";
  statuses["eeat-5"] = homeLower.includes("last updated") ? "done" : "todo";

  const hasTeamSignals =
    aboutLower.includes("editorial") ||
    aboutLower.includes("our team") ||
    aboutLower.includes("mission") ||
    aboutLower.includes("about us");
  statuses["eeat-3"] = hasTeamSignals ? "done" : "todo";

  const hasLdJson = homeLower.includes("application/ld+json");
  const hasReviewSchema = homeLower.includes("\"@type\":\"review\"") || homeLower.includes("\"@type\":\"softwareapplication\"");
  const hasFaqSchema = homeLower.includes("\"@type\":\"faqpage\"");

  statuses["tech-4"] = hasLdJson && hasReviewSchema ? "done" : "todo";
  statuses["tech-5"] = hasLdJson && hasFaqSchema ? "done" : "todo";

  if (home.ok) {
    const underlinkedCandidates = await collectUnderlinkedPages(base, home.html);
    diagnostics["links-1"] = underlinkedCandidates;
    statuses["links-1"] = underlinkedCandidates.length === 0 ? "done" : "todo";
  }

  const sitemapAudit = await fetchSitemapAudit(base);
  const sitemapEntries = sitemapAudit.entries;

  const crawlCoverageIssues: string[] = [];
  if (sitemapEntries.length === 0) {
    crawlCoverageIssues.push("No parseable sitemap entries found at /sitemap.xml or /sitemap_index.xml.");
  } else {
    const host = new URL(base).host;
    const staleCount = sitemapEntries
      .map((entry) => (entry.lastmod ? parseIsoDateSafe(entry.lastmod) : null))
      .filter((d): d is Date => d !== null)
      .filter((d) => ageInDays(d) >= 180).length;
    const externalEntries = sitemapEntries.filter((entry) => {
      try {
        return new URL(entry.url).host !== host;
      } catch {
        return true;
      }
    }).length;

    if (externalEntries > 0) {
      crawlCoverageIssues.push(`${externalEntries} sitemap URL(s) point to a different host.`);
    }
    if (staleCount > Math.max(3, Math.floor(sitemapEntries.length * 0.35))) {
      crawlCoverageIssues.push(`${staleCount}/${sitemapEntries.length} sitemap URLs look stale (lastmod older than 180 days).`);
    }
  }
  crawlCoverageIssues.push(...sitemapAudit.duplicateUrls);
  crawlCoverageIssues.push(...sitemapAudit.sitemapWarnings);
  diagnostics["crawl-1"] = crawlCoverageIssues;
  statuses["crawl-1"] = crawlCoverageIssues.length === 0 ? "done" : "todo";

  const crawlSignalConflicts: string[] = [];
  const robots = await fetchHtml(`${base}/robots.txt`);
  const disallowRules = robots.ok
    ? robots.html
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^disallow\s*:/i.test(line))
      .map((line) => line.split(":")[1]?.trim() ?? "")
      .filter(Boolean)
    : [];

  const samples = sitemapEntries.slice(0, 12);
  for (const entry of samples) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(entry.url);
    } catch {
      crawlSignalConflicts.push(`Invalid sitemap URL: ${entry.url}`);
      continue;
    }

    if (isPathDisallowed(parsedUrl.pathname, disallowRules)) {
      crawlSignalConflicts.push(`${entry.url} is listed in sitemap but blocked by robots.txt`);
      continue;
    }

    const page = await fetchHtml(entry.url);
    if (!page.ok) continue;

    const robotsMeta = extractMetaRobots(page.html);
    if (robotsMeta.includes("noindex")) {
      crawlSignalConflicts.push(`${entry.url} has meta robots noindex but is present in sitemap`);
    }

    const canonical = extractCanonicalHref(page.html);
    if (canonical) {
      try {
        const normalizedCanonical = new URL(canonical, entry.url).toString();
        const normalizedSelf = new URL(entry.url).toString();
        if (normalizedCanonical !== normalizedSelf) {
          crawlSignalConflicts.push(`${entry.url} canonical points to ${normalizedCanonical}`);
        }
      } catch {
        crawlSignalConflicts.push(`${entry.url} has invalid canonical URL (${canonical})`);
      }
    }
  }

  diagnostics["crawl-2"] = crawlSignalConflicts.slice(0, 10);
  statuses["crawl-2"] = crawlSignalConflicts.length === 0 ? "done" : "todo";

  if (sitemapEntries.length > 0) {
    const staleEntries = sitemapEntries
      .map((entry) => {
        const parsed = entry.lastmod ? parseIsoDateSafe(entry.lastmod) : null;
        const ageDays = parsed ? ageInDays(parsed) : 9999;
        const decayScore = Math.min(100, Math.round((ageDays / 365) * 100));
        return {
          ...entry,
          ageDays,
          decayScore,
        };
      })
      .filter((entry) => entry.ageDays >= 180)
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 8)
      .map((entry) => `${entry.url} (last updated ${entry.ageDays}d ago, decay score ${entry.decayScore})`);

    diagnostics["future-2"] = staleEntries;
    statuses["future-2"] = staleEntries.length === 0 ? "done" : "todo";
  } else {
    diagnostics["future-2"] = ["No sitemap URL entries could be parsed for decay scoring."];
    statuses["future-2"] = "todo";
  }

  const competitorMonitoringEnabled = env.SEO_COMPETITOR_MONITORING === "1";
  if (competitorMonitoringEnabled) {
    const competitorTargets = [
      "https://www.techradar.com/best/best-ai-tools",
      "https://zapier.com/blog/best-ai-productivity-tools/",
      "https://www.tomsguide.com/ai/best-ai-tools",
    ];
    const previousBaseline = readCompetitorBaseline();
    const nextBaseline: CompetitorBaseline = { ...previousBaseline };
    const competitorFindings: string[] = [];
    let changeCount = 0;

    for (const target of competitorTargets) {
      const page = await fetchHtml(target);
      if (!page.ok) {
        competitorFindings.push(`${target} (unreachable: ${page.status || "network-error"})`);
        continue;
      }

      const snapshot: CompetitorSnapshot = {
        title: extractTag(page.html, "title"),
        heading: extractFirstHeading(page.html),
        sampleH2: extractFirstH2(page.html),
      };

      const prev = previousBaseline[target];
      if (!prev) {
        competitorFindings.push(`${target} (baseline created)`);
      } else {
        const changedFields: string[] = [];
        if (prev.title !== snapshot.title) changedFields.push("title");
        if (prev.heading !== snapshot.heading) changedFields.push("h1");
        if (prev.sampleH2 !== snapshot.sampleH2) changedFields.push("h2");

        if (changedFields.length > 0) {
          changeCount += 1;
          competitorFindings.push(`${target} (changed: ${changedFields.join(", ")})`);
        }
      }

      nextBaseline[target] = snapshot;
    }

    writeCompetitorBaseline(nextBaseline);
    diagnostics["future-4"] = competitorFindings;
    statuses["future-4"] = changeCount === 0 ? "done" : "todo";
  } else {
    statuses["future-4"] = "done";
    diagnostics["future-4"] = [];
  }

  return {
    statuses,
    checkedAt: new Date().toISOString(),
    notes,
    diagnostics,
  };
}
