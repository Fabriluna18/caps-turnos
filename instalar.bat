@echo off
title CAPS Turnos - Instalacion
echo.
echo === Instalacion de CAPS Turnos ===
echo Antes: tener instalados XAMPP y Node.js, y MySQL prendido en el panel de XAMPP.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo No encuentro Node.js. Instalalo desde https://nodejs.org (version LTS^) y volve a probar.
  pause
  exit /b 1
)

echo [1/4] Instalando dependencias del backend...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 goto error

echo [2/4] Instalando dependencias del frontend...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 goto error

echo [3/4] Compilando el frontend...
call npm run build
if errorlevel 1 goto error

echo [4/4] Preparando la base de datos...
cd /d "%~dp0backend"
call npm run instalar
if errorlevel 1 goto error

pause
exit /b 0

:error
echo.
echo La instalacion se freno por un error (miralo arriba).
pause
exit /b 1
