import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { dirname, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getYDoc, setupWSConnection } from 'y-websocket/bin/utils';
import { createFileSync } from './file-sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/**
 * Start a local server that binds one Yjs doc to one markdown file on disk.
 */
export async function startServer(filePath, options = {}) {
  const absPath = resolve(filePath);
  const docName = absPath;
  const ydoc = getYDoc(docName, false);
  const ytext = ydoc.getText('markdown');

  const fileSync = createFileSync(absPath, ytext);
  await fileSync.loadFromDisk();

  const app = express();

  app.get('/api/session', (_req, res) => {
    res.json({
      filePath: absPath,
      fileName: basename(absPath),
      docName,
    });
  });

  app.use(express.static(resolve(ROOT, 'dist')));
  app.use(express.static(resolve(ROOT, 'client')));

  app.get('*', (_req, res) => {
    res.sendFile(resolve(ROOT, 'client/index.html'));
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      setupWSConnection(ws, request, { docName, gc: false });
    });
  });

  const port = await new Promise((resolvePort, reject) => {
    server.listen(options.port ?? 0, options.host ?? '127.0.0.1', () => {
      const addr = server.address();
      resolvePort(typeof addr === 'object' ? addr.port : options.port);
    });
    server.on('error', reject);
  });

  const shutdown = () => {
    fileSync.destroy();
    wss.close();
    server.close();
  };

  return { port, url: `http://127.0.0.1:${port}`, filePath: absPath, shutdown };
}
