import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'dist-electron');
const outFile = path.join(outDir, 'server.cjs');
const legacyMjs = path.join(outDir, 'server.mjs');
const pdfkitDataSrc = path.join(rootDir, 'node_modules', 'pdfkit', 'js', 'data');
const pdfkitDataDst = path.join(outDir, 'data');
const webSrc = path.join(rootDir, 'dist');
const webDst = path.join(outDir, 'web');

function copyDirFiltered(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'CaricoStudio_Desktop_Windows.html' || entry.name.endsWith('.map')) {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirFiltered(srcPath, dstPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

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

// Copia l'interfaccia web compilata (dist/) direttamente in dist-electron/web/
// così viene sempre impacchettata insieme a server.cjs senza essere filtrata da .gitignore o asar.
if (fs.existsSync(path.join(webSrc, 'index.html'))) {
  if (fs.existsSync(webDst)) {
    fs.rmSync(webDst, { recursive: true, force: true });
  }
  copyDirFiltered(webSrc, webDst);
  const copiedIndex = path.join(webDst, 'index.html');
  if (!fs.existsSync(copiedIndex)) {
    throw new Error('Copia dist-electron/web/index.html fallita!');
  }
  console.log('[METATRON Desktop] Interfaccia web copiata in dist-electron/web (index.html OK)');
} else {
  console.warn(
    '[METATRON Desktop] Avviso: dist/index.html non trovato. Esegui "npm run build" prima di impacchettare il .exe.'
  );
}

const stats = fs.statSync(outFile);
console.log(
  `[METATRON Desktop] Motore server autonomo pronto: ${outFile} (${(stats.size / 1024).toFixed(1)} KB)`
);
