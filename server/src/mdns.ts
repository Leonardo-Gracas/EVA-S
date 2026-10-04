import { Bonjour } from 'bonjour-service';

const rawName = process.env.MDNS_HOST || 'eva';
export const MDNS_HOST = rawName.endsWith('.local') ? rawName : `${rawName}.local`;

export function startMdns(port: number): void {
  let bonjour: Bonjour;
  try {
    bonjour = new Bonjour();
  } catch (err) {
    console.log(`\n  ⚠  mDNS indisponivel — use o IP da rede. (${(err as Error).message})`);
    return;
  }

  const service = bonjour.publish({
    name: 'EVA S',
    type: 'http',
    port,
    host: MDNS_HOST,
    // IPv6 link-local (fe80::) exige zone index, que navegador nao aceita em URL —
    // anunciar so o A record garante que eva.local caia no IPv4 da LAN
    disableIPv6: true,
    // Sem isto, achar o nome ja em uso na rede (outra instancia aberta, ou um
    // registro antigo ainda vivo em algum cache) faz a bonjour LANCAR de dentro de
    // um callback de socket — excecao nao capturavel pelo listener de 'error'
    // abaixo, que derruba o processo inteiro. Ou seja: um detalhe de descoberta de
    // nome tirava o app do ar pra todo mundo. O anuncio e acessorio (o link que
    // vale e o IP), entao vale mais anunciar sem checar do que arriscar o servidor.
    probe: false,
  });

  service.on('error', (err: Error) => {
    console.log(`\n  ⚠  mDNS falhou — ${MDNS_HOST} nao sera resolvido. (${err.message})`);
  });

  // Sem o goodbye packet, o nome fica em cache dos clientes apontando para um IP morto
  const shutdown = () => {
    bonjour.unpublishAll(() => {
      bonjour.destroy();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
