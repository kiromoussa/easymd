import chokidar from 'chokidar';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

const DEBOUNCE_MS = 250;

/**
 * Keeps a Y.Text in sync with a file on disk — disk is canonical.
 * External edits (git, agents, other tools) flow in; editor edits flow out.
 */
export function createFileSync(filePath, ytext) {
  let writing = false;
  let debounceTimer = null;
  let destroyed = false;

  async function readDisk() {
    try {
      return await readFile(filePath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') return '';
      throw err;
    }
  }

  async function loadFromDisk() {
    const content = await readDisk();
    if (ytext.toString() !== content) {
      ytext.doc.transact(() => {
        ytext.delete(0, ytext.length);
        if (content) ytext.insert(0, content);
      });
    }
  }

  async function writeToDisk() {
    if (destroyed || writing) return;
    writing = true;
    try {
      const content = ytext.toString();
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf-8');
    } finally {
      writing = false;
    }
  }

  function scheduleWrite() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      writeToDisk().catch((err) => console.error('easymd: write failed', err));
    }, DEBOUNCE_MS);
  }

  const unobserve = ytext.observe(() => {
    scheduleWrite();
  });

  const watcher = chokidar.watch(filePath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  watcher.on('change', async () => {
    if (writing || destroyed) return;
    const disk = await readDisk();
    if (disk !== ytext.toString()) {
      ytext.doc.transact(() => {
        ytext.delete(0, ytext.length);
        if (disk) ytext.insert(0, disk);
      });
    }
  });

  watcher.on('add', loadFromDisk);

  return {
    loadFromDisk,
    destroy() {
      destroyed = true;
      clearTimeout(debounceTimer);
      unobserve();
      watcher.close();
    },
  };
}
