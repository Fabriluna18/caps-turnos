@echo off
title CAPS Turnos
echo.
echo === CAPS Turnos ===
echo Acordate: MySQL tiene que estar prendido en el panel de XAMPP.
echo Para cerrar el sistema, cerra esta ventana.
echo.

if not exist "%~dp0frontend\dist\index.html" (
  echo Falta compilar el frontend. Corre primero instalar.bat
  pause
  exit /b 1
)
if not exist "%~dp0backend\.env" (
  echo Falta el archivo backend\.env. Corre primero instalar.bat
  pause
  exit /b 1
)

cd /d "%~dp0backend"
start "" http://localhost:3001
node index.js
pause
