@echo off
title CAPS Turnos - Actualizacion
echo.
echo === Actualizacion de CAPS Turnos ===
echo Usar SOLO si el sistema ya esta instalado en esta PC.
echo Esta es la carpeta NUEVA (la que descargaste). La vieja no se toca.
echo Antes: MySQL prendido en el panel de XAMPP y la ventana del sistema viejo cerrada.
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

echo [2/4] Copiando la configuracion y poniendo la base al dia...
node scripts\actualizar.js
if errorlevel 1 goto error

echo [3/4] Instalando dependencias del frontend...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 goto error

echo [4/4] Compilando el frontend...
call npm run build
if errorlevel 1 goto error

echo.
echo ============================================================
echo  Listo. Abri el sistema con iniciar.bat DE ESTA CARPETA.
echo  Cuando veas que todo anda bien, podes borrar la carpeta vieja.
echo ============================================================
echo.
pause
exit /b 0

:error
echo.
echo La actualizacion se freno por un error (miralo arriba).
echo La carpeta vieja no se toco: pueden seguir usandola con su iniciar.bat.
pause
exit /b 1
