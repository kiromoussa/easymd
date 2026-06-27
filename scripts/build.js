import esbuild from 'esbuild';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outdir = join(root, 'dist');

await mkdir(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'client/main.js')],
  bundle: true,
  outfile: join(outdir, 'client.js'),
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
});

console.log('Built client bundle → dist/client.js');
