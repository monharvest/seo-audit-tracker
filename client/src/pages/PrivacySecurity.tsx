import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, ShieldCheck, Cookie, DatabaseZap } from "lucide-react";

export default function PrivacySecurity() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.975 0.008 85)" }}>
      <div className="mx-auto max-w-4xl px-6 py-8 md:px-8 md:py-12">
        <Button
          onClick={() => setLocation("/")}
          className="mb-6 gap-2 rounded-sm border border-amber-200 bg-white px-3 py-2 text-amber-800 hover:bg-amber-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to audit
        </Button>

        <div
          className="overflow-hidden rounded-sm border bg-white shadow-sm"
          style={{ borderColor: "oklch(0.88 0.012 85)" }}
        >
          <div
            className="border-b px-6 py-6 md:px-8"
            style={{ background: "linear-gradient(135deg, oklch(0.95 0.06 85), white)", borderColor: "oklch(0.88 0.012 85)" }}
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Privacy, Security, and Cookies
            </p>
            <h1
              className="text-3xl font-bold leading-tight text-gray-900 md:text-4xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              How this app handles visitor data
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
              Most progress tracking happens locally in the visitor&apos;s browser, but some user-triggered features call stateless API endpoints.
              This page explains exactly what stays local, what is sent out, and when.
            </p>
          </div>

          <div className="space-y-8 px-6 py-6 md:px-8 md:py-8">
            <section id="privacy">
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h2 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                  What stays in the browser
                </h2>
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-gray-700">
                <p>Your checklist progress, chosen target site, retest schedule preference, and recent retest history are stored in browser localStorage on the visitor&apos;s device.</p>
                <p>This local state is used so the dashboard remembers progress between visits on the same browser.</p>
                <p>No account login or user database is required for the core checklist experience.</p>
              </div>
            </section>

            <section id="security">
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <DatabaseZap className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                  What is sent to backend functions
                </h2>
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-gray-700">
                <p>When a visitor clicks <strong>Retest</strong>, the app sends the target site/domain to a stateless API endpoint so the audit checks can be performed.</p>
                <p>When a visitor clicks <strong>Inspect this URL</strong>, the selected URL is sent to an API endpoint that fetches page-level SEO signals.</p>
                <p>When a visitor requests an emailed report, the email address and report payload are sent to an API endpoint so delivery can be attempted.</p>
                <p>The intended model is stateless processing rather than long-term app-side storage, but the request still leaves the browser to be processed by serverless backend functions.</p>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <Lock className="h-5 w-5 text-sky-600" />
                <h2 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Security posture
                </h2>
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-gray-700">
                <p>The app does not expose a user account system, password storage, or persistent visitor profile database in its core flow.</p>
                <p>Network requests are limited to user-triggered audit actions, optional analytics if configured, and any third-party services used for report delivery or performance analysis.</p>
                <p>Because retests and inspections fetch external URLs, visitors should only inspect domains and pages they are comfortable submitting for remote processing.</p>
              </div>
            </section>

            <section id="cookies">
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <Cookie className="h-5 w-5 text-rose-600" />
                <h2 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Cookies and local storage
                </h2>
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-gray-700">
                <p>The app primarily uses browser localStorage rather than traditional cookies for progress persistence.</p>
                <p>If analytics is configured by the site operator, an analytics script may load and set its own tracking behavior. If analytics is not configured, that script is not loaded.</p>
                <p>If you need a stricter compliance setup, add a consent layer before enabling any optional analytics or third-party integrations.</p>
              </div>
            </section>

            <section id="terms">
              <div className="mb-3 flex items-center gap-2 text-gray-900">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                <h2 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Terms of use (summary)
                </h2>
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-gray-700">
                <p>The audit outputs are informational guidance and do not guarantee ranking outcomes.</p>
                <p>Visitors are responsible for verifying recommendations and complying with applicable legal, privacy, and platform requirements.</p>
                <p>Do not submit confidential or regulated data unless your deployment has the controls required for that data class.</p>
              </div>
            </section>

            <section className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-relaxed text-amber-950">
              <p className="font-semibold uppercase tracking-wide text-[11px] text-amber-800">Plain-language summary</p>
              <p className="mt-1">
                The app is <strong>not fully browser-only</strong>. Progress tracking is local, but retest, URL inspection, and email actions send data to backend functions when the user triggers them.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}