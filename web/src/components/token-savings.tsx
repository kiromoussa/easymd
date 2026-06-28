const stats = [
  {
    format: 'Raw HTML',
    savings: '75–90%',
    detail: 'Strip tags, CSS, and nested markup that models never needed.',
    tone: 'from-[#6c8f1a] to-[#46600a]',
  },
  {
    format: 'Word / DOCX',
    savings: '50–70%',
    detail: 'Ditch embedded XML and style runs. Keep headings, lists, and emphasis.',
    tone: 'from-indigo-500 to-indigo-600',
  },
  {
    format: 'Text-based PDF',
    savings: '40–65%',
    detail: 'Skip OCR and layout noise. Feed the model clean, structured text.',
    tone: 'from-violet-500 to-violet-600',
  },
];

const reasons = [
  {
    title: 'Removes dead weight',
    body: 'Formatting code inflates text size. Markdown keeps hierarchy — headers, lists, bold — with minimal syntax that costs fewer tokens.',
    icon: '◆',
  },
  {
    title: 'Replaces binary bloat',
    body: 'Uploading raw PDFs or Word files forces OCR or heavy XML parsing. Convert to .md first and send pure text to the model.',
    icon: '◇',
  },
  {
    title: 'Prevents conversational bloat',
    body: 'Stop pasting the same spec every prompt. Break project context into standalone .md files and reference them on demand — e.g. @CLAUDE.md in Cursor or Claude Code.',
    icon: '○',
  },
];

export function TokenSavingsSection() {
  return (
    <>
      <section id="tokens" className="border-t border-slate-200 bg-white py-24 dark:border-white/10 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--accent-strong)] dark:text-[var(--accent-strong)]">
              Token economics
            </p>
            <h2 className="mt-3 text-3xl font-normal tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Clean Markdown saves a massive number of tokens
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Converting unstructured text, PDFs, Word documents, or HTML to plain
              .md removes hidden formatting metadata — font styles, XML tags, CSS —
              while preserving the structure models actually use.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {stats.map((item) => (
              <div
                key={item.format}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 shadow-sm dark:border-white/10 dark:bg-slate-900"
              >
                <div className={`bg-gradient-to-br ${item.tone} px-6 py-8 text-white`}>
                  <p className="text-sm font-medium text-white/80">{item.format}</p>
                  <p className="mt-2 text-4xl font-light tracking-tight">{item.savings}</p>
                  <p className="mt-1 text-sm text-white/90">typical token reduction</p>
                </div>
                <p className="px-6 py-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="why-markdown" className="border-t border-slate-200 bg-[#f8f9fa] py-24 dark:border-white/10 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-normal tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Why it helps your AI workflow
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              Markdown is not just prettier — it is cheaper, faster, and agent-native.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {reasons.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-slate-950"
              >
                <span className="text-2xl text-[var(--accent-strong)] dark:text-[var(--accent-strong)]">{item.icon}</span>
                <h3 className="mt-4 text-xl font-medium text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
