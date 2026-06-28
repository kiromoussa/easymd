import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { getAuto, saveAuto, clearAuto, requireCredentials } from './config.js';

const BIN = fileURLToPath(new URL('../../bin/easymd.js', import.meta.url));

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Toggle the background watcher ON: spawn a detached `easymd watch` process that
// keeps running after this command (and the terminal) exits.
export async function autoOn(root) {
  await requireCredentials(); // fail fast if not logged in

  const existing = await getAuto();
  if (existing && isAlive(existing.pid)) {
    console.log(`Auto-sync is already ON (pid ${existing.pid}, watching ${existing.root}).`);
    return;
  }

  const child = spawn(process.execPath, [BIN, 'watch', root, '--quiet'], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  await saveAuto({ pid: child.pid, root, startedAt: new Date().toISOString() });

  console.log(`✓ Auto-sync ON — watching ${root} (pid ${child.pid}).`);
  console.log('  Every new or changed .md file now syncs to your easymd account automatically.');
  console.log('  Turn it off with `easymd auto off`.');
}

export async function autoOff() {
  const a = await getAuto();
  if (!a) {
    console.log('Auto-sync is already OFF.');
    return;
  }
  if (isAlive(a.pid)) {
    try {
      process.kill(a.pid);
    } catch {
      /* already gone */
    }
  }
  await clearAuto();
  console.log('✓ Auto-sync OFF.');
}

export async function autoStatus() {
  const a = await getAuto();
  if (a && isAlive(a.pid)) {
    console.log(`Auto-sync: ON — pid ${a.pid}, watching ${a.root} (since ${a.startedAt}).`);
  } else {
    if (a) await clearAuto(); // stale pid file
    console.log('Auto-sync: OFF.');
  }
}
