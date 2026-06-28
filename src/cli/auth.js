import { createServer } from 'http';
import openBrowser from 'open';
import {
  DEFAULT_URL,
  getCredentials,
  saveCredentials,
  clearCredentials,
  clearAuto,
  userIdFromToken,
} from './config.js';
import { autoOff } from './auto.js';

// Spin up a one-shot localhost server that the browser hands the token back to.
function startCallbackServer() {
  return new Promise((resolve) => {
    let resolveToken;
    const tokenPromise = new Promise((r) => (resolveToken = r));
    const server = createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname === '/callback') {
        const token = u.searchParams.get('token') || '';
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          `<!doctype html><html><body style="font-family:system-ui;text-align:center;padding:4rem;background:#0b0e13;color:#e6e8eb">
            <div style="display:inline-flex;width:48px;height:48px;align-items:center;justify-content:center;border-radius:12px;background:#c6f24e;color:#12160a;font-weight:700;font-size:20px">e</div>
            <h2 style="margin-top:1rem">✓ easymd CLI authorized</h2>
            <p style="color:#9aa3af">You can close this tab and return to your terminal.</p>
          </body></html>`,
        );
        resolveToken(token);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: server.address().port, tokenPromise, close: () => server.close() });
    });
  });
}

export async function login() {
  const base = DEFAULT_URL;
  const { port, tokenPromise, close } = await startCallbackServer();
  const url = `${base}/cli-auth?port=${port}`;

  console.log('\neasymd login');
  console.log('─────────────────────────────────────');
  console.log('Opening your browser to sign in with Clerk and authorize this machine:');
  console.log(`  ${url}\n`);

  try {
    await openBrowser(url);
  } catch {
    console.log('(Could not open a browser automatically — open the URL above manually.)');
  }
  console.log('Waiting for authorization…  (Ctrl+C to cancel)');

  const token = await Promise.race([
    tokenPromise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('Timed out waiting for authorization.')), 300000)),
  ]).finally(close);

  if (!token) throw new Error('No token received from the browser.');

  const { uid } = userIdFromToken(token);
  await saveCredentials({ token, userId: uid, url: base, savedAt: new Date().toISOString() });
  console.log(`\n✓ Logged in${uid ? ` as ${uid}` : ''}.`);
  console.log('  Credentials saved to ~/.easymd/credentials.json');
  console.log('  Next: `easymd auto on` to start syncing .md files to your account.\n');
}

export async function logout() {
  await autoOff().catch(() => {});
  await clearAuto().catch(() => {});
  // Revoke the token server-side so it can't be reused even if the file leaked.
  const creds = await getCredentials();
  if (creds?.token && creds?.url) {
    try {
      await fetch(`${creds.url}/api/cli/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${creds.token}` } });
    } catch {
      /* offline — local credentials are still removed below */
    }
  }
  await clearCredentials();
  console.log('✓ Logged out. Token revoked and credentials removed.');
}

export async function whoami() {
  const creds = await getCredentials();
  if (!creds?.token) {
    console.log('Not logged in. Run `easymd login`.');
    return;
  }
  const { uid, exp } = userIdFromToken(creds.token);
  const expired = exp && exp < Date.now();
  console.log(`Account: ${uid || creds.userId || 'unknown'}`);
  console.log(`Server:  ${creds.url}`);
  console.log(`Status:  ${expired ? 'EXPIRED — run `easymd login` again' : 'active'}`);
}
