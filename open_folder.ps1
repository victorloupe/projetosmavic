# Handler robusto para abrir pastas locais a partir do protocolo mavic-folder://
param([string]$rawUri)

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    
    if (-not $rawUri) { exit }
    
    # 1. Remove aspas externas e espacos
    $p = $rawUri.Trim('"', "'", ' ', "`t", "`r", "`n")
    
    # 2. Remove o prefixo mavic-folder:// ou mavic-folder:
    $p = [regex]::Replace($p, '^(?i)mavic-folder:(//)?', '')
    
    # 3. Decodifica URL (ex: %20 -> espaco, %C3%87 -> C, etc.)
    try {
        $p = [System.Uri]::UnescapeDataString($p)
    } catch {}
    
    # 4. Remove aspas residuais
    $p = $p.Trim('"', "'", ' ', "`t", "`r", "`n")
    
    # 5. Normaliza barras para o padrao Windows
    $p = $p.Replace('/', '\')
    
    # 6. Remove barra final (exceto se for raiz como D:\)
    if ($p -notmatch '^[a-zA-Z]:\\$') {
        $p = $p.TrimEnd('\')
    }
    
    # 7. Verifica se a pasta existe
    if (Test-Path -LiteralPath $p) {
        # Abre diretamente no Windows Explorer
        Start-Process explorer.exe -ArgumentList "`"$p`""
    } else {
        # Se a pasta especifica nao existir, tenta abrir a pasta pai
        $parent = Split-Path -Parent $p
        if ($parent -and (Test-Path -LiteralPath $parent)) {
            Start-Process explorer.exe -ArgumentList "`"$parent`""
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.MessageBox]::Show("A subpasta nao foi encontrada:`n`n$p`n`nAbrindo pasta anterior:`n$parent", "MAVIC Projetos", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        } else {
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.MessageBox]::Show("A pasta informada nao foi encontrada no computador:`n`n$p`n`nVerifique se o caminho digitado esta correto.", "MAVIC Projetos - Pasta Nao Encontrada", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
        }
    }
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show("Erro ao abrir pasta:`n" + $_.Exception.Message, "MAVIC Projetos", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
}
