import Link from 'next/link';
import { HeaderCtas, HeroCtas, FooterCtas } from '@/components/landing-ctas';
import { CopyCommand } from '@/components/copy-command';
import { Logo as BrandMark } from '@/components/logo';

const heroFeatures = [
  'Real-time collaborative editing',
  'Save tokens for longer prompts',
  'Connects to any AI, with only one line',
  'By developers, for developers',
];

const tokenStats = [
  { pct: '75–90%', label: 'Raw HTML', detail: 'Strip tags, CSS, nested markup, and rendering noise that models never needed.' },
  { pct: '40–60%', label: 'Word / DOCX', detail: 'Drop the embedded XML and style runs wrapped around the text. (Image-heavy files shrink less.)' },
  { pct: '40–65%', label: 'PDF vs page images', detail: 'Send clean extracted text instead of OCR’d page images. Vs already-extracted text, markdown is roughly the same size.' },
];

const reasons = [
  {
    title: 'Removes dead weight',
    body: 'Markdown keeps structure: headings, lists, and emphasis, without shipping hidden formatting code into every prompt.',
  },
  {
    title: 'Replaces binary bloat',
    body: 'Stop sending PDFs and Word files through OCR or XML parsing when the useful context fits in plain text.',
  },
  {
    title: 'Prevents context drift',
    body: 'Humans and agents edit the same source file, so the next prompt references the current truth instead of yesterday’s paste.',
  },
];

const tools = [
  { name: 'list_documents', body: 'Lists every doc in the account with name, title, and last updated time.' },
  { name: 'read_document', body: 'Returns a document by name so the agent reads the latest live content.' },
  { name: 'create_document', body: 'Creates docs that open in live editors and appear in the dashboard.' },
  { name: 'update_document', body: 'Replaces content instantly in the same shared document session.' },
  { name: 'append_to_document', body: 'Appends text to existing content, useful for agent notes and running specs.' },
];

const mcpBadges = ['Real-time both ways', 'Account-scoped docs', 'Authenticated server', 'Automatic in 1 line'];

