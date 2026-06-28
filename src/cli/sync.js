import { readFile, readdir } from 'fs/promises';
import { basename, join, relative } from 'path';
import chokidar from 'chokidar';
import { requireCredentials } from './config.js';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.turbo', 'build', 'coverage']);

// "Load-bearing" agent files excluded from auto-sync by default. The account's
// `sync_special` setting (toggled in the dashboard) opts back in.
const SPECIAL_MD = new Set(['claude.md', 'readme.md', 'agents.md']);
const isSpecial = (filePath) => SPECIAL_MD.has(basename(filePath).toLowerCase());

// Ask the server whether this account wants the special files included.
async function syncSpecialEnabled(creds) {
  try {
    const res = await fetch(`${creds.url}/api/cli/settings`, { headers: { Authorization: `Bearer ${creds.token}` } });
    if (res.ok) return Boolean((await res.json()).syncSpecial);
  } catch {
    /* default to excluding on error */
  }
  return false;
}

// Document name sent to the server: repo-relative path without the .md extension.
// The server slugs it (e.g. "docs/spec" → "docs-spec") and namespaces it to the account.
function docNameFor(filePath, root) {
  const rel = relative(root, filePath).replace(/\\/g, '/').replace(/\.md$/i, '');
  return rel || basename(filePath).replace(/\.md$/i, '');
}

export async function uploadFile(filePath, { root, creds }) {
  const content = await readFile(filePath, 'utf8');
  const name = docNameFor(filePath, root);
  const res = await fetch(`${creds.url}/api/cli/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.token}` },
    body: JSON.stringify({ name, content, title: basename(name) }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return { name, ...(await res.json().catch(() => ({}))) };
}

// Recursively collect .md files under root, skipping ignored dirs and dotfiles.
async function collectMarkdown(dir, root, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) await collectMarkdown(full, root, out);
    } else if (e.isFile() && /\.md$/i.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

// One-shot: push every .md under `root` to the account.
export async function syncDir(root, { quiet = false } = {}) {
  const creds = await requireCredentials();
  const includeSpecial = await syncSpecialEnabled(creds);
  let files = await collectMarkdown(root, root);
  if (!includeSpecial) files = files.filter((f) => !isSpecial(f));
  if (!files.length) {
    if (!quiet) console.log('No .md files found.');
    return { ok: 0, fail: 0 };
  }
  let ok = 0;
  let fail = 0;
  for (const f of files) {
    try {
      const r = await uploadFile(f, { root, creds });
      ok++;
      if (!quiet) console.log(`  ✓ ${relative(root, f)} → ${r.name}`);
    } catch (e) {
      fail++;
      if (!quiet) console.log(`  ✗ ${relative(root, f)} — ${e.message}`);
    }
  }
  if (!quiet) console.log(`\nSynced ${ok} file(s)${fail ? `, ${fail} failed` : ''}.`);
  return { ok, fail };
}

// Long-running: watch `root` and push .md files as they're added/changed.
export async function watchDir(root, { quiet = false } = {}) {
  const creds = await requireCredentials();
  const includeSpecial = await syncSpecialEnabled(creds);
  const log = (...a) => !quiet && console.log(...a);

  const pending = new Map(); // path -> timer (debounce)
  const push = (filePath) => {
    if (!includeSpecial && isSpecial(filePath)) return; // skip CLAUDE/README/AGENTS by default
    clearTimeout(pending.get(filePath));
    pending.set(
      filePath,
      setTimeout(async () => {
        pending.delete(filePath);
        try {
          const r = await uploadFile(filePath, { root, creds });
          log(`  ✓ synced ${relative(root, filePath)} → ${r.name}`);
        } catch (e) {
          log(`  ✗ ${relative(root, filePath)} — ${e.message}`);
        }
      }, 400),
    );
  };

  const watcher = chokidar.watch('**/*.md', {
    cwd: root,
    ignored: (p) => p.split(/[\\/]/).some((seg) => IGNORE_DIRS.has(seg) || (seg.startsWith('.') && seg.length > 1)),
    ignoreInitial: false, // also sync existing files on startup ("auto add all .md")
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher
    .on('add', (p) => push(join(root, p)))
    .on('change', (p) => push(join(root, p)))
    .on('ready', () => log(`Watching ${root} for .md changes. Press Ctrl+C to stop.`));

  return watcher;
}
