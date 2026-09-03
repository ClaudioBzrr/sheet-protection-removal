# Gera dist/sheet-unlock.exe a partir do blob SEA (Windows).
# Uso: npm run build:exe
$ErrorActionPreference = 'Stop'

$dist = Join-Path (Join-Path $PSScriptRoot '..') 'dist'
$exe = Join-Path $dist 'sheet-unlock.exe'
$blob = Join-Path $dist 'sea-prep.blob'

if (-not (Test-Path $blob)) {
    throw "Blob SEA não encontrado: $blob (rode: node --experimental-sea-config sea-config.json)"
}

$nodePath = (Get-Command node).Source
Write-Host "Node base: $nodePath"

# Detecta o sentinel FUSE do Node atual (mudou no Node 24)
$fuse = node -e "const fs=require('fs');const d=fs.readFileSync(process.execPath);const m=d.toString('latin1').match(/NODE_SEA_FUSE_[0-9a-f]+/);if(!m){process.exit(1)}console.log(m[0])"
if (-not $fuse) { throw 'Não foi possível detectar NODE_SEA_FUSE no node.exe' }
Write-Host "Sentinel: $fuse"

# Copia o node atual como base do executável
Copy-Item -LiteralPath $nodePath -Destination $exe -Force

# Remove assinatura (se signtool disponível) para o postject poder injetar
$signtool = Get-ChildItem -Recurse -Filter 'signtool.exe' -Path 'C:\Program Files (x86)\Windows Kits' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if ($signtool) {
    Write-Host "Removendo assinatura com: $signtool"
    & $signtool remove /s $exe
} else {
    Write-Host 'signtool não encontrado, tentando injetar mesmo assim…'
}

# Injeta o blob
npx --yes postject $exe NODE_SEA_BLOB $blob --sentinel-fuse $fuse

Write-Host "OK: $exe" -ForegroundColor Green
Write-Host 'Teste: .\dist\sheet-unlock.exe --help  ou arraste um .xlsx para cima do .exe'
