import { homedir } from 'os';
import { join, dirname } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';

// Where each agent reads its MCP server config (macOS paths).
const TARGETS = {
  cursor: join(homedir(), '.cursor', 'mcp.json'),
  'claude-desktop': join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
};

// The bundled MCP server authenticates with the token from `easymd login`, so the
// config needs no secrets — just the command.
const SERVER = { command: 'easymd', args: ['mcp'] };

async function mergeConfig(file) {
  let cfg = {};
  try {
    cfg = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    /* new file */
  }
  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers.easymd = SERVER;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(cfg, null, 2));
}

export async function mcpInstall(arg) {
  const which = (arg || '').replace(/^--/, '');
  const entries = which && TARGETS[which] ? [[which, TARGETS[which]]] : Object.entries(TARGETS);

  console.log('Registering the easymd MCP server…\n');
  for (const [name, file] of entries) {
    try {
      await mergeConfig(file);
      console.log(`  ✓ ${name.padEnd(15)} ${file}`);
    } catch (e) {
      console.log(`  ✗ ${name.padEnd(15)} ${e.message}`);
    }
  }
  console.log('\nFor Claude Code (CLI), run instead:');
  console.log('  claude mcp add easymd -- easymd mcp\n');
  console.log('Prerequisites:');
  console.log('  • Install globally:  npm i -g easymd-cli');
  console.log('  • Log in once:       easymd login');
  console.log('  • Restart your agent (Cursor / Claude) to load it.\n');
  console.log('The server authenticates with your saved login — no API keys to paste.');
}
