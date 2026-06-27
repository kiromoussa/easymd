#!/usr/bin/env node

import { resolve } from 'path';
import { access } from 'fs/promises';
import openBrowser from 'open';
import { startServer } from '../src/server.js';

const HELP = `
easymd — collaborate on markdown files in your repo

Usage:
  easymd open <file>          Open a .md file for real-time collaborative editing
  easymd open <file> --port N Use a fixed port (default: random)

Examples:
  easymd open CLAUDE.md
  easymd open path/to/AGENTS.md
  easymd open ./docs/spec.md --port 3847

Changes sync directly to the file on disk. Share the URL with teammates on your network.
`.trim();

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    return { help: true };
  }

  const command = args[0];
  if (command !== 'open') {
    console.error(`Unknown command: ${command}\n`);
    return { help: true, error: true };
  }

  const file = args[1];
  if (!file) {
    console.error('Missing file path.\n');
    return { help: true, error: true };
  }

  let port;
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1) {
    port = Number(args[portIdx + 1]);
    if (!Number.isFinite(port) || port < 1) {
      console.error('Invalid --port value.\n');
      return { help: true, error: true };
    }
  }

  return { file, port };
}

async function main() {
  const parsed = parseArgs(process.argv);

  if (parsed.help) {
    console.log(HELP);
    process.exit(parsed.error ? 1 : 0);
  }

  const absPath = resolve(parsed.file);

  try {
    await access(absPath);
  } catch {
    // File may not exist yet — easymd will create it on first edit
    console.log(`Note: ${absPath} does not exist yet — it will be created on save.`);
  }

  const { port, url, shutdown } = await startServer(absPath, { port: parsed.port });

  console.log('');
  console.log(`  easymd`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  File:  ${absPath}`);
  console.log(`  Local: ${url}`);
  console.log(`  Share this URL with teammates on your network.`);
  console.log(`  Press Ctrl+C to stop.`);
  console.log('');

  await openBrowser(url);

  const onExit = () => {
    shutdown();
    process.exit(0);
  };

  process.on('SIGINT', onExit);
  process.on('SIGTERM', onExit);
}

main().catch((err) => {
  console.error('easymd failed:', err.message);
  process.exit(1);
});
