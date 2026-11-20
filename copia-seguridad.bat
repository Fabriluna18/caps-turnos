@echo off
title CAPS Turnos - Copia de seguridad
echo.
echo === Copia de seguridad de CAPS Turnos ===
echo (MySQL tiene que estar prendido en el panel de XAMPP)
echo.
cd /d "%~dp0backend"
call npm run copia
echo.
echo Las copias quedan en la carpeta "copias". Conviene pasarlas a un pendrive cada tanto.
pause
