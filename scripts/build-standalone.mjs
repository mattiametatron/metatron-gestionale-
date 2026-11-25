import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const distAssetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(distDir)) {
  console.error('[!] Cartella dist non trovata. Esegui prima "npm run build".');
  process.exit(1);
}

// 1. Trova file CSS e JS entry point corretto
const files = fs.readdirSync(distAssetsDir);
const cssFile = files.find((f) => f.endsWith('.css'));

// Leggi prima dist/index.html per sapere qual è l'entry point reale
let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const entryMatch = html.match(/src="\/assets\/([^"]+\.js)"/);
let jsFile = entryMatch ? entryMatch[1] : null;

if (!jsFile) {
  jsFile = files.find((f) => f.startsWith('index') && f.endsWith('.js')) || files.find((f) => f.endsWith('.js'));
}

if (!cssFile || !jsFile) {
  console.error('[!] File CSS o JS non trovati in dist/assets.');
  process.exit(1);
}

console.log(`[+] CSS trovato: ${cssFile}`);
console.log(`[+] JS ENTRY POINT reale trovato: ${jsFile}`);

const cssContent = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf8');
const jsContent = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf8');

// Favicon inline SVG
let iconDataUri = '';
const iconPath = path.join(projectRoot, 'public', 'icon.svg');
if (fs.existsSync(iconPath)) {
  const iconSvg = fs.readFileSync(iconPath, 'utf8');
  iconDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(iconSvg)}`;
}

// 2. Rimuovi o ripulisci tag che non servono nel file standalone locale
html = html.replace(/<link rel="manifest"[^>]*>/gi, '');
html = html.replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/gi, '');
html = html.replace(/<link rel="stylesheet"[^>]*>/gi, '');
html = html.replace(/<script type="module"[^>]*src="\/assets\/[^"]+"[^>]*><\/script>/gi, '');

// 4. Includi Favicon inline
if (iconDataUri) {
  html = html.replace(
    /<link rel="icon"[^>]*>/gi,
    () => `<link rel="icon" type="image/svg+xml" href="${iconDataUri}" />`
  );
}

// 5. Inserisci CSS inline dentro <head>
html = html.replace(
  '</head>',
  () => `\n    <style id="caricostudio-desktop-styles">\n${cssContent}\n    </style>\n  </head>`
);

// 6. Inserisci JS inline prima di </body>
// ESCAPING FONDAMENTALE: qualsiasi occorrenza di </script dentro stringhe JS DEVE essere scritta <\/script
// altrimenti il parser HTML del browser chiude il tag <script> prematuramente!
const safeJsContent = jsContent.replace(/<\/script/gi, '<\\/script');

html = html.replace(
  '</body>',
  () => `\n    <script type="module" id="caricostudio-desktop-bundle">\n${safeJsContent}\n    </script>\n  </body>`
);

// 7. Salva il file standalone
const targets = [
  path.join(projectRoot, 'CaricoStudio_Desktop_Windows.html'),
  path.join(projectRoot, 'public', 'CaricoStudio_Desktop_Windows.html'),
  path.join(distDir, 'CaricoStudio_Desktop_Windows.html'),
];

for (const target of targets) {
  fs.writeFileSync(target, html, 'utf8');
  console.log(`[✓] File standalone scritto: ${target} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
}

// 8. Verifica validità strutturale
if (!html.includes('<div id="root"></div>')) {
  console.error('[!] Errore critico: <div id="root"></div> non trovato nell\'HTML!');
  process.exit(1);
}

const rootPos = html.indexOf('<div id="root"></div>');
const scriptPos = html.indexOf('<script type="module" id="caricostudio-desktop-bundle">');
const scriptEndPos = html.indexOf('</script>', scriptPos);

if (scriptPos <= rootPos) {
  console.error('[!] Errore: Lo script deve trovarsi DOPO #root!');
  process.exit(1);
}

if (scriptEndPos === -1) {
  console.error('[!] Errore: Chiusura script </script> non trovata!');
  process.exit(1);
}

const trailingAfterScript = html.slice(scriptEndPos + 9).replace(/\s+/g, ' ').trim();
if (!trailingAfterScript.startsWith('</body> </html>') && !trailingAfterScript.startsWith('</body></html>')) {
  console.error('[!] Errore: Codice spazzatura trovato dopo </script>:', trailingAfterScript);
  process.exit(1);
}

console.log('[✓] VERIFICA SUPERATA: Struttura HTML integra, nessuno script fuoriuscito nel DOM!');
