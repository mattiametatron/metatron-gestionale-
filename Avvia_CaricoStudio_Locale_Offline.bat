@echo off
title Installazione e Avvio Locale CaricoStudio su Windows
echo ====================================================================
echo   CARICOSTUDIO - AVVIO LOCALE OFFLINE SU WINDOWS 10 / 11
echo ====================================================================
echo.
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js non trovato. Per eseguire il codice sorgente in locale installa Node.js da https://nodejs.org/
    echo In alternativa esegui CaricoStudio_Software_Windows.bat per l'avvio immediato!
    pause
    exit /b
)
if not exist "node_modules" (
    echo [1/2] Prima installazione dipendenze in corso...
    call npm install
)
echo [2/2] Avvio di CaricoStudio Desktop su porta 3000...
start "" msedge --app="http://localhost:3000" --start-maximized
call npm run dev
pause
