import { homedir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, readFile, writeFile, copyFile } from 'fs/promises';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS = join(CLAUDE_DIR, 'settings.json');
const HOOK_PATH = fileURLToPath(new URL('./hooks/easymd-stop-sync.sh', import.meta.url));
const HOOK_CMD = `bash ${HOOK_PATH}`;
const MARKER = 'easymd-stop-sync';

async function readSettings() {
  try {
    return JSON.parse(await readFile(SETTINGS, 'utf8'));
  } catch {
    return {};
  }
}
async function writeSettings(s) {
  await mkdir(CLAUDE_DIR, { recursive: true });
  // Back up first — never clobber an existing config silently.
  try {
    await copyFile(SETTINGS, `${SETTINGS}.easymd-bak`);
  } catch {
    /* no existing file */
  }
  await writeFile(SETTINGS, JSON.stringify(s, null, 2));
}

// Registers a Claude Code Stop hook so that after any session that edits .md files,
// they auto-sync to your easymd account — across every project, everywhere. Merges
// alongside any existing Stop hooks (e.g. the obsidian-wiki capture hook).
export async function hookInstall() {
  const s = await readSettings();
  s.hooks = s.hooks || {};
  s.hooks.Stop = Array.isArray(s.hooks.Stop) ? s.hooks.Stop : [];

  if (JSON.stringify(s.hooks.Stop).includes(MARKER)) {
    console.log('✓ easymd auto-sync hook is already installed.');
    return;
  }
  s.hooks.Stop.push({ matcher: '', hooks: [{ type: 'command', command: HOOK_CMD }] });
  await writeSettings(s);
  console.log('✓ Installed the easymd auto-sync hook in ~/.claude/settings.json');
  console.log('  After any Claude Code session that edits .md files, they sync to your account.');
  console.log('  Requires `easymd login`. A backup was saved to settings.json.easymd-bak.');
  console.log('  Remove anytime with `easymd hook-uninstall`.');
}

export async function hookUninstall() {
  const s = await readSettings();
  if (!s.hooks?.Stop?.length) {
    console.log('easymd auto-sync hook is not installed.');
    return;
  }
  const before = s.hooks.Stop.length;
  s.hooks.Stop = s.hooks.Stop.filter((e) => !JSON.stringify(e).includes(MARKER));
  if (s.hooks.Stop.length === before) {
    console.log('easymd auto-sync hook is not installed.');
    return;
  }
  await writeSettings(s);
  console.log('✓ Removed the easymd auto-sync hook.');
}
