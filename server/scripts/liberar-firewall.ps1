# Libera a porta do EVA S no Firewall do Windows.
#
# Motivo: ao entrar num hotspot de celular ou Wi-Fi novo, o Windows classifica a rede
# como "Publica" e bloqueia toda conexao vinda de fora. O servidor sobe normalmente, a
# maquina abre http://localhost sem problema, e o celular do jogador so ve "site
# inacessivel" — sem nenhum erro do lado do servidor que denuncie o motivo.
#
# Uso:  npm run firewall          (na pasta server, ou "npm run firewall" na raiz)
#       $env:PORT=3001; npm run firewall     para outra porta

param(
    [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 80 })
)

$ErrorActionPreference = 'Stop'

# Criar regra de firewall exige elevacao — reabre o proprio script como administrador.
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Pedindo permissao de administrador..." -ForegroundColor Yellow
    $args = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port $Port"
    Start-Process powershell -Verb RunAs -ArgumentList $args
    exit 0
}

$httpRule = "EVA S - RPG Manager (TCP $Port)"
$mdnsRule = "EVA S - RPG Manager (mDNS UDP 5353)"

# Remove versoes antigas da regra antes de recriar: trocar de porta deixaria
# a anterior aberta sem necessidade.
Get-NetFirewallRule -DisplayName "EVA S - RPG Manager*" -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue

New-NetFirewallRule -DisplayName $httpRule -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Port -Profile Any | Out-Null

# UDP 5353 e o canal do mDNS: sem ele o nome .local nao e respondido nem nas
# redes que permitem descoberta local.
New-NetFirewallRule -DisplayName $mdnsRule -Direction Inbound -Action Allow `
    -Protocol UDP -LocalPort 5353 -Profile Any | Out-Null

Write-Host ""
Write-Host "  OK - porta $Port liberada no firewall (todos os perfis de rede)." -ForegroundColor Green
Write-Host "  Os jogadores ja podem abrir o link na mesma rede." -ForegroundColor Green
Write-Host ""
Write-Host "  Para desfazer:" -ForegroundColor DarkGray
Write-Host "    Get-NetFirewallRule -DisplayName 'EVA S - RPG Manager*' | Remove-NetFirewallRule" -ForegroundColor DarkGray
Write-Host ""

if ($MyInvocation.MyCommand.Path -and -not $env:CI) {
    Write-Host "  Pressione Enter para fechar..." -NoNewline
    Read-Host | Out-Null
}
