import { SiteHeader } from '@/components/site-header';
import { TokenSavingsSection } from '@/components/token-savings';
import { HeroCtas, FooterCtas } from '@/components/landing-ctas';

export default function HomePage() {
  return (
    <div className="min-h-full bg-white text-slate-900">
      <SiteHeader />

      {/* Hero — Google Docs–style clean workspace pitch */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(26,115,232,0.08),_transparent_55%)]" />
        <div className="mx-auto grid max-w-6xl gap-16 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <p className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-[#1a73e8]">
              Google Docs for Markdown — the file on disk stays canonical
            </p>
            <h1 className="mt-6 text-4xl font-normal leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]">
              Collaborate on{' '}
              <span className="text-[#1a73e8]">CLAUDE.md</span> without the copy-paste tax
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Real-time editing for the actual .md in your repo — not a hosted copy, not a mangled
              Google Docs paste. Engineers, PMs, and agents all meet in one portable file.
            </p>
            <HeroCtas />
            <p className="mt-6 text-sm text-slate-500">
              Free for solo use · No credit card · Changes land straight in git
            </p>
          </div>

          {/* Product mock — Docs-like document chrome */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-[#f8f9fa] px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <span className="ml-2 text-xs text-slate-500">CLAUDE.md — easymd</span>
                <span className="ml-auto rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  −68% tokens vs DOCX
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="bg-[#fafafa] p-5 font-mono text-[11px] leading-relaxed text-slate-600">
                  <p className="text-slate-400"># CLAUDE.md</p>
                  <p className="mt-3">## Project context</p>
                  <p className="mt-2">- Stack: Next.js + Clerk</p>
                  <p>- Agents read this file</p>
                  <p className="mt-3">## Token rules</p>
                  <p>Prefer .md over PDF/DOCX</p>
                  <p className="mt-2 text-blue-600">|</p>
                </div>
                <div className="p-5 text-sm text-slate-700">
                  <h3 className="text-base font-medium">CLAUDE.md</h3>
                  <h4 className="mt-4 text-sm font-medium text-slate-900">Project context</h4>
                  <ul className="mt-2 list-disc pl-4 text-slate-600">
                    <li>Stack: Next.js + Clerk</li>
                    <li>Agents read this file</li>
                  </ul>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-[#1a73e8] text-center text-[10px] leading-6 text-white">
                      A
                    </span>
                    <span className="h-6 w-6 rounded-full bg-emerald-500 text-center text-[10px] leading-6 text-white">
                      P
                    </span>
                    <span className="text-xs text-slate-400">2 editors live</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <TokenSavingsSection />

      {/* Collaboration */}
      <section id="collaborate" className="border-t border-slate-200 bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-normal tracking-tight text-slate-900 sm:text-4xl">
                The collaboration Docs got right — on the file agents actually read
              </h2>
              <ul className="mt-8 space-y-5 text-slate-600">
                <li className="flex gap-3">
                  <span className="mt-1 text-[#1a73e8]">✓</span>
                  <span>
                    <strong className="font-medium text-slate-900">Canonical on disk.</strong> The
                    document on screen is the .md in your repo — no round-trip, nothing mangled.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 text-[#1a73e8]">✓</span>
                  <span>
                    <strong className="font-medium text-slate-900">Real-time multiplayer.</strong>{' '}
                    Live cursors, presence, and CRDT sync — PMs never touch a pull request.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 text-[#1a73e8]">✓</span>
                  <span>
                    <strong className="font-medium text-slate-900">Agents are first-class.</strong>{' '}
                    Human edits and agent writes meet in one @-referenceable file.
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8f9fa] p-8">
              <p className="text-sm font-medium text-slate-900">From your terminal</p>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-5 text-sm text-slate-100">
                <code>{`$ easymd open CLAUDE.md\n\n  File:  ./CLAUDE.md\n  Local: http://localhost:3847\n  Share this URL with teammates.`}</code>
              </pre>
              <p className="mt-4 text-sm text-slate-600">
                Engineers keep their workflow. Everyone else gets a browser tab. The file stays in
                git.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-[#1a73e8] py-20 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-normal tracking-tight sm:text-4xl">
            Stop paying to process the same document twice
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Sign up, open the live demo, and invite a teammate. See token-efficient markdown
            collaboration in under a minute.
          </p>
          <FooterCtas />
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-sm text-slate-500">
        easymd — portable markdown, Docs-grade collaboration, agent-native by design.
      </footer>
    </div>
  );
}
