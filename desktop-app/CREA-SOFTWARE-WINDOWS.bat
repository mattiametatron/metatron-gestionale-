@echo off
setlocal EnableDelayedExpansion

echo ============================================================================
echo   METATRON CaricoStudio - Creazione Software Desktop Windows (.exe)
echo ============================================================================
echo.

set "PROJ_DIR="
if exist "%~dp0package.json" set "PROJ_DIR=%~dp0"
if not defined PROJ_DIR if exist "%~dp0..\package.json" set "PROJ_DIR=%~dp0.."

if not defined PROJ_DIR (
  echo [ERRORE] Cartella del progetto non trovata ^(manca package.json^).
  echo.
  echo Non avviare solo il file .bat da solo nella cartella Download!
  echo 1. Torna nell'app METATRON ^> Pannello Server OS ^> Software Desktop ^(.exe^)
  echo 2. Clicca "Scarica Pacchetto Completo (.zip)"
  echo 3. Estrai lo ZIP in una cartella sul PC
  echo 4. Apri la cartella estratta e fai doppio clic su CREA-SOFTWARE-WINDOWS.bat
  echo.
  pause
  exit /b 1
)

cd /d "%PROJ_DIR%"
echo Cartella progetto rilevata: %CD%
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERRORE] Node.js non trovato su questo PC.
  echo Scarica e installa Node.js LTS da: https://nodejs.org/
  echo Poi rilancia questo file con un doppio clic.
  echo.
  pause
  exit /b 1
)

echo [1/4] Installazione dipendenze progetto...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
  echo [ERRORE] Installazione dipendenze fallita.
  pause
  exit /b 1
)

echo.
echo [2/4] Installazione motore desktop Electron e compilatore .exe...
call npm install --save-dev --legacy-peer-deps electron electron-builder
if %errorlevel% neq 0 (
  echo [ERRORE] Installazione Electron fallita.
  pause
  exit /b 1
)

echo.
echo [3/4] Compilazione interfaccia e motore server interno...
call npm run build
if %errorlevel% neq 0 (
  echo [ERRORE] Compilazione frontend fallita.
  pause
  exit /b 1
)

call node scripts/build-desktop-server.mjs
if %errorlevel% neq 0 (
  echo [ERRORE] Compilazione server desktop fallita.
  pause
  exit /b 1
)

echo.
echo [4/4] Generazione Installer Windows (.exe) e Versione Portable (.exe)...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win --config desktop-app/electron-builder.json --publish never
if %errorlevel% neq 0 (
  echo [ERRORE] Creazione file .exe fallita.
  pause
  exit /b 1
)

echo.
echo ============================================================================
echo   COMPLETATO! Trovi i tuoi file pronti nella cartella: release\
echo   - METATRON-CaricoStudio-Setup-1.0.0.exe     (Installer con icona Desktop)
echo   - METATRON-CaricoStudio-Portable-1.0.0.exe  (File unico pronto da zippare!)
echo ============================================================================
echo.

if exist "%CD%\release" (
  explorer "%CD%\release"
)
pause
