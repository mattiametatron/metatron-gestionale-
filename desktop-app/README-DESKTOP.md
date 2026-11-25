# METATRON CaricoStudio — Software Desktop Autonomo (.exe / Mac / Linux)

Questa cartella trasforma **METATRON CaricoStudio** in un **vero programma desktop installabile e portatile** con motore server interno incluso.
Chi lo riceve **non deve installare Chrome, Node.js né server esterni**: basta un doppio clic sull'eseguibile.

---

## Cosa genera la compilazione

Nella cartella `release/` vengono creati due file per Windows:
1. **`METATRON-CaricoStudio-Setup.exe`** — Installer classico di Windows (crea l'icona sul Desktop e nel Menu Start).
2. **`METATRON-CaricoStudio-Portable.exe`** — **Versione Portatile in un unico file `.exe`**: puoi metterlo in uno `.zip` o su una chiavetta USB e inviarlo a chiunque.

Su macOS genera **`.dmg`**, su Linux genera **`.AppImage`** e **`.deb`**.

---

## Metodo 1: Compila sul tuo PC Windows (1 doppio clic)

1. Scarica o estrai la cartella del progetto sul tuo PC Windows.
2. Assicurati di avere installato **Node.js LTS** (https://nodejs.org/ — installazione rapida "Avanti → Avanti → Fine").
3. Apri la cartella `desktop-app/` e fai **doppio clic** su:
   ```text
   CREA-SOFTWARE-WINDOWS.bat
   ```
4. Al termine si aprirà automaticamente la cartella `release/` con gli `.exe` pronti da usare o zippare!

---

## Metodo 2: Genera `.exe`, `.dmg` e `.AppImage` gratis nel Cloud (senza installare nulla)

Nel progetto è già pronto il workflow automatico `.github/workflows/build-desktop.yml`:
1. Carica il progetto su un repository **GitHub** (anche privato).
2. Vai nella scheda **Actions** → seleziona **Build METATRON Desktop Software (.exe / .dmg / .AppImage)**.
3. Clicca **Run workflow**.
4. Dopo qualche minuto scarichi gli ZIP già compilati per **Windows (.exe)**, **macOS (.dmg)** e **Linux (.AppImage)** direttamente dalla sezione *Artifacts*!

---

## Dove vengono salvati i dati sul PC?

Il software salva utenti, magazzino, foto, file, calendari e backup in modo permanente e isolato nella cartella dati del sistema operativo (così non perdi mai nulla aggiornando il programma):
- **Windows:** `%APPDATA%\METATRON CaricoStudio\data`
- **macOS:** `~/Library/Application Support/METATRON CaricoStudio/data`
- **Linux:** `~/.config/METATRON CaricoStudio/data`

Puoi aprirla in qualsiasi momento dal menu in alto del programma: **METATRON → Apri Cartella Dati & Backup**.

## Rete locale multi-dispositivo inclusa

Anche nella versione software `.exe`, il motore interno resta raggiungibile dagli altri PC, tablet e smartphone sulla stessa rete Wi-Fi/LAN! Dal menu **METATRON → Copia Indirizzo Rete LAN** copi subito il link per i colleghi.
