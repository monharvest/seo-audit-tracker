# Deployment and Runtime Notes

Last updated: 2026-04-05

## Cloudflare Pages Branching

- This project's Cloudflare Pages production branch is `production` (not `main`).
- Keep deploy command pinned to:
  - `wrangler pages deploy dist/public --project-name seo-audit-tracker --branch production`
- `package.json` script `deploy:cf` is already configured for this.

## Local vs Cloudflare Runtime Differences

- Local checks may pass while Cloudflare fails due to Worker subrequest limits.
- Symptom in diagnostics:
  - `network-error: Too many subrequests by single Worker invocation`
- Mitigation used in this codebase:
  - Run crawl/sitemap diagnostics early in `runAutomatedRetest` before fetch-heavy checks.

## Sitemap Handling Notes

- Sitemap discovery uses common paths and `robots.txt` `Sitemap:` directives.
- Optional fallback sitemap names can validly 404 and should not be treated as fatal when valid sitemap entries are found elsewhere:
  - `/sitemap-index.xml`
  - `/sitemap.index.xml`

## Recommended Deploy Command

- `pnpm build:cf && pnpm deploy:cf`

## PageSpeed Secret Requirement

- Automated retest PageSpeed checks are secret-backed and require `PAGE_SPEED_API_KEY`.
- Configure `PAGE_SPEED_API_KEY` in Cloudflare Pages for both `Preview` and `Production` environments.
- If the key is missing, Core Web Vitals checks remain `in-progress` and diagnostics explain that the key is not configured.
