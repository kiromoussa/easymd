import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile, rm } from 'fs/promises';

export const CONFIG_DIR = join(homedir(), '.easymd');
const CRED_FILE = join(CONFIG_DIR, 'credentials.json');
const AUTO_FILE = join(CONFIG_DIR, 'auto.json');

// Where the easymd web app lives. Override with EASYMD_URL for self-hosted / production.
export const DEFAULT_URL = process.env.EASYMD_URL || 'http://localhost:3000';

async function readJson(p) {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return null;
  }
}
async function writeJson(p, obj) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(p, JSON.stringify(obj, null, 2), { mode: 0o600 });
}

export const getCredentials = () => readJson(CRED_FILE);
export const saveCredentials = (c) => writeJson(CRED_FILE, c);
export const clearCredentials = () => rm(CRED_FILE, { force: true });

export const getAuto = () => readJson(AUTO_FILE);
export const saveAuto = (a) => writeJson(AUTO_FILE, a);
export const clearAuto = () => rm(AUTO_FILE, { force: true });

// Decode the Clerk user id baked into a CLI token (easymd_<b64url payload>.<sig>).
export function userIdFromToken(token) {
  try {
    const body = token.slice('easymd_'.length);
    const payload = body.slice(0, body.indexOf('.'));
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return { uid: json.uid || null, exp: json.exp || 0 };
  } catch {
    return { uid: null, exp: 0 };
  }
}

// Returns credentials if present and unexpired, else throws a helpful error.
export async function requireCredentials() {
  const creds = await getCredentials();
  if (!creds?.token) {
    throw new Error('Not logged in. Run `easymd login` first.');
  }
  const { exp } = userIdFromToken(creds.token);
  if (exp && exp < Date.now()) {
    throw new Error('Your session has expired. Run `easymd login` again.');
  }
  return creds;
}
