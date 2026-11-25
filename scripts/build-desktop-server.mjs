import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'dist-electron');
const outFile = path.join(outDir, 'server.cjs');
const legacyMjs = path.join(outDir, 'server.mjs');
const pdfkitDataSrc = path.join(rootDir, 'node_modules', 'pdfkit', 'js', 'data');
const pdfkitDataDst = path.join(outDir, 'data');

fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(legacyMjs)) {
  fs.rmSync(legacyMjs, { force: true });
}

console.log('[METATRON Desktop] Compilazione motore server autonomo in dist-electron/server.cjs...');

await esbuild.build({
  entryPoints: [path.join(rootDir, 'server.ts')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  mainFields: ['main', 'module'],
  sourcemap: false,
  define: {
    'import.meta.url': '__metatronImportMetaUrl',
  },
  banner: {
    js: "const __metatronImportMetaUrl = require('node:url').pathToFileURL(__filename).href;",
  },
  // Tutte le dipendenze runtime (express, ws, dotenv, fflate, pdfkit, @google/genai)
  // vengono incluse direttamente nel bundle CJS così ELECTRON_RUN_AS_NODE non dipende
  // mai da node_modules dentro app.asar su Windows/Linux/macOS.
  // Restano esterni solo vite (mai usato in production) e le estensioni native opzionali di ws.
  external: [
    'vite',
    'electron',
    'bufferutil',
    'utf-8-validate',
  ],
});

if (fs.existsSync(pdfkitDataSrc)) {
  fs.mkdirSync(pdfkitDataDst, { recursive: true });
  for (const entry of fs.readdirSync(pdfkitDataSrc)) {
    const src = path.join(pdfkitDataSrc, entry);
    const dst = path.join(pdfkitDataDst, entry);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dst);
    }
  }
  console.log('[METATRON Desktop] Font AFM PDFKit copiati in dist-electron/data');
}

const stats = fs.statSync(outFile);
console.log(
  `[METATRON Desktop] Motore server autonomo pronto: ${outFile} (${(stats.size / 1024).toFixed(1)} KB)`
);
