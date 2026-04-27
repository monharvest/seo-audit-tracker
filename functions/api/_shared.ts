type AuditStatus = "todo" | "in-progress" | "done";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
}

export interface HealthScore {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  errors: number;
  warnings: number;
  infos: number;
}

export interface RetestPayload {
  statuses: Record<string, AuditStatus>;
  checkedAt: string;
  notes: string[];
  diagnostics: Record<string, Diagnostic[]>;
  health?: HealthScore;
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

interface AuditPageSample {
  url: string;
  html: string;
}

interface CompetitorBaseline {
  [url: string]: CompetitorSnapshot;
}

const competitorBaselineMemory: CompetitorBaseline = {};

const err = (message: string): Diagnostic => ({ severity: "error", message });
const warn = (message: string): Diagnostic => ({ severity: "warning", message });
const info = (message: string): Diagnostic => ({ severity: "info", message });

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
    const search = parsed.search || "";
    const lastSegment = pathPart.split("/").pop() ?? "";
    const looksLikeFile = /\.[a-z0-9]{1,8}$/i.test(lastSegment);
    const needsTrailingSlash = !looksLikeFile && !search && !pathPart.endsWith("/");
    return `${pathPart}${needsTrailingSlash ? "/" : ""}${search}`;
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

async function fetchHtml(url: string): Promise<{ ok: boolean; status: number; html: string; error?: string }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "seo-audit-tracker/1.0",
      },
    });
    const html = await res.text();
    return { ok: res.ok, status: res.status, html };
  } catch (firstError) {
    // Some runtimes or upstream WAF rules reject custom bot-like headers.
    // Retry without custom headers before marking as network failure.
    try {
      const res = await fetch(url, { redirect: "follow" });
      const html = await res.text();
      return { ok: res.ok, status: res.status, html };
    } catch (secondError) {
      const error = secondError instanceof Error
        ? secondError.message
        : firstError instanceof Error
          ? firstError.message
          : "Unknown fetch error";
      return { ok: false, status: 0, html: "", error };
    }
  }
}

async function fetchPageSpeed(url: string, strategy: "mobile" | "desktop", env: WorkerEnv): Promise<{ ok: boolean; data?: PageSpeedResult; error?: string }> {
  try {
    const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("strategy", strategy);
    endpoint.searchParams.set("category", "performance");
    if (env.PAGE_SPEED_API_KEY) endpoint.searchParams.set("key", env.PAGE_SPEED_API_KEY);

    let res: Response;
    try {
      res = await fetch(endpoint.toString(), {
        headers: { "user-agent": "seo-audit-tracker/1.0" },
      });
    } catch {
      // Retry without custom headers when environment forbids overriding User-Agent.
      res = await fetch(endpoint.toString());
    }

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

function extractSitemapHintsFromRobots(robotsTxt: string, base: string): string[] {
  const out: string[] = [];
  const lines = robotsTxt.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^sitemap\s*:\s*(.+)$/i);
    const candidate = match?.[1]?.trim();
    if (!candidate) continue;

    try {
      out.push(new URL(candidate, base).toString());
    } catch {
      // Ignore malformed sitemap URLs in robots.txt
    }
  }

  return out;
}

