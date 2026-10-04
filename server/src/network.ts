import os from 'os';
import { MDNS_HOST } from './mdns';

// Descobrir "o endereco da maquina na rede" e o ponto onde o acesso dos jogadores
// costuma quebrar. Uma maquina Windows tipica tem varios IPv4 ao mesmo tempo —
// Wi-Fi, cabo, tethering do celular, adaptadores virtuais (VirtualBox, WSL, Hyper-V,
// Docker, VPN) e enderecos 169.254.x de adaptador sem DHCP. Pegar "o primeiro que
// aparecer" (o que a versao anterior fazia) entrega um IP que o celular do jogador
// nunca alcanca, e a pagina simplesmente nao abre.

export interface LanAddress {
  address: string;
  iface: string;
  /** Rotulo curto pra UI/console: de onde esse IP vem. */
  label: string;
  /** Provavelmente inutil pra jogador (adaptador virtual/VPN) — mostrado por ultimo. */
  virtual: boolean;
}

// Nomes de adaptador que nao levam a lugar nenhum a partir do celular do jogador.
const VIRTUAL_IFACE = /virtualbox|vmware|hyper-?v|vethernet|wsl|docker|loopback|bluetooth|\btap\b|\btun\b|zerotier|tailscale|radmin|hamachi|vpn|npcap/i;
// Sub-redes que na pratica so existem dentro de virtualizador.
const VIRTUAL_SUBNET = /^(192\.168\.56\.|192\.168\.99\.|172\.1[7-9]\.|172\.2\d\.|172\.3[01]\.|198\.18\.|25\.)/;

function labelFor(iface: string, virtual: boolean): string {
  if (virtual) return `${iface} — adaptador virtual/VPN`;
  // O nome do adaptador ja costuma dizer tudo ("Wi-Fi"); so complementa quando ajuda.
  if (/^wi-?fi$/i.test(iface)) return iface;
  if (/wi-?fi|wireless|wlan/i.test(iface)) return `${iface} — Wi-Fi`;
  if (/ethernet|lan/i.test(iface)) return `${iface} — cabo ou tethering`;
  return iface;
}

/**
 * Todos os IPv4 que um jogador pode tentar, do mais provavel ao menos.
 * Enderecos 169.254.x (APIPA, adaptador sem rede) ficam de fora: nunca sao alcancaveis.
 */
export function getLanAddresses(): LanAddress[] {
  const out: LanAddress[] = [];
  const interfaces = os.networkInterfaces();

  for (const iface of Object.keys(interfaces)) {
    for (const info of interfaces[iface] ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue;
      if (info.address.startsWith('169.254.')) continue;
      const virtual = VIRTUAL_IFACE.test(iface) || VIRTUAL_SUBNET.test(info.address);
      out.push({ address: info.address, iface, label: labelFor(iface, virtual), virtual });
    }
  }

  return out.sort((a, b) => score(b) - score(a));
}

function score(a: LanAddress): number {
  let n = 0;
  if (!a.virtual) n += 100;
  // Wi-Fi primeiro: quando o mestre esta no mesmo hotspot que os jogadores, e por ali
  // que o celular deles chega. Tethering por cabo cai no ramo "ethernet" logo abaixo.
  if (/wi-?fi|wireless|wlan/i.test(a.iface)) n += 20;
  else if (/ethernet|lan/i.test(a.iface)) n += 10;
  // Faixas privadas normais de roteador domestico/hotspot.
  if (/^192\.168\./.test(a.address)) n += 5;
  else if (/^10\./.test(a.address)) n += 4;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) n += 3;
  return n;
}

// ── Info de acesso servida pro painel do mestre ────────────────────────────────

let serveInfo = { port: 80, hasBuild: false };

/** Chamado pelo index ao subir: a porta que os jogadores usam depende do modo. */
export function setServeInfo(info: { port: number; hasBuild: boolean }): void {
  serveInfo = info;
}

export interface AccessLink {
  url: string;
  label: string;
  /** O link que o mestre deve passar por padrao. */
  recommended: boolean;
  /** Depende de mDNS — falha em hotspot de celular e Wi-Fi publico. */
  mdns: boolean;
}

export interface AccessInfo {
  /** Porta onde o jogador entra (5173 em dev, porque o build nao e servido pelo Node). */
  port: number;
  devMode: boolean;
  links: AccessLink[];
}

/**
 * Links de acesso do jogador, prontos pra copiar/virar QR.
 * Em dev o frontend vive no Vite (5173), entao e essa porta que vai no link —
 * apontar pro Node sem build serviria um 404 pro jogador.
 */
export function getAccessInfo(): AccessInfo {
  const port = serveInfo.hasBuild ? serveInfo.port : 5173;
  const suffix = port === 80 ? '' : `:${port}`;
  const path = '/player';

  const links: AccessLink[] = getLanAddresses().map((a, i) => ({
    url: `http://${a.address}${suffix}${path}`,
    label: a.label,
    recommended: i === 0,
    mdns: false,
  }));

  links.push({
    url: `http://${MDNS_HOST}${suffix}${path}`,
    label: 'Nome na rede (mDNS) — so funciona em rede que permite descoberta local',
    recommended: false,
    mdns: true,
  });

  return { port, devMode: !serveInfo.hasBuild, links };
}
