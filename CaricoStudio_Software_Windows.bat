@echo off
title CaricoStudio - Gestionale Magazzino Windows
setlocal

REM Cerca il file CaricoStudio_Desktop_Windows.html nella stessa cartella o in Download/Desktop
set "APP_FILE=%~dp0CaricoStudio_Desktop_Windows.html"
if not exist "%APP_FILE%" (
    set "APP_FILE=%~dp0public\CaricoStudio_Desktop_Windows.html"
)
if not exist "%APP_FILE%" (
    set "APP_FILE=%USERPROFILE%\Downloads\CaricoStudio_Desktop_Windows.html"
)
if not exist "%APP_FILE%" (
    set "APP_FILE=%USERPROFILE%\Desktop\CaricoStudio_Desktop_Windows.html"
)

if not exist "%APP_FILE%" (
    echo [!] File CaricoStudio_Desktop_Windows.html non trovato!
    echo Scarica prima il file CaricoStudio_Desktop_Windows.html e posizionalo in Download o sul Desktop.
    pause
    exit /b
)

REM Apre CaricoStudio in una finestra nativa desktop Windows 11 (senza barre del browser)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="file:///%APP_FILE:\=/%" --start-maximized
    exit
)
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app="file:///%APP_FILE:\=/%" --start-maximized
    exit
)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="file:///%APP_FILE:\=/%" --start-maximized
    exit
)

start "" "%APP_FILE%"
exit