async function fetchSitemapAudit(base: string): Promise<SitemapAuditResult> {
  const robots = await fetchHtml(`${base}/robots.txt`);
  const robotsSitemaps = robots.ok ? extractSitemapHintsFromRobots(robots.html, base) : [];
  const candidates = [
    `${base}/sitemap_index.xml`,
    `${base}/sitemap.xml`,
    `${base}/sitemap-index.xml`,
    `${base}/sitemap.index.xml`,
    ...robotsSitemaps,
  ];
  const uniqueCandidates = [...new Set(candidates)];
  const rootCandidateSet = new Set(uniqueCandidates);
  const queue = [...uniqueCandidates];
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
      // Optional root fallback paths can legitimately 404 even when a valid sitemap exists.
      if (res.status === 404 && rootCandidateSet.has(sitemapUrl)) {
        continue;
      }
      const failureReason = res.status
        ? String(res.status)
        : res.error
          ? `network-error: ${res.error}`
          : "network-error";
      sitemapWarnings.push(`${sitemapUrl} fetch failed (${failureReason})`);
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

async function collectUnderlinkedPages(
  base: string,
  seedPages: Array<{ url: string; html: string }>,
): Promise<string[]> {
  const rootPath = normalizePath(base) || "/";
  const visited = new Set<string>();
  const inbound = new Map<string, number>();
  inbound.set(rootPath, 1);

  // Count inbound links from every seed page (homepage, /about, /contact, sample articles).
  // Sites typically place /contact, /disclaimer, /privacy in the footer — including those
  // pages as seeds prevents misclassifying footer-only links as orphans.
  for (const page of seedPages) {
    const seedPath = normalizePath(page.url) ?? rootPath;
    visited.add(seedPath);
    for (const targetPath of extractInternalPaths(page.html, base).slice(0, 40)) {
      inbound.set(targetPath, (inbound.get(targetPath) ?? 0) + 1);
    }
  }

  return [...inbound.entries()]
    .filter(([pathValue, count]) => {
      if (pathValue === rootPath || count > 1) return false;
      if (pathValue.startsWith("/wp-json")) return false;
      if (pathValue.startsWith("/wp-admin")) return false;
      if (pathValue.includes("/feed/")) return false;
      if (pathValue.includes("?")) return false;
      return true;
    })
    .sort((a, b) => a[1] - b[1])
    .slice(0, 8)
    .map(([pathValue, count]) => `${new URL(pathValue, base).toString()} (internal links: ${count})`);
}

function looksLikeContentPage(urlValue: string, base: string): boolean {
  try {
    const parsed = new URL(urlValue, base);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length !== 1) return false;

    const slug = pathParts[0].toLowerCase();
    if (
      [
        "about",
        "blog",
        "contact",
        "disclaimer",
        "privacy-policy",
        "review-methodology",
        "methodology",
        "sitemap",
        "wp-json",
        "wp-content",
        "xmlrpc.php",
      ].includes(slug)
    ) {
      return false;
    }

    return slug.includes("-") || slug.startsWith("best-");
  } catch {
    return false;
  }
}

function looksLikeReviewPage(sample: AuditPageSample): boolean {
  try {
    const slug = new URL(sample.url).pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
    const lower = sample.html.toLowerCase();
    return slug.startsWith("best-") || slug.includes("review") || lower.includes("review");
  } catch {
    return false;
  }
}

async function collectAuditPageSamples(
  base: string,
  home: { ok: boolean; html: string },
  sitemapEntries: Array<{ url: string; lastmod: string | null }> = []
): Promise<AuditPageSample[]> {
  const candidates = new Set<string>();

  for (const entry of sitemapEntries) {
    if (looksLikeContentPage(entry.url, base)) candidates.add(new URL(entry.url, base).toString());
    if (candidates.size >= 8) break;
  }

  if (home.ok) {
    for (const pathValue of extractInternalPaths(home.html, base)) {
      const url = new URL(pathValue, base).toString();
      if (looksLikeContentPage(url, base)) candidates.add(url);
      if (candidates.size >= 8) break;
    }
  }

  const samples: AuditPageSample[] = [];
  for (const url of [...candidates].slice(0, 6)) {
    const page = await fetchHtml(url);
    if (page.ok) samples.push({ url, html: page.html });
  }

  return samples;
}

function hasSchemaType(html: string, schemaTypes: string[]): boolean {
  return schemaTypes.some((type) => {
    const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`"@type"\\s*:\\s*"${escapedType}"`, "i").test(html);
  });
}

function hasAffiliateDisclosure(html: string): boolean {
  const lower = html.toLowerCase();
  return lower.includes("affiliate") || lower.includes("commission");
}

function hasFreshnessSignal(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("last updated") ||
    lower.includes("updated on") ||
    lower.includes("date modified") ||
    /"datemodified"\s*:/i.test(html) ||
    /property=["']article:modified_time["']/i.test(html)
  );
}

// WordPress and Cloudflare internals that legitimately 4xx — flagging them as broken is noise.
const BROKEN_LINK_SKIP_PATTERNS = [
  /\/xmlrpc\.php(\?|$|\/)/i,
  /\/wp-json(\/|$)/i,
  /\/wp-admin(\/|$)/i,
  /\/cdn-cgi\/l\/email-protection/i,
];

function shouldSkipBrokenLinkProbe(url: string): boolean {
  return BROKEN_LINK_SKIP_PATTERNS.some((re) => re.test(url));
}

type LinkProbeResult =
  | { url: string; kind: "ok"; status: number }
  | { url: string; kind: "broken"; status: number }
  | { url: string; kind: "redirect"; status: number; location: string };

