# Script para registrar o protocolo mavic-folder:// no Windows apontando para open_folder.ps1
$handlerScript = Join-Path $PSScriptRoot "open_folder.ps1"

# Comando que executa o script PowerShell de forma silenciosa
$commandVal = "powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$handlerScript`" `"%1`""

New-Item -Path 'HKCU:\Software\Classes\mavic-folder' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\Classes\mavic-folder' -Name '(default)' -Value 'URL:Mavic Folder Protocol'
Set-ItemProperty -Path 'HKCU:\Software\Classes\mavic-folder' -Name 'URL Protocol' -Value ''
New-Item -Path 'HKCU:\Software\Classes\mavic-folder\shell\open\command' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\Classes\mavic-folder\shell\open\command' -Name '(default)' -Value $commandVal

Write-Host "Protocolo mavic-folder registrado com sucesso apontando para $handlerScript!" -ForegroundColor Green