const terminalBullets = [
  'Canonical on disk: the .md in your repo is the document.',
  'Real-time multiplayer, presence, and CRDT sync.',
  'Agents, PMs, and engineers work from the same referenceable file.',
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">{children}</p>;
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <BrandMark className="h-8 w-8 text-[var(--mint)]" />
      <span className="text-lg font-semibold tracking-tight text-[var(--mint)]">easymd</span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-full bg-[var(--ink)] text-[var(--mint)] [color-scheme:dark]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--ink)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <HeaderCtas />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(218,255,118,0.10),_transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Google Docs for Markdown, <span className="text-[var(--accent)]">with MCP built in.</span>
            </h1>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {heroFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--mint-muted)]">
                  <span className="mt-0.5 text-[var(--accent)]">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <HeroCtas />
            <div className="mt-8">
              <CopyCommand
                command="npx easymd-cli auto on"
                note="One line: signs you in, then auto-syncs every .md in your repo to your account."
              />
            </div>
          </div>

          {/* Product mock */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--ink-soft)] shadow-2xl shadow-black/60">
              <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <span className="ml-2 text-xs text-[var(--mint-faint)]">easymd dashboard</span>
                <span className="ml-auto rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">live preview</span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-[var(--hairline)]">
                <div className="p-5 font-mono text-[11px] leading-relaxed text-[var(--mint-muted)]">
                  <p className="text-[var(--mint-faint)]"># CLAUDE.md</p>
                  <p className="mt-3 text-[var(--accent)]">## Project context</p>
                  <p className="mt-2">- Stack: Next.js + Clerk</p>
                  <p>- Agents read this file</p>
                  <p className="mt-3 text-[var(--accent)]">## Token rules</p>
                  <p>Prefer .md over PDF/DOCX</p>
                  <p className="mt-3 inline-block h-4 w-px animate-pulse bg-[var(--accent)] align-middle" />
                </div>
                <div className="p-5 text-sm">
                  <h3 className="text-base font-semibold">CLAUDE.md</h3>
                  <h4 className="mt-4 text-sm font-medium text-[var(--accent)]">Project context</h4>
                  <ul className="mt-2 list-disc pl-4 text-[var(--mint-muted)]">
                    <li>Stack: Next.js + Clerk</li>
                    <li>Agents read this file</li>
                  </ul>
                  <div className="mt-5 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-[var(--accent-fg)]">K</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#9334e6] text-[10px] font-bold text-white">AI</span>
                    <span className="text-xs text-[var(--mint-faint)]">2 editors live</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Token economics */}
      <section id="tokens" className="border-t border-[var(--hairline)] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <Eyebrow>Token economics</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Clean markdown saves a massive number of tokens.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[var(--mint-muted)]">
              Convert messy documents into structured .md once, then reference the same portable file
              everywhere agents already work.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {tokenStats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-[var(--hairline)] bg-[var(--ink-soft)] p-7">
                <p className="text-4xl font-semibold tracking-tight text-[var(--accent)]">{s.pct}</p>
                <p className="mt-1 text-sm font-medium">{s.label}</p>
                <p className="mt-4 text-sm leading-relaxed text-[var(--mint-muted)]">{s.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-[var(--mint-faint)]">
            Measured on real documents with the o200k tokenizer. HTML and DOCX figures compare the raw
            marked-up source to clean markdown; PDF compares page-image/OCR ingestion to extracted text.
            Actual savings vary by document.
          </p>
        </div>
      </section>

      {/* Why it helps */}
      <section id="why" className="border-t border-[var(--hairline)] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <Eyebrow>Why it helps</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Agent-native docs without the collaboration penalty.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {reasons.map((r) => (
              <article key={r.title} className="rounded-2xl border border-[var(--hairline)] p-7">
                <h3 className="text-lg font-semibold">{r.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--mint-muted)]">{r.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* MCP capabilities */}
      <section id="mcp" className="border-t border-[var(--hairline)] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <Eyebrow>Current MCP server capabilities</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              A real-time MCP server for the documents agents already need.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[var(--mint-muted)]">
              It runs as a stdio MCP server that Claude, Cursor, or any agent can connect to. It joins the
              same live Yjs collaboration session as the browser, so agent edits and human edits happen in
              one shared document.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <div key={t.name} className="rounded-2xl border border-[var(--hairline)] bg-[var(--ink-soft)] p-6">
                <code className="rounded-md bg-[var(--accent)]/12 px-2 py-1 font-mono text-xs font-medium text-[var(--accent)]">
                  {t.name}
                </code>
                <p className="mt-4 text-sm leading-relaxed text-[var(--mint-muted)]">{t.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {mcpBadges.map((b) => (
              <span key={b} className="flex items-center gap-2 rounded-full border border-[var(--hairline)] px-4 py-2 text-sm text-[var(--mint-muted)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                {b}
              </span>
            ))}
          </div>

          <div className="mt-8">
            <CopyCommand
              command="npx add-mcp@latest --command easymd --args mcp --name easymd"
              note="Connect every agent (Cursor, Claude, VS Code…) after `npm i -g easymd-cli && easymd login`."
            />
          </div>
        </div>
      </section>

      {/* From your terminal */}
      <section id="workflow" className="border-t border-[var(--hairline)] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Eyebrow>From your terminal</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Agents can edit the same document humans see.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[var(--mint-muted)]">
                The MCP server joins the live Yjs collaboration session through stdio, so Claude and Cursor
                write into the same document as the browser. No separate API. No stale copy. No second source
                of truth.
              </p>
              <ul className="mt-8 space-y-4">
                {terminalBullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[var(--mint-muted)]">
                    <span className="mt-0.5 text-[var(--accent)]">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--ink-soft)] p-6">
              <div className="flex items-center gap-2 pb-4">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <span className="ml-2 text-xs text-[var(--mint-faint)]">Terminal</span>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-black/50 p-5 font-mono text-sm leading-relaxed text-[var(--mint)]">
                <code>{`$ easymd open CLAUDE.md

  File:  ./CLAUDE.md
  Local: http://localhost:3847
  Share this URL with teammates.`}</code>
              </pre>
              <p className="mt-4 flex items-center gap-2 text-sm text-[var(--mint-muted)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> ready to commit
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--hairline)] bg-[var(--accent)] py-20 text-[var(--accent-fg)]">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop paying to process the same document twice.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--accent-fg)]/80">
            Sign up, open your dashboard, and invite a teammate. See token-efficient markdown collaboration in
            under a minute.
          </p>
          <FooterCtas />
        </div>
      </section>

      <footer className="border-t border-[var(--hairline)] py-10 text-center text-sm text-[var(--mint-faint)]">
        easymd: portable markdown, Docs-grade collaboration, agent-native by design.
      </footer>
    </div>
  );
}