async function probeInternalLink(url: string): Promise<LinkProbeResult> {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "seo-audit-tracker/1.0" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location") ?? "";
      return { url, kind: "redirect", status: res.status, location: loc };
    }
    if (res.status >= 400) {
      return { url, kind: "broken", status: res.status };
    }
    return { url, kind: "ok", status: res.status };
  } catch {
    return { url, kind: "ok", status: 0 };
  }
}

function extractMetaDescription(html: string): string {
  const m =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);
  return (m?.[1] ?? "").trim();
}

function countH1(html: string): number {
  return [...html.matchAll(/<h1[\s>]/gi)].length;
}

function hasAuthorByline(html: string): boolean {
  if (/<meta[^>]+name=["']author["']/i.test(html)) return true;
  if (/"@type"\s*:\s*"Person"/i.test(html)) return true;
  if (/"author"\s*:\s*[\{\[]/i.test(html)) return true;
  const visible = html.replace(/<[^>]+>/g, " ");
  if (/\bby\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\b/.test(visible)) return true;
  return false;
}

const STOCK_IMAGE_DOMAINS = [
  "images.unsplash.com",
  "unsplash.com",
  "images.pexels.com",
  "pexels.com",
  "shutterstock.com",
  "istockphoto.com",
  "gettyimages.com",
  "freepik.com",
  "depositphotos.com",
  "stock.adobe.com",
  "dreamstime.com",
  "123rf.com",
];

function findStockImageUrls(html: string): string[] {
  const out: string[] = [];
  const matches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
  for (const m of matches) {
    const src = m[1];
    if (!src) continue;
    try {
      const host = new URL(src, "https://placeholder.local").host.toLowerCase();
      if (STOCK_IMAGE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
        out.push(src);
      }
    } catch {
      // ignore malformed src
    }
  }
  return out;
}

function countImagesMissingAlt(html: string): number {
  let missing = 0;
  const matches = html.matchAll(/<img\b([^>]*)>/gi);
  for (const m of matches) {
    const attrs = m[1] ?? "";
    // Skip decorative images that explicitly opt out
    if (/role=["']presentation["']/i.test(attrs)) continue;
    if (/aria-hidden=["']true["']/i.test(attrs)) continue;
    if (!/\balt\s*=\s*["'][^"']/i.test(attrs)) {
      missing += 1;
    }
  }
  return missing;
}

function hasQuantitativeMetrics(html: string): boolean {
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
  // Count occurrences of measurable claims; need at least 3 to consider the page quantitative.
  const patterns = [
    /\b\d+\s*(?:minutes?|seconds?|hours?|hrs?|mins?|ms)\b/gi,
    /\b(?:saved|cut|reduced)\s+(?:my\s+)?\d+/gi,
    /\b\d+\s*x\s+(?:faster|more|less)\b/gi,
    /\b\d+%\s+(?:faster|slower|more|less|better|improvement|increase|decrease)\b/gi,
    /\b\$\d+(?:\.\d+)?\s*(?:\/\s*(?:mo|month|year|user))?/gi,
  ];
  let total = 0;
  for (const re of patterns) {
    total += [...visible.matchAll(re)].length;
    if (total >= 3) return true;
  }
  return false;
}

function hasComparisonTable(html: string): boolean {
  // A real comparison table has 2+ rows and 3+ columns of data.
  const tableMatches = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)];
  for (const m of tableMatches) {
    const tableHtml = m[0];
    const rows = [...tableHtml.matchAll(/<tr\b/gi)].length;
    const cells = [...tableHtml.matchAll(/<t[hd]\b/gi)].length;
    if (rows >= 3 && cells >= 6) return true;
  }
  return false;
}

function hasFirstPersonPhrasing(html: string): boolean {
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
  const patterns = [
    /\bI\s+(?:tested|tried|used|reviewed|spent|measured|tracked|ran|compared|benchmarked)\b/gi,
    /\b(?:my|our)\s+(?:results?|test(?:s|ing)?|workflow|setup|experience)\b/gi,
    /\bafter\s+\d+\s+(?:days?|weeks?|months?|hours?)\s+of\b/gi,
  ];
  let total = 0;
  for (const re of patterns) {
    total += [...visible.matchAll(re)].length;
    if (total >= 2) return true;
  }
  return false;
}

function countVisibleWords(html: string): number {
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!visible) return 0;
  return visible.split(" ").filter((w) => /[a-zA-Z0-9]/.test(w)).length;
}

function pickArticleSampleUrl(base: string, homeHtml: string): string | null {
  for (const path of extractInternalPaths(homeHtml, base)) {
    const url = new URL(path, base).toString();
    if (looksLikeContentPage(url, base)) return url;
  }
  return null;
}

function computeHealthScore(diagnostics: Record<string, Diagnostic[]>): HealthScore {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const list of Object.values(diagnostics)) {
    for (const d of list) {
      if (d.severity === "error") errors += 1;
      else if (d.severity === "warning") warnings += 1;
      else infos += 1;
    }
  }
  // Weights tuned so an errors-heavy site scores F while a warnings-only site lands around C/D.
  const raw = 100 - errors * 10 - warnings * 2 - infos * 0.5;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  let grade: HealthScore["grade"];
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";
  else grade = "F";
  return { score, grade, errors, warnings, infos };
}

function buildSummaryNotes(
  health: HealthScore,
  diagnostics: Record<string, Diagnostic[]>,
): string[] {
  const notes: string[] = [];
  notes.push(
    `Site health: ${health.score}/100 (Grade ${health.grade}) — ` +
      `${health.errors} error${health.errors === 1 ? "" : "s"}, ` +
      `${health.warnings} warning${health.warnings === 1 ? "" : "s"}, ` +
      `${health.infos} info`,
  );

  // Surface top categories by total findings.
  const categoryTotals = Object.entries(diagnostics)
    .map(([id, list]) => {
      const errs = list.filter((d) => d.severity === "error").length;
      const warns = list.filter((d) => d.severity === "warning").length;
      return { id, total: list.length, errs, warns };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.errs - a.errs || b.warns - a.warns || b.total - a.total)
    .slice(0, 5);

  for (const c of categoryTotals) {
    const parts: string[] = [];
    if (c.errs > 0) parts.push(`${c.errs} error${c.errs === 1 ? "" : "s"}`);
    if (c.warns > 0) parts.push(`${c.warns} warning${c.warns === 1 ? "" : "s"}`);
    const infosCount = c.total - c.errs - c.warns;
    if (infosCount > 0) parts.push(`${infosCount} info`);
    notes.push(`${c.id}: ${parts.join(", ")}`);
  }
  return notes;
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
  const diagnostics: Record<string, Diagnostic[]> = {};
  const hasPageSpeedKey = Boolean(env.PAGE_SPEED_API_KEY?.trim());

  const [home, about] = await Promise.all([
    fetchHtml(base),
    fetchHtml(`${base}/about`),
  ]);

  const psiResults = hasPageSpeedKey
    ? await Promise.all([
        fetchPageSpeed(base, "mobile", env),
        fetchPageSpeed(base, "desktop", env),
      ])
    : [];

  const psiOk = psiResults.filter((r) => r.ok && r.data).map((r) => r.data as PageSpeedResult);
  const psiErrors = psiResults.filter((r) => !r.ok).map((r) => r.error ?? "Unknown PSI error");

  if (psiOk.length > 0) {
    const cwvIssues: Diagnostic[] = [];
    const renderIssues: Diagnostic[] = [];

    for (const r of psiOk) {
      const prefix = `[${r.strategy}]`;
      if (r.performanceScore < 80) cwvIssues.push(warn(`${prefix} performance score ${r.performanceScore} (target >= 80)`));
      if (r.lcpMs != null && r.lcpMs > 2500) cwvIssues.push(warn(`${prefix} LCP ${Math.round(r.lcpMs)}ms (target <= 2500ms)`));
      if (r.inpMs != null && r.inpMs > 200) cwvIssues.push(warn(`${prefix} INP ${Math.round(r.inpMs)}ms (target <= 200ms)`));
      if (r.cls != null && r.cls > 0.1) cwvIssues.push(warn(`${prefix} CLS ${r.cls.toFixed(3)} (target <= 0.100)`));

      if (r.renderBlockingSavingsMs != null && r.renderBlockingSavingsMs > 200) {
        renderIssues.push(warn(`${prefix} render-blocking opportunity ${Math.round(r.renderBlockingSavingsMs)}ms`));
      }
      if (r.unusedJsSavingsBytes != null && r.unusedJsSavingsBytes > 50_000) {
        renderIssues.push(warn(`${prefix} unused JS ${Math.round(r.unusedJsSavingsBytes / 1024)}KB`));
      }
      if (r.tbtMs != null && r.tbtMs > 300) {
        renderIssues.push(warn(`${prefix} total blocking time ${Math.round(r.tbtMs)}ms`));
      }
    }

    diagnostics["perf-1"] = cwvIssues;
    diagnostics["perf-2"] = [...renderIssues, ...psiErrors.map((e) => warn(e))];

    // Per-template performance: sample one article URL on mobile so we don't only test the homepage.
    // The audit's own copy says "CWV should be evaluated by page template" — this is that.
    const articleSampleUrl = home.ok ? pickArticleSampleUrl(base, home.html) : null;
    if (articleSampleUrl && articleSampleUrl !== base) {
      const articleResult = await fetchPageSpeed(articleSampleUrl, "mobile", env);
      if (articleResult.ok && articleResult.data) {
        const r = articleResult.data;
        const prefix = `[article/mobile ${articleSampleUrl}]`;
        const homepageMobile = psiOk.find((p) => p.strategy === "mobile");
        // Flag when article scores noticeably worse than homepage (per-template variance).
        if (homepageMobile && homepageMobile.performanceScore - r.performanceScore >= 15) {
          diagnostics["perf-1"].push(
            warn(
              `${prefix} performance score ${r.performanceScore} (homepage scored ${homepageMobile.performanceScore} — per-template variance)`,
            ),
          );
        }
        if (r.lcpMs != null && r.lcpMs > 2500) {
          diagnostics["perf-1"].push(warn(`${prefix} LCP ${Math.round(r.lcpMs)}ms (target <= 2500ms)`));
        }
        if (r.cls != null && r.cls > 0.1) {
          diagnostics["perf-1"].push(warn(`${prefix} CLS ${r.cls.toFixed(3)} (target <= 0.100)`));
        }
      }
    }

    statuses["perf-1"] = diagnostics["perf-1"].length === 0 ? "done" : "todo";
    statuses["perf-2"] = diagnostics["perf-2"].length === 0 ? "done" : "todo";
  } else {
    const message = hasPageSpeedKey
      ? "PageSpeed Insights data is currently unavailable for this site."
      : "PageSpeed API key is not configured. Core Web Vitals checks are marked in-progress.";
    diagnostics["perf-1"] = [info(message), ...psiErrors.map((e) => warn(e))];
    diagnostics["perf-2"] = [...diagnostics["perf-1"]];
    statuses["perf-1"] = "in-progress";
    statuses["perf-2"] = "in-progress";
  }

  // Run crawl/sitemap diagnostics before fetch-heavy checks to avoid Worker subrequest limits.
  const sitemapAudit = await fetchSitemapAudit(base);
  const sitemapEntries = sitemapAudit.entries;

  const crawlCoverageIssues: Diagnostic[] = [];
  if (sitemapEntries.length === 0) {
    crawlCoverageIssues.push(err("No parseable sitemap entries found at common sitemap paths or robots.txt Sitemap directives."));
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
      crawlCoverageIssues.push(warn(`${externalEntries} sitemap URL(s) point to a different host.`));
    }
    if (staleCount > Math.max(3, Math.floor(sitemapEntries.length * 0.35))) {
      crawlCoverageIssues.push(warn(`${staleCount}/${sitemapEntries.length} sitemap URLs look stale (lastmod older than 180 days).`));
    }
  }
  crawlCoverageIssues.push(...sitemapAudit.duplicateUrls.map((m) => warn(m)));
  crawlCoverageIssues.push(...sitemapAudit.sitemapWarnings.map((m) => warn(m)));
  diagnostics["crawl-1"] = crawlCoverageIssues;
  statuses["crawl-1"] = crawlCoverageIssues.length === 0 ? "done" : "todo";

  const crawlSignalConflicts: Diagnostic[] = [];
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
      crawlSignalConflicts.push(err(`Invalid sitemap URL: ${entry.url}`));
      continue;
    }

    if (isPathDisallowed(parsedUrl.pathname, disallowRules)) {
      crawlSignalConflicts.push(err(`${entry.url} is listed in sitemap but blocked by robots.txt`));
      continue;
    }

    const page = await fetchHtml(entry.url);
    if (!page.ok) continue;

    const robotsMeta = extractMetaRobots(page.html);
    if (robotsMeta.includes("noindex")) {
      crawlSignalConflicts.push(err(`${entry.url} has meta robots noindex but is present in sitemap`));
    }

    const canonical = extractCanonicalHref(page.html);
    if (canonical) {
      try {
        const normalizedCanonical = new URL(canonical, entry.url).toString();
        const normalizedSelf = new URL(entry.url).toString();
        if (normalizedCanonical !== normalizedSelf) {
          crawlSignalConflicts.push(warn(`${entry.url} canonical points to ${normalizedCanonical}`));
        }
      } catch {
        crawlSignalConflicts.push(warn(`${entry.url} has invalid canonical URL (${canonical})`));
      }
    }
  }

  diagnostics["crawl-2"] = crawlSignalConflicts.slice(0, 10);
  statuses["crawl-2"] = crawlSignalConflicts.length === 0 ? "done" : "todo";

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

  const brokenLinks: Diagnostic[] = [];
  const redirectIssues: Diagnostic[] = [];
  if (home.ok) {
    const probeUrls = extractInternalPaths(home.html, base)
      .map((p) => new URL(p, base).toString())
      .filter((url) => !shouldSkipBrokenLinkProbe(url))
      .slice(0, 30);

    const probeResults = await Promise.all(probeUrls.map((url) => probeInternalLink(url)));

    for (const r of probeResults) {
      if (r.kind === "broken") {
        brokenLinks.push(err(`${r.url} (${r.status})`));
      } else if (r.kind === "redirect") {
        redirectIssues.push(warn(`${r.url} → ${r.location} (${r.status})`));
      }
    }
  }

  diagnostics["tech-1"] = brokenLinks;
  statuses["tech-1"] = brokenLinks.length === 0 ? "done" : "todo";
  diagnostics["tech-2"] = redirectIssues.slice(0, 10);
  statuses["tech-2"] = redirectIssues.length === 0 ? "done" : "todo";

  const aboutLower = about.html.toLowerCase();
  const auditPageSamples = await collectAuditPageSamples(base, home, sitemapEntries);
  const contentPageSamples = auditPageSamples.length > 0 ? auditPageSamples : [{ url: base, html: home.html }];
  const reviewPageSamples = contentPageSamples.filter(looksLikeReviewPage);
  const schemaReviewSamples = reviewPageSamples.length > 0 ? reviewPageSamples : contentPageSamples;

  const affiliateMissing = contentPageSamples
    .filter((page) => !hasAffiliateDisclosure(page.html))
    .map((page) => warn(`${page.url}: No obvious affiliate disclosure text found.`));

  const freshnessMissing = contentPageSamples
    .filter((page) => !hasFreshnessSignal(page.html))
    .map((page) => warn(`${page.url}: No obvious visible or structured freshness signal found.`));

  const reviewSchemaMissing = schemaReviewSamples
    .filter((page) => !hasSchemaType(page.html, ["Review", "SoftwareApplication", "Product"]))
    .map((page) => warn(`${page.url}: Review/SoftwareApplication/Product schema was not clearly detected.`));

  const faqSchemaMissing = auditPageSamples
    .filter((page) => !hasSchemaType(page.html, ["FAQPage"]))
    .map((page) => info(`${page.url}: FAQPage schema was not clearly detected.`));

  diagnostics["eeat-4"] = affiliateMissing.slice(0, 6);
  statuses["eeat-4"] = affiliateMissing.length === 0 ? "done" : "todo";
  diagnostics["eeat-5"] = freshnessMissing.slice(0, 6);
  statuses["eeat-5"] = freshnessMissing.length === 0 ? "done" : "todo";

  const hasTeamSignals =
    aboutLower.includes("editorial") ||
    aboutLower.includes("our team") ||
    aboutLower.includes("mission") ||
    aboutLower.includes("about us");
  statuses["eeat-3"] = hasTeamSignals ? "done" : "todo";

  diagnostics["tech-4"] = reviewSchemaMissing.slice(0, 6);
  statuses["tech-4"] = reviewSchemaMissing.length === 0 ? "done" : "todo";
  diagnostics["tech-5"] = faqSchemaMissing.slice(0, 6);
  statuses["tech-5"] = faqSchemaMissing.length === 0 ? "done" : "todo";

  // tech-3: probe links inside already-fetched content pages for 4xx/5xx.
  // Capped at 3 pages × 8 links to stay within Cloudflare's 50-subrequest budget.
  const articleBroken: Diagnostic[] = [];
  if (contentPageSamples.length > 0) {
    const pagesToScan = contentPageSamples.slice(0, 3);
    for (const page of pagesToScan) {
      const links = extractInternalPaths(page.html, base)
        .map((p) => new URL(p, base).toString())
        .filter((url) => !shouldSkipBrokenLinkProbe(url) && url !== page.url)
        .slice(0, 8);
      const probes = await Promise.all(links.map((url) => probeInternalLink(url)));
      for (const r of probes) {
        if (r.kind === "broken") {
          articleBroken.push(err(`${r.url} (${r.status}, found on ${page.url})`));
        }
      }
    }
  }
  diagnostics["tech-3"] = articleBroken.slice(0, 8);
  statuses["tech-3"] = articleBroken.length === 0 ? "done" : "todo";

  // Static SEO checks on already-fetched HTML — zero new fetches.
  // Dedupe by URL since contentPageSamples can fall back to [home] on small sites.
  const staticAuditTargets: AuditPageSample[] = (() => {
    const seen = new Set<string>();
    const out: AuditPageSample[] = [];
    const candidates = home.ok
      ? [{ url: base, html: home.html }, ...contentPageSamples]
      : [...contentPageSamples];
    for (const page of candidates) {
      if (seen.has(page.url)) continue;
      seen.add(page.url);
      out.push(page);
    }
    return out;
  })();

  // serp-1: title length and uniqueness across crawled pages.
  const titleIssues: Diagnostic[] = [];
  const titleByText = new Map<string, string[]>();
  for (const page of staticAuditTargets) {
    const title = extractTag(page.html, "title");
    if (!title) {
      titleIssues.push(err(`${page.url}: missing <title> tag`));
      continue;
    }
    if (title.length < 30) {
      titleIssues.push(warn(`${page.url}: title too short (${title.length} chars) — "${title}"`));
    } else if (title.length > 65) {
      titleIssues.push(warn(`${page.url}: title too long (${title.length} chars) — "${title.slice(0, 70)}…"`));
    }
    const list = titleByText.get(title) ?? [];
    list.push(page.url);
    titleByText.set(title, list);
  }
  for (const [title, urls] of titleByText) {
    if (urls.length > 1) {
      titleIssues.push(err(`Duplicate title "${title}" used on ${urls.length} pages: ${urls.join(", ")}`));
    }
  }
  diagnostics["serp-1"] = titleIssues.slice(0, 8);
  statuses["serp-1"] = titleIssues.length === 0 ? "done" : "todo";

  // onpage-4: title formatting (capitalization).
  const titleCapIssues: Diagnostic[] = [];
  for (const page of staticAuditTargets) {
    const title = extractTag(page.html, "title");
    if (!title) continue;
    const firstWord = title.split(/[\s\-|–—:]+/)[0] ?? "";
    if (firstWord && firstWord[0] && firstWord[0] !== firstWord[0].toUpperCase()) {
      titleCapIssues.push(info(`${page.url}: title starts with lowercase — "${title}"`));
    }
  }
  diagnostics["onpage-4"] = titleCapIssues.slice(0, 8);
  statuses["onpage-4"] = titleCapIssues.length === 0 ? "done" : "todo";

  // onpage-2: meta description length.
  const metaDescIssues: Diagnostic[] = [];
  for (const page of staticAuditTargets) {
    const desc = extractMetaDescription(page.html);
    if (!desc) {
      metaDescIssues.push(err(`${page.url}: missing meta description`));
      continue;
    }
    if (desc.length < 120) {
      metaDescIssues.push(warn(`${page.url}: description too short (${desc.length} chars)`));
    } else if (desc.length > 160) {
      metaDescIssues.push(warn(`${page.url}: description too long (${desc.length} chars) — Google truncates`));
    }
  }
  diagnostics["onpage-2"] = metaDescIssues.slice(0, 8);
  statuses["onpage-2"] = metaDescIssues.length === 0 ? "done" : "todo";

  // onpage-3: H1 count (should be exactly 1 per page).
  const h1Issues: Diagnostic[] = [];
  for (const page of staticAuditTargets) {
    const count = countH1(page.html);
    if (count === 0) {
      h1Issues.push(err(`${page.url}: no H1 tag`));
    } else if (count > 1) {
      h1Issues.push(warn(`${page.url}: ${count} H1 tags (should be exactly 1)`));
    }
  }
  diagnostics["onpage-3"] = h1Issues.slice(0, 8);
  statuses["onpage-3"] = h1Issues.length === 0 ? "done" : "todo";

  // eeat-1: author byline / Person schema on content pages.
  const bylineMissing = contentPageSamples
    .filter((page) => !hasAuthorByline(page.html))
    .map((page) => warn(`${page.url}: no author byline, meta author, or Person schema detected`));
  diagnostics["eeat-1"] = bylineMissing.slice(0, 6);
  statuses["eeat-1"] = bylineMissing.length === 0 ? "done" : "todo";

  // content-1: stock photo / missing alt text detection on content pages.
  const imageIssues: Diagnostic[] = [];
  for (const page of contentPageSamples) {
    const stock = findStockImageUrls(page.html);
    if (stock.length > 0) {
      imageIssues.push(warn(`${page.url}: ${stock.length} stock/AI-generated image(s) — first: ${stock[0]}`));
    }
    const missingAlt = countImagesMissingAlt(page.html);
    if (missingAlt > 0) {
      imageIssues.push(warn(`${page.url}: ${missingAlt} image(s) missing alt text`));
    }
  }
  diagnostics["content-1"] = imageIssues.slice(0, 8);
  statuses["content-1"] = imageIssues.length === 0 ? "done" : "todo";

  // content-2: quantitative metrics ("X minutes", "saved Y hours", numeric tables).
  const quantMissing = contentPageSamples
    .filter((page) => !hasQuantitativeMetrics(page.html))
    .map((page) => info(`${page.url}: no clear quantitative metrics (timed benchmarks, comparison numbers)`));
  diagnostics["content-2"] = quantMissing.slice(0, 6);
  statuses["content-2"] = quantMissing.length === 0 ? "done" : "todo";

  // content-4: comparison table presence on listicle/review pages.
  const tableMissing = reviewPageSamples
    .filter((page) => !hasComparisonTable(page.html))
    .map((page) => info(`${page.url}: no <table> element detected — listicles benefit from side-by-side comparisons`));
  diagnostics["content-4"] = tableMissing.slice(0, 6);
  statuses["content-4"] = tableMissing.length === 0 ? "done" : "todo";

  // content-5: first-person experience phrasing ("I tested", "I used", "my").
  const firstPersonMissing = contentPageSamples
    .filter((page) => !hasFirstPersonPhrasing(page.html))
    .map((page) => warn(`${page.url}: no first-person testing language ("I tested", "I used", etc.)`));
  diagnostics["content-5"] = firstPersonMissing.slice(0, 6);
  statuses["content-5"] = firstPersonMissing.length === 0 ? "done" : "todo";

  // scale-2: thin content (under 800 words on content pages).
  const thinPages: Diagnostic[] = [];
  for (const page of contentPageSamples) {
    const wc = countVisibleWords(page.html);
    if (wc < 800) {
      thinPages.push(warn(`${page.url}: ${wc} words — Google rewards depth on review/guide pages`));
    }
  }
  diagnostics["scale-2"] = thinPages.slice(0, 8);
  statuses["scale-2"] = thinPages.length === 0 ? "done" : "todo";

  if (home.ok) {
    const underlinkSeed: AuditPageSample[] = [{ url: base, html: home.html }, ...contentPageSamples];
    const underlinkedCandidates = await collectUnderlinkedPages(base, underlinkSeed);
    diagnostics["links-1"] = underlinkedCandidates.map((m) => info(m));
    statuses["links-1"] = underlinkedCandidates.length === 0 ? "done" : "todo";
  }

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
      .map((entry) => info(`${entry.url} (last updated ${entry.ageDays}d ago, decay score ${entry.decayScore})`));

    diagnostics["future-2"] = staleEntries;
    statuses["future-2"] = staleEntries.length === 0 ? "done" : "todo";
  } else {
    diagnostics["future-2"] = [info("No sitemap URL entries could be parsed for decay scoring.")];
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
    const competitorFindings: Diagnostic[] = [];
    let changeCount = 0;

    for (const target of competitorTargets) {
      const page = await fetchHtml(target);
      if (!page.ok) {
        competitorFindings.push(warn(`${target} (unreachable: ${page.status || "network-error"})`));
        continue;
      }

      const snapshot: CompetitorSnapshot = {
        title: extractTag(page.html, "title"),
        heading: extractFirstHeading(page.html),
        sampleH2: extractFirstH2(page.html),
      };

      const prev = previousBaseline[target];
      if (!prev) {
        competitorFindings.push(info(`${target} (baseline created)`));
      } else {
        const changedFields: string[] = [];
        if (prev.title !== snapshot.title) changedFields.push("title");
        if (prev.heading !== snapshot.heading) changedFields.push("h1");
        if (prev.sampleH2 !== snapshot.sampleH2) changedFields.push("h2");

        if (changedFields.length > 0) {
          changeCount += 1;
          competitorFindings.push(info(`${target} (changed: ${changedFields.join(", ")})`));
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

  // Compute overall site health score from all collected diagnostics.
  const health = computeHealthScore(diagnostics);
  // Top-level retest summary: health grade plus the most-impactful findings.
  const summaryNotes = buildSummaryNotes(health, diagnostics);
  notes.push(...summaryNotes);

  return {
    statuses,
    checkedAt: new Date().toISOString(),
    notes,
    diagnostics,
    health,
  };
}
