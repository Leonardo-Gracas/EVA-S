// Intercepta o fetch para /api/*. As telas continuam chamando a "API" como no
// modo LAN; aqui o pedido e entregue ao servidor que roda no navegador (mestre)
// ou enviado ao mestre pela conexao P2P (jogador).
import { imageFileToDataUrl } from './image';

export interface ApiResult { status: number; body: unknown }
export type ApiHandler = (method: string, path: string, body: unknown, headers: Record<string, string>) => Promise<ApiResult>;

let handler: ApiHandler | null = null;
let installed = false;

export function setApiHandler(h: ApiHandler | null): void {
  handler = h;
}

function jsonResponse(status: number, body: unknown): Response {
  const isText = typeof body === 'string';
  return new Response(isText ? (body as string) : JSON.stringify(body ?? null), {
    status,
    headers: { 'Content-Type': isText ? 'text/html; charset=utf-8' : 'application/json' },
  });
}

function headersToObject(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  new Headers(h).forEach((v, k) => { out[k] = v; });
  return out;
}

export function installFetchShim(): void {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return original(input as RequestInfo, init);
    }

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const path = url.pathname.slice(4) + url.search;

    // Upload de avatar: resolvido no proprio aparelho, sem passar pelo mestre.
    if (path.startsWith('/upload') && init?.body instanceof FormData) {
      const file = init.body.get('image');
      if (!(file instanceof File)) return jsonResponse(400, { error: 'Nenhum arquivo enviado' });
      try {
        return jsonResponse(200, { url: await imageFileToDataUrl(file) });
      } catch (err: any) {
        return jsonResponse(400, { error: err?.message ?? 'Imagem invalida' });
      }
    }

    let body: unknown = undefined;
    if (typeof init?.body === 'string' && init.body.length > 0) {
      try { body = JSON.parse(init.body); } catch { body = init.body; }
    }

    if (!handler) return jsonResponse(503, { error: 'Sem conexao com a sala.' });
    try {
      const result = await handler(method, path, body, headersToObject(init?.headers));
      return jsonResponse(result.status, result.body);
    } catch (err: any) {
      return jsonResponse(503, { error: err?.message ?? 'Sem conexao com o mestre.' });
    }
  };
}
