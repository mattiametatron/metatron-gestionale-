import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'dist-electron');
const outFile = path.join(outDir, 'server.mjs');

fs.mkdirSync(outDir, { recursive: true });

console.log('[METATRON Desktop] Compilazione motore server interno in dist-electron/server.mjs...');

await esbuild.build({
  entryPoints: [path.join(rootDir, 'server.ts')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: false,
  // Le dipendenze runtime restano in node_modules (es. pdfkit con i suoi font AFM),
  // mentre vite NON viene mai importato in NODE_ENV=production
  external: [
    'vite',
    'express',
    'ws',
    'pdfkit',
    'qrcode',
    'dotenv',
    '@google/genai',
    'fflate',
    'electron',
  ],
  banner: {
    js: "import { createRequire as __metatronCreateRequire } from 'node:module'; const require = __metatronCreateRequire(import.meta.url);",
  },
});

const stats = fs.statSync(outFile);
console.log(
  `[METATRON Desktop] Motore server pronto: ${outFile} (${(stats.size / 1024).toFixed(1)} KB)`
);
