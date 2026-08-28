# Handler robusto para abrir pastas locais a partir do protocolo mavic-folder://
# Verifica e cria automaticamente a pasta raiz e as subpastas padrao do projeto
param([string]$rawUri)

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    
    if (-not $rawUri) { exit }
    
    # 1. Limpa aspas e espacos externos
    $raw = $rawUri.Trim('"', "'", ' ', "`t", "`r", "`n")
    
    # 2. Remove o prefixo do protocolo
    $raw = [regex]::Replace($raw, '^(?i)mavic-folder:(//)?', '')
    $raw = $raw.Trim('"', "'", ' ', "`t", "`r", "`n")

    $targetPath = ""
    $folders = @()
    $projType = ""

    # 3. Identifica o formato do parametro recebido
    if ($raw -match '(?i)b64=([^&"''\s]+)') {
        $b64Val = [System.Uri]::UnescapeDataString($matches[1]).TrimEnd('/', '\')
        $bytes = [System.Convert]::FromBase64String($b64Val)
        $jsonStr = [System.Text.Encoding]::UTF8.GetString($bytes)
        $obj = $jsonStr | ConvertFrom-Json
        $targetPath = $obj.path
        $projType = $obj.type
        if ($obj.folders) {
            $folders = @($obj.folders)
        }
    } elseif ($raw -match '[\?&]path=' -or $raw -match '^path=') {
        $cleanQ = [regex]::Replace($raw, '^(?i)open[\\/]*\??', '')
        $cleanQ = $cleanQ.TrimStart('?', '&')
        $pairs = $cleanQ.Split('&')
        $dict = @{}
        foreach ($pair in $pairs) {
            $kv = $pair.Split('=', 2)
            if ($kv.Length -eq 2) {
                $dict[[System.Uri]::UnescapeDataString($kv[0])] = [System.Uri]::UnescapeDataString($kv[1])
            }
        }
        $targetPath = $dict['path']
        $projType = $dict['type']
        if ($dict['folders']) {
            $folders = $dict['folders'].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
        }
    } else {
        # Formato legado (caminho direto)
        try {
            $targetPath = [System.Uri]::UnescapeDataString($raw)
        } catch {
            $targetPath = $raw
        }
    }

    if (-not $targetPath) { exit }

    # 4. Normaliza caminho para Windows
    $targetPath = $targetPath.Trim('"', "'", ' ', "`t", "`r", "`n")
    $targetPath = $targetPath.Replace('/', '\')
    if ($targetPath -notmatch '^[a-zA-Z]:\\$') {
        $targetPath = $targetPath.TrimEnd('\')
    }

    # 5. Cria a pasta raiz do projeto se nao existir
    if (-not (Test-Path -LiteralPath $targetPath)) {
        New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
    }

    # 6. Cria as subpastas padrao faltantes (sem sobrescrever nada existente)
    if ($folders -and $folders.Count -gt 0) {
        foreach ($sub in $folders) {
            if (-not $sub) { continue }
            $cleanSub = $sub.Trim(' ', '\', '/').Replace('/', '\')
            if (-not $cleanSub) { continue }
            $fullSub = Join-Path $targetPath $cleanSub
            if (-not (Test-Path -LiteralPath $fullSub)) {
                New-Item -ItemType Directory -Path $fullSub -Force | Out-Null
            }
        }
    }

    # 7. Abre a pasta no Windows Explorer
    if (Test-Path -LiteralPath $targetPath) {
        Start-Process explorer.exe -ArgumentList "`"$targetPath`""
    } else {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show("A pasta informada nao pôde ser acessada:`n`n$targetPath", "MAVIC Projetos", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
    }

} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show("Erro ao processar pasta do projeto:`n" + $_.Exception.Message, "MAVIC Projetos", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
}
