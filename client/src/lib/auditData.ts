// Editorial Command Center — SEO Audit Tracker Data
// Design: Warm off-white (#F7F5F0) + amber accent + Playfair Display headings

export type Priority = "high" | "medium" | "low";
export type Status = "todo" | "in-progress" | "done";

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  detail: string;
  priority: Priority;
  impact: string;
  status: Status;
  categoryId: string;
  brokenUrl?: string;
  effort?: 1 | 2 | 3 | 4 | 5;
  confidence?: 1 | 2 | 3 | 4 | 5;
  owner?: string;
  dueDate?: string;
  slaDays?: number;
  evidence?: string[];
}

export interface Category {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  items: ChecklistItem[];
}

export const auditMeta = {
  site: "onelesshour.com",
  niche: "AI tools and productivity",
  auditDate: "—",
  auditor: "SEO Audit Tracker",
  executiveSummary:
    "This site is being audited against Google's 2025/2026 quality signals. The most common areas for improvement are establishing real human E-E-A-T signals, fixing broken internal links, and implementing structured schema markup. Run a retest to populate live diagnostics.",
};

export const categories: Category[] = [
  {
    id: "eeat",
    title: "E-E-A-T & Trust Signals",
    subtitle: "Experience · Expertise · Authoritativeness · Trustworthiness",
    icon: "Shield",
    items: [
      {
        id: "eeat-1",
        categoryId: "eeat",
        title: "Create real human author profiles",
        description:
          "Articles may be published under a generic brand name with no real author names, faces, or credentials. Google's Helpful Content System now actively rewards content attributed to real, verifiable experts.",
        detail:
          "Assign articles to real people (or well-crafted personas with consistent digital footprints). Include author bios at the bottom of every post detailing their experience with AI and freelancing. Add a headshot, LinkedIn link, and a 2–3 sentence bio.",
        priority: "high",
        impact: "Essential for E-E-A-T — without this, Google treats the site as anonymous affiliate content.",
        status: "todo",
      },
      {
        id: "eeat-2",
        categoryId: "eeat",
        title: "Publish a Review Methodology page",
        description:
          "A review methodology page is missing or unfindable. Google's Product Review algorithm specifically looks for this page to validate content quality and editorial process.",
        detail:
          "Create a dedicated page (e.g. /methodology/, /how-we-review/, or /editorial-process/) explaining exactly how you research and test content — e.g., 'We test each product for 30 days using standardised tasks and measure output quality, speed, and accuracy.' Link to it from the footer and within articles.",
        priority: "high",
        impact: "Significant boost to Product Review compliance — a direct Google ranking signal.",
        status: "todo",
      },
      {
        id: "eeat-3",
        categoryId: "eeat",
        title: "Expand the About page with editorial depth",
        description:
          "The current About page is thin and lacks company history, editorial guidelines, and information about the team's expertise and domain authority.",
        detail:
          "Add: mission statement, founding story, editorial process, team credentials, and a clear affiliate or content disclosure policy. Include a section on your testing/review process with a link to the full methodology page.",
        priority: "high",
        impact: "Strengthens domain-level trust signals that Google evaluates for YMYL-adjacent niches.",
        status: "todo",
      },
      {
        id: "eeat-4",
        categoryId: "eeat",
        title: "Add sitewide affiliate disclosure at article top",
        description:
          "Some articles include affiliate disclosures, but it is not consistent across all posts. Google and the FTC both require this to be prominent and above the fold.",
        detail:
          "Add a standardized disclosure banner at the very top of every review and comparison article: 'This article contains affiliate links. We may earn a commission at no extra cost to you.' Use a WordPress plugin or a global template hook to automate this.",
        priority: "medium",
        impact: "Required for FTC compliance and builds reader trust — indirectly signals quality to Google.",
        status: "todo",
      },
      {
        id: "eeat-5",
        categoryId: "eeat",
        title: "Add 'Last Updated' dates and 'Tested by' badges",
        description:
          "Google rewards freshness signals, especially in fast-moving niches. Articles should clearly show when they were last reviewed and tested.",
        detail:
          "Add a visible 'Last Updated: [Date]' and 'Tested by [Author Name]' badge near the article title. Ensure the article:modified_time schema property is updated whenever you refresh content.",
        priority: "medium",
        impact: "Freshness signals improve rankings for time-sensitive queries in competitive niches.",
        status: "todo",
      },
    ],
  },
  {
    id: "technical",
    title: "Technical SEO & Schema Markup",
    subtitle: "Structured Data · Crawlability · Rich Snippets",
    icon: "Code",
    items: [
      {
        id: "tech-1",
        categoryId: "technical",
        title: "Scan and fix broken internal links (4xx errors)",
        description:
          "Broken internal links waste crawl budget, dilute PageRank, and signal poor site maintenance to Google. A retest will crawl the homepage and report every internal URL returning a 4xx error.",
        detail:
          "Run a retest to detect broken links. For each found: (a) create the missing page, (b) set up a 301 redirect to a matching live URL, or (c) update the source link. Prioritise pages linked from the homepage or footer.",
        priority: "high",
        impact: "Immediate crawl budget recovery and UX improvement.",
        status: "todo",
      },
      {
        id: "tech-2",
        categoryId: "technical",
        title: "Verify all redirects resolve correctly (no chains or loops)",
        description:
          "Redirect chains (A → B → C) and loops waste crawl budget and lose link equity. Each hop in a chain dilutes the PageRank passed along.",
        detail:
          "Audit all 301/302 redirects using a tool like Screaming Frog or Redirect Checker. Collapse all chains to a single direct redirect. Eliminate any redirect loops immediately. Ensure old URLs redirect to exact canonical equivalents.",
        priority: "high",
        impact: "Preserves full link equity and reduces unnecessary crawl overhead.",
        status: "todo",
      },
      {
        id: "tech-3",
        categoryId: "technical",
        title: "Fix broken links in article body content",
        description:
          "Links within article content that return 404s erode user trust and signal poor editorial maintenance. These are often harder to find than homepage broken links.",
        detail:
          "Crawl article content for broken internal and external links using Screaming Frog or a broken-link checker plugin. Prioritise fixing links in high-traffic or high-authority articles. Either recreate the target page, set up a redirect, or remove the dead link.",
        priority: "high",
        impact: "Broken internal links dilute PageRank and signal poor site maintenance to Google.",
        status: "todo",
      },
      {
        id: "tech-4",
        categoryId: "technical",
        title: "Implement Review & SoftwareApplication schema markup",
        description:
          "The site uses basic BlogPosting schema via Rank Math, but completely lacks Review, SoftwareApplication, or Product schema. Without this, you will not get Rich Snippets (star ratings) in Google SERPs.",
        detail:
          "In Rank Math Pro, enable the 'Review' schema type for all review articles. Set: reviewRating (numeric 1–5), author, itemReviewed (SoftwareApplication with name, applicationCategory, operatingSystem, offers/price). Validate with Google's Rich Results Test.",
        priority: "medium",
        impact: "Unlocks star rating Rich Snippets in SERPs — dramatically improves CTR.",
        status: "todo",
      },
      {
        id: "tech-5",
        categoryId: "technical",
        title: "Add FAQPage schema to listicle articles",
        description:
          "Articles like 'Best AI Tools for Freelancers 2026' are missing FAQ sections and FAQPage schema. This is a major missed opportunity for 'People Also Ask' SERP real estate.",
        detail:
          "Add a 'Frequently Asked Questions' section at the bottom of all listicle and comparison articles. Wrap each Q&A pair in FAQPage structured data. In Rank Math, use the FAQ block or add JSON-LD manually.",
        priority: "medium",
        impact: "Captures 'People Also Ask' boxes — can double SERP visibility for target keywords.",
        status: "todo",
      },
      {
        id: "tech-6",
        categoryId: "technical",
        title: "Audit and fix all remaining 404 errors via Google Search Console",
        description:
          "Beyond the three identified broken links, there may be additional 404 errors from old URLs, renamed posts, or external links pointing to deleted pages.",
        detail:
          "Connect Google Search Console and navigate to Coverage → Not Found (404). Export the full list and set up 301 redirects for all URLs that previously had traffic or backlinks. Use a plugin like Redirection (WordPress) to manage this.",
        priority: "medium",
        impact: "Recovers lost link equity and improves crawl efficiency across the entire site.",
        status: "todo",
      },
    ],
  },
  {
    id: "content",
    title: "Content Quality & Product Review Guidelines",
    subtitle: "First-Hand Experience · Visual Evidence · Depth",
    icon: "FileText",
    items: [
      {
        id: "content-1",
        categoryId: "content",
        title: "Replace stock photos with original tool screenshots",
        description:
          "Many articles use generic AI-generated or stock images (people looking at laptops). Google's Product Review guidelines explicitly reward content with original visual evidence proving you actually used the tool.",
        detail:
          "Take annotated screenshots of your actual workspace inside ChatGPT, Claude, Notion, Jasper, etc. Use tools like CleanShot X or Snagit to add arrows, callouts, and highlights. Replace at least the top 3 images in each review with original screenshots.",
        priority: "medium",
        impact: "Proves first-hand experience — a core signal in Google's Product Review algorithm.",
        status: "todo",
      },
      {
        id: "content-2",
        categoryId: "content",
        title: "Add quantitative performance metrics to reviews",
        description:
          "Google rewards reviews that provide measurable, comparative data. Currently, reviews describe features but rarely include timed benchmarks or measurable outputs.",
        detail:
          "For each tool review, add a 'Performance Benchmarks' section with real data: e.g., 'Jasper generated a 1,000-word blog post in 42 seconds vs. Claude's 55 seconds.' Include word count accuracy, output quality scores, and pricing-per-output comparisons.",
        priority: "medium",
        impact: "Differentiates content from generic summaries — signals genuine testing to Google.",
        status: "todo",
      },
      {
        id: "content-3",
        categoryId: "content",
        title: "Add a prominent 'Where This Tool Falls Short' section",
        description:
          "Google's algorithms are trained to distrust reviews that are entirely positive. Genuine reviews highlight real flaws. Currently, the 'Cons' sections are thin and generic.",
        detail:
          "Expand the Cons section into a dedicated 'Where [Tool Name] Falls Short' subsection with specific, experienced-based criticisms. Example: 'Jasper's output requires heavy editing for technical niches — we found a 23% error rate on software development topics.'",
        priority: "medium",
        impact: "Signals genuine, unbiased testing — a key trust signal in Google's review quality assessment.",
        status: "todo",
      },
      {
        id: "content-4",
        categoryId: "content",
        title: "Standardize comparison tables across all listicle articles",
        description:
          "Some articles include comparison tables, but it is not consistent. Google's Product Review guidelines specifically mention side-by-side comparisons as a quality signal.",
        detail:
          "Create a standardized comparison table template with columns: Tool Name, Best For, Starting Price, Free Plan, Rating, and a direct link to the full review. Apply this to all 'Best [X] Tools' articles.",
        priority: "low",
        impact: "Improves user experience and signals structured, thorough content to Google.",
        status: "todo",
      },
      {
        id: "content-5",
        categoryId: "content",
        title: "Ensure first-hand experience phrasing throughout",
        description:
          "Some articles (like the Notion AI review) use good first-person phrasing ('I used it for 30 days'), but others read like generic overviews written without using the product.",
        detail:
          "Audit each article for first-person experience signals. Add phrases like: 'When I tested this feature...', 'In my 30-day trial...', 'I noticed that...'. Avoid passive voice and manufacturer-sourced descriptions.",
        priority: "low",
        impact: "Directly aligns with Google's E-E-A-T 'Experience' dimension.",
        status: "todo",
      },
    ],
  },
  {
    id: "onpage",
    title: "On-Page SEO & Site Structure",
    subtitle: "Topical Authority · Internal Linking · Meta Optimization",
    icon: "Layout",
    items: [
      {
        id: "onpage-1",
        categoryId: "onpage",
        title: "Build a Pillar Page for 'AI for Freelancers'",
        description:
          "The site has categories but lacks a 'Pillar Page' structure. There is no central, ultimate guide to 'AI for Freelancers' that interlinks all the individual tool reviews in a structured hub-and-spoke model.",
        detail:
          "Create a comprehensive hub page: 'The Ultimate Guide to AI for Freelancers in 2026.' Link out to all individual tool reviews (Notion, Zapier, Otter.ai, ChatGPT, Claude, Jasper). Link back from those reviews to the hub page. This concentrates topical authority.",
        priority: "low",
        impact: "Improves topical authority and internal PageRank distribution — long-term ranking boost.",
        status: "todo",
      },
      {
        id: "onpage-2",
        categoryId: "onpage",
        title: "Optimize meta descriptions for CTR",
        description:
          "Some meta descriptions are generic and do not include the year or a strong hook. Example: 'Discover the best AI tools for freelancers in 2026 to boost productivity and streamline your workflow' — this is weak and does not differentiate from competitors.",
        detail:
          "Rewrite meta descriptions to include: (1) the year '2026', (2) a specific number ('7 tools we actually tested'), (3) a benefit or differentiator ('including one free option'). Keep under 155 characters. Example: 'We tested 12 AI tools for freelancers in 2026. Here are the 7 worth paying for — including 2 free options that outperform paid rivals.'",
        priority: "low",
        impact: "Improved CTR directly signals relevance to Google and increases organic traffic.",
        status: "todo",
      },
      {
        id: "onpage-3",
        categoryId: "onpage",
        title: "Rewrite H2/H3 headers to be question-based or keyword-rich",
        description:
          "Many article headers use generic labels like 'Overview', 'Features', 'Pros', 'Cons'. These miss keyword opportunities and do not match how users search.",
        detail:
          "Replace generic headers with question-based or keyword-rich alternatives. Examples: 'Overview' → 'What is Notion AI Best Used For?', 'Features' → 'Key Features That Save Freelancers Time', 'Cons' → 'Where Notion AI Falls Short in 2026'. This also helps capture 'People Also Ask' rankings.",
        priority: "low",
        impact: "Improves keyword relevance signals and 'People Also Ask' eligibility.",
        status: "todo",
      },
      {
        id: "onpage-4",
        categoryId: "onpage",
        title: "Capitalize article title tags properly",
        description:
          "Several article titles are in lowercase (e.g., 'best AI tools for freelancers 2026' instead of 'Best AI Tools for Freelancers 2026'). This looks unprofessional in SERPs and reduces CTR.",
        detail:
          "Audit all post titles in WordPress and apply Title Case formatting. In Rank Math, ensure the SEO title field uses proper capitalization. This is a quick win that immediately improves SERP appearance.",
        priority: "low",
        impact: "Small but immediate CTR improvement — professional appearance in search results.",
        status: "todo",
      },
    ],
  },
  {
    id: "crawl",
    title: "Crawl & Indexation",
    subtitle: "Sitemaps · Robots · Canonicals · Duplicates",
    icon: "Search",
    items: [
      {
        id: "crawl-1",
        categoryId: "crawl",
        title: "Validate sitemap freshness and index coverage",
        description:
          "XML sitemaps should only include canonical indexable URLs and reflect recent updates.",
        detail:
          "Check sitemap status codes, lastmod correctness, and compare sitemap URLs to indexable URL set. Flag orphaned indexables and stale entries older than 30 days.",
        priority: "high",
        impact: "Improves crawl efficiency and prevents index bloat from outdated URLs.",
        status: "todo",
        effort: 3,
        confidence: 5,
        owner: "SEO",
        dueDate: "2026-04-12",
      },
      {
        id: "crawl-2",
        categoryId: "crawl",
        title: "Audit robots, noindex, and canonical conflicts",
        description:
          "Blocking and canonical signals often conflict and silently suppress rankings.",
        detail:
          "Create a URL-level matrix of robots directives, meta robots, x-robots-tag, and canonical targets. Resolve conflicting directives and remove accidental noindex rules.",
        priority: "high",
        impact: "Prevents deindexation mistakes and consolidates ranking signals correctly.",
        status: "todo",
        effort: 4,
        confidence: 5,
        owner: "Tech SEO",
        dueDate: "2026-04-15",
      },
    ],
  },
  {
    id: "performance",
    title: "Core Web Vitals & Rendering",
    subtitle: "LCP · INP · CLS · JS Rendering",
    icon: "Gauge",
    items: [
      {
        id: "perf-1",
        categoryId: "performance",
        title: "Benchmark CWV by template and device",
        description:
          "CWV should be evaluated by page template, not only a global average.",
        detail:
          "Collect LCP, INP, and CLS for homepage, listicle, review, and article templates on mobile and desktop. Define pass/fail thresholds and top offenders.",
        priority: "high",
        impact: "Raises page experience quality and reduces ranking volatility on mobile.",
        status: "todo",
        effort: 3,
        confidence: 4,
        owner: "Frontend",
        dueDate: "2026-04-18",
      },
      {
        id: "perf-2",
        categoryId: "performance",
        title: "Fix render-blocking assets and hydration risks",
        description:
          "Heavy JS, fonts, and image payloads can delay rendering and break hydration.",
        detail:
          "Audit script waterfalls, preload critical assets, defer non-critical JS, optimize hero images, and validate hydration warnings in production builds.",
        priority: "medium",
        impact: "Improves LCP/INP and stabilizes user-visible rendering behavior.",
        status: "todo",
        effort: 4,
        confidence: 4,
        owner: "Engineering",
        dueDate: "2026-04-21",
      },
    ],
  },
  {
    id: "internal-linking",
    title: "Internal Linking Intelligence",
    subtitle: "Orphans · Anchors · Hub-Spoke Coverage",
    icon: "Link2",
    items: [
      {
        id: "links-1",
        categoryId: "internal-linking",
        title: "Detect orphan and underlinked pages",
        description:
          "Important pages need sufficient internal links from relevant hubs.",
        detail:
          "Generate internal link graph and flag pages with fewer than 3 internal links, especially money pages and conversion pages.",
        priority: "high",
        impact: "Strengthens crawl discovery and topical authority flow.",
        status: "todo",
        effort: 3,
        confidence: 4,
        owner: "SEO",
        dueDate: "2026-04-16",
      },
      {
        id: "links-2",
        categoryId: "internal-linking",
        title: "Normalize anchor text distribution",
        description:
          "Over-repeated exact-match anchors can look manipulative and weak.",
        detail:
          "Audit anchor diversity by target URL and rebalance toward natural mixed anchors (brand, partial-match, topical, generic).",
        priority: "medium",
        impact: "Improves semantic relevance without over-optimization risk.",
        status: "todo",
        effort: 2,
        confidence: 4,
        owner: "Content",
        dueDate: "2026-04-23",
      },
    ],
  },
  {
    id: "content-scale",
    title: "Content Quality at Scale",
    subtitle: "Cannibalization · Thin Content · Intent Fit",
    icon: "Layers3",
    items: [
      {
        id: "scale-1",
        categoryId: "content-scale",
        title: "Run keyword cannibalization report",
        description:
          "Multiple URLs ranking for the same keyword cluster can dilute performance.",
        detail:
          "Cluster top queries and map competing URLs. Decide merge, redirect, canonical, or intent split strategy per cluster.",
        priority: "high",
        impact: "Consolidates authority into the right pages and improves average position.",
        status: "todo",
        effort: 4,
        confidence: 4,
        owner: "SEO",
        dueDate: "2026-04-24",
      },
      {
        id: "scale-2",
        categoryId: "content-scale",
        title: "Flag thin and near-duplicate pages",
        description:
          "Thin or duplicate pages reduce site-wide quality signals.",
        detail:
          "Score pages for unique value, word depth, and overlap similarity. Queue rewrites or consolidation for low-value URLs.",
        priority: "medium",
        impact: "Raises overall content quality and supports Helpful Content alignment.",
        status: "todo",
        effort: 3,
        confidence: 4,
        owner: "Editorial",
        dueDate: "2026-04-28",
      },
    ],
  },
  {
    id: "offpage",
    title: "Off-Page & Authority",
    subtitle: "Backlinks · Mentions · Link Gap",
    icon: "Network",
    items: [
      {
        id: "off-1",
        categoryId: "offpage",
        title: "Track referring domain quality trend",
        description:
          "Not all links carry equal value; quality trend matters more than volume.",
        detail:
          "Monitor growth by domain relevance, authority band, and anchor profile. Flag toxic clusters and set cleanup candidates.",
        priority: "medium",
        impact: "Improves trust profile and reduces penalty risk from low-quality links.",
        status: "todo",
        effort: 3,
        confidence: 3,
        owner: "Outreach",
        dueDate: "2026-05-01",
      },
      {
        id: "off-2",
        categoryId: "offpage",
        title: "Build competitor link-gap target list",
        description:
          "Link-gap opportunities reveal fast wins already validated by competitors.",
        detail:
          "Compare top 5 competitors and extract domains linking to 2+ competitors but not your site. Prioritize by relevance and outreach difficulty.",
        priority: "medium",
        impact: "Accelerates acquisition of high-probability authority links.",
        status: "todo",
        effort: 3,
        confidence: 4,
        owner: "PR",
        dueDate: "2026-05-03",
      },
    ],
  },
  {
    id: "serp",
    title: "SERP & CTR Optimization",
    subtitle: "Titles · Snippets · Query CTR Outliers",
    icon: "BarChart3",
    items: [
      {
        id: "serp-1",
        categoryId: "serp",
        title: "Audit title/meta uniqueness and truncation",
        description:
          "Duplicate or truncated snippets suppress click-through rates.",
        detail:
          "Detect duplicate title/meta sets and pixel-width truncation risk. Rewrite low-performing snippets with intent-matched value props.",
        priority: "high",
        impact: "Improves CTR without requiring new rankings.",
        status: "todo",
        effort: 2,
        confidence: 5,
        owner: "SEO",
        dueDate: "2026-04-17",
      },
      {
        id: "serp-2",
        categoryId: "serp",
        title: "Detect query-level CTR outliers",
        description:
          "Pages with strong average position but weak CTR indicate snippet mismatch.",
        detail:
          "From GSC, isolate queries where position is <= 8 but CTR is below benchmark. Prioritize rewrite tests and monitor 14-day impact.",
        priority: "high",
        impact: "Creates high-leverage gains from existing rankings.",
        status: "todo",
        effort: 3,
        confidence: 4,
        owner: "Growth",
        dueDate: "2026-04-22",
      },
    ],
  },
  {
    id: "ai-readiness",
    title: "AI Search Readiness",
    subtitle: "Entities · Citability · Structured Excerpts",
    icon: "Bot",
    items: [
      {
        id: "ai-1",
        categoryId: "ai-readiness",
        title: "Standardize entity coverage across key pages",
        description:
          "AI overviews rely heavily on clear entities and consistent topic representation.",
        detail:
          "Map primary entities by topic cluster and ensure consistent mention patterns, definitions, and relation context across pillar + supporting pages.",
        priority: "medium",
        impact: "Improves eligibility for AI-assisted answer surfaces.",
        status: "todo",
        effort: 3,
        confidence: 3,
        owner: "Content Strategy",
        dueDate: "2026-05-04",
      },
      {
        id: "ai-2",
        categoryId: "ai-readiness",
        title: "Add citation-friendly summary blocks",
        description:
          "Pages need concise, source-ready summaries for AI retrieval quality.",
        detail:
          "Add clear summary sections, definition blocks, and evidence-linked statements that can be quoted accurately by AI systems.",
        priority: "medium",
        impact: "Increases probability of being cited in AI-generated responses.",
        status: "todo",
        effort: 2,
        confidence: 3,
        owner: "Editorial",
        dueDate: "2026-05-07",
      },
    ],
  },
  {
    id: "integrations",
    title: "Data Integrations & Automation",
    subtitle: "GSC · GA4 · PSI · Backlink APIs",
    icon: "PlugZap",
    items: [
      {
        id: "int-1",
        categoryId: "integrations",
        title: "Integrate Search Console and GA4 data sources",
        description:
          "Automated audits are stronger when fed with real query and behavior data.",
        detail:
          "Connect GSC and GA4 APIs to collect query CTR, landing page sessions, and engagement metrics for prioritized issue detection.",
        priority: "high",
        impact: "Turns static checklist into data-driven prioritization engine.",
        status: "todo",
        effort: 5,
        confidence: 3,
        owner: "Engineering",
        dueDate: "2026-05-10",
      },
      {
        id: "int-2",
        categoryId: "integrations",
        title: "Add PageSpeed and backlink provider connectors",
        description:
          "CWV and authority insights require external telemetry.",
        detail:
          "Connect PageSpeed Insights API plus Ahrefs/Semrush (or equivalent) for domain authority trend, toxic link flags, and page-level CWV snapshots.",
        priority: "medium",
        impact: "Enables continuous technical and authority monitoring from one dashboard.",
        status: "todo",
        effort: 5,
        confidence: 3,
        owner: "Data",
        dueDate: "2026-05-14",
      },
    ],
  },
  {
    id: "future-quality",
    title: "Future Site & Content Quality",
    subtitle: "Decay · Competitive Monitoring",
    icon: "ClipboardList",
    items: [
      {
        id: "future-2",
        categoryId: "future-quality",
        title: "Automate content refresh queue with decay signals",
        description:
          "Pages should be refreshed based on measurable decay, not ad-hoc editing.",
        detail:
          "Create a decay score using click drop, ranking drop, stale updated date, outdated screenshots, and broken claims. Auto-prioritize pages above threshold.",
        priority: "high",
        impact: "Prevents silent traffic erosion and keeps content fresh at scale.",
        status: "todo",
        effort: 4,
        confidence: 4,
        owner: "Growth",
        dueDate: "2026-05-22",
      },
      {
        id: "future-4",
        categoryId: "future-quality",
        title: "Set competitor page-change monitoring (optional)",
        description:
          "Optional: track title, heading, schema, and pricing-page changes from key competitors.",
        detail:
          "Enable this only if competitive monitoring is part of your workflow. It can be noisy for smaller sites. When enabled, monitor top competitor pages weekly and alert on meaningful updates.",
        priority: "low",
        impact: "Helpful for competitive niches, but not required for core technical SEO health.",
        status: "todo",
        effort: 3,
        confidence: 4,
        owner: "Competitive Intel",
        dueDate: "2026-05-28",
      },
    ],
  },
];

export function getOverallProgress(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.status === "done").length;
  return Math.round((done / items.length) * 100);
}

export function getCategoryProgress(category: Category): number {
  return getOverallProgress(category.items);
}

export function getAllItems(cats: Category[]): ChecklistItem[] {
  return cats.flatMap((c) => c.items);
}

export const priorityConfig: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  high: {
    label: "High Priority",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  medium: {
    label: "Medium Priority",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  low: {
    label: "Low Priority",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
};

export const statusConfig: Record<Status, { label: string; color: string; bg: string }> = {
  todo: { label: "To Do", color: "text-gray-600", bg: "bg-gray-100" },
  "in-progress": { label: "In Progress", color: "text-amber-700", bg: "bg-amber-100" },
  done: { label: "Done", color: "text-emerald-700", bg: "bg-emerald-100" },
};
