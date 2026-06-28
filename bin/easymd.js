#!/usr/bin/env node

import { resolve } from 'path';
import { access } from 'fs/promises';
import openBrowser from 'open';
import { login, logout, whoami } from '../src/cli/auth.js';
import { syncDir, watchDir } from '../src/cli/sync.js';
import { autoOn, autoOff, autoStatus } from '../src/cli/auto.js';
import { getCredentials } from '../src/cli/config.js';
import { mcpInstall } from '../src/cli/mcp-install.js';

const HELP = `
easymd — collaborate on markdown files in your repo, live with humans and AI agents

Usage:
  easymd login                 Sign in with Clerk (opens your browser) and authorize this machine
  easymd logout                Remove stored credentials and stop auto-sync
  easymd whoami                Show the logged-in account

  easymd auto on [dir]         Start background auto-sync: every .md is pushed to your account
  easymd auto off              Stop background auto-sync
  easymd auto status           Show whether auto-sync is running

  easymd sync [dir]            One-shot: push all .md files under dir (default: .) to your account
  easymd watch [dir]           Foreground watcher (what 'auto on' runs in the background)

  easymd mcp                   Run the MCP server (stdio) so AI agents can edit your docs
  easymd mcp-install [agent]   Register the MCP server with Cursor / Claude (agent: --cursor | --claude-desktop)

  easymd open <file>           Open a local .md for real-time collaborative editing in the browser
  easymd open <file> --port N  Use a fixed port (default: random)

Environment:
  EASYMD_URL                   easymd web app URL (default: http://localhost:3000)

Examples:
  easymd login
  easymd auto on               # auto-sync the current repo's markdown into your account
  easymd sync ./docs
  easymd open CLAUDE.md
`.trim();

function flag(args, name) {
  return args.includes(name);
}

async function cmdOpen(args) {
  const file = args[0];
  if (!file) {
    console.error('Missing file path.\n');
    console.log(HELP);
    process.exit(1);
  }
  let port;
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1) {
    port = Number(args[portIdx + 1]);
    if (!Number.isFinite(port) || port < 1) {
      console.error('Invalid --port value.');
      process.exit(1);
    }
  }

  const absPath = resolve(file);
  try {
    await access(absPath);
  } catch {
    console.log(`Note: ${absPath} does not exist yet — it will be created on save.`);
  }

  // The local browser editor pulls in yjs/y-websocket/express — loaded lazily and as
  // optional deps so the core commands (login/auto/sync/mcp) never depend on them.
  let startServer;
  try {
    ({ startServer } = await import('../src/server.js'));
  } catch {
    console.error('`easymd open` needs the local editor packages. Install them with:');
    console.error('  npm i -g easymd-cli  (ensures optional deps), or run from the repo.');
    process.exit(1);
  }

  const { url, shutdown } = await startServer(absPath, { port });
  console.log('');
  console.log('  easymd');
  console.log('  ─────────────────────────────────────');
  console.log(`  File:  ${absPath}`);
  console.log(`  Local: ${url}`);
  console.log('  Share this URL with teammates on your network.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
  await openBrowser(url);

  const onExit = () => {
    shutdown();
    process.exit(0);
  };
  process.on('SIGINT', onExit);
  process.on('SIGTERM', onExit);
}

async function cmdAuto(args) {
  const sub = args[0];
  if (sub === 'on') {
    // One command does it all: log in via the browser if needed, then start auto-sync.
    const creds = await getCredentials();
    if (!creds?.token) {
      console.log('Not logged in yet — opening the browser to sign in first…\n');
      await login();
    }
    return autoOn(resolve(args[1] || '.'));
  }
  if (sub === 'off') return autoOff();
  if (sub === 'status' || !sub) return autoStatus();
  console.error(`Unknown: easymd auto ${sub}\n`);
  console.log('Use: easymd auto on|off|status');
  process.exit(1);
}

async function cmdWatch(args) {
  const dirArgs = args.filter((a) => !a.startsWith('-'));
  const root = resolve(dirArgs[0] || '.');
  const quiet = flag(args, '--quiet');
  const watcher = await watchDir(root, { quiet });
  const onExit = async () => {
    await watcher.close();
    process.exit(0);
  };
  process.on('SIGINT', onExit);
  process.on('SIGTERM', onExit);
}

async function cmdSync(args) {
  const dirArgs = args.filter((a) => !a.startsWith('-'));
  const root = resolve(dirArgs[0] || '.');
  await syncDir(root, { quiet: flag(args, '--quiet') });
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const rest = argv.slice(1);

  if (!command || command === '-h' || command === '--help' || command === 'help') {
    console.log(HELP);
    process.exit(0);
  }

  switch (command) {
    case 'login':
      return login();
    case 'logout':
      return logout();
    case 'whoami':
      return whoami();
    case 'auto':
      return cmdAuto(rest);
    case 'watch':
      return cmdWatch(rest);
    case 'sync':
      return cmdSync(rest);
    case 'mcp':
      // Importing starts the stdio MCP server (top-level await connect).
      await import('../src/cli/mcp.mjs');
      return;
    case 'mcp-install':
      return mcpInstall(rest[0]);
    case 'open':
      return cmdOpen(rest);
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('easymd:', err.message);
  process.exit(1);
});
