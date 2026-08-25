@echo off
title Instalador do Protocolo de Pastas - MAVIC Projetos
echo ========================================================
echo   Instalando suporte a abertura de pastas no MAVIC...
echo ========================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar_abrir_pasta.ps1"
echo.
echo ========================================================
echo   Concluido! Agora o botao de pasta vai funcionar.
echo ========================================================
pause
