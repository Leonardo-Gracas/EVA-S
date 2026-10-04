// Shim minimo do Express: so o suficiente para o routes/api.ts do servidor
// rodar dentro do navegador do mestre. Em vez de escutar HTTP, o router expoe
// `handle()`, chamado pelo interceptador de fetch (pedidos do proprio mestre)
// e pela conexao P2P (pedidos dos jogadores).

export interface Request {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
  headers: Record<string, string>;
  header(name: string): string | undefined;
}

export interface Response {
  status(code: number): Response;
  json(data: unknown): Response;
  send(data: unknown): Response;
  setHeader(name: string, value: string): Response;
}

export type NextFunction = (err?: unknown) => void;
type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

export interface HandledResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handlers: Handler[];
}

function compile(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const pattern = path
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${pattern}/?$`), keys };
}

export class ExpressRouter {
  private routes: Route[] = [];

  private add(method: string, path: string, handlers: Handler[]) {
    const { regex, keys } = compile(path);
    this.routes.push({ method, regex, keys, handlers });
    return this;
  }

  get(path: string, ...handlers: Handler[]) { return this.add('GET', path, handlers); }
  post(path: string, ...handlers: Handler[]) { return this.add('POST', path, handlers); }
  put(path: string, ...handlers: Handler[]) { return this.add('PUT', path, handlers); }
  delete(path: string, ...handlers: Handler[]) { return this.add('DELETE', path, handlers); }
  patch(path: string, ...handlers: Handler[]) { return this.add('PATCH', path, handlers); }
  use(..._args: unknown[]) { return this; }

  /** Executa a rota como o Express faria e devolve status/corpo. */
  handle(method: string, url: string, body: unknown, headers: Record<string, string> = {}): Promise<HandledResponse> {
    const [rawPath, rawQuery = ''] = url.split('?');
    const path = decodeURI(rawPath);
    const query: Record<string, string> = {};
    new URLSearchParams(rawQuery).forEach((v, k) => { query[k] = v; });
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;

    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      const m = route.regex.exec(path);
      if (!m) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return run(route.handlers, {
        method: method.toUpperCase(), path, params, query, body: body ?? {}, headers: lower,
        header: (name: string) => lower[name.toLowerCase()],
      });
    }
    return Promise.resolve({ status: 404, body: { error: `Rota nao encontrada: ${method} ${path}` }, headers: {} });
  }
}

function run(handlers: Handler[], req: Request): Promise<HandledResponse> {
  return new Promise((resolve) => {
    let statusCode = 200;
    const outHeaders: Record<string, string> = {};
    let done = false;
    const finish = (body: unknown) => {
      if (done) return;
      done = true;
      resolve({ status: statusCode, body, headers: outHeaders });
    };
    const res: Response = {
      status(code) { statusCode = code; return res; },
      json(data) { finish(data === undefined ? null : JSON.parse(JSON.stringify(data))); return res; },
      send(data) { finish(data); return res; },
      setHeader(name, value) { outHeaders[name] = value; return res; },
    };
    const fail = (err: any) => {
      statusCode = 500;
      finish({ error: err?.message ?? 'Erro interno' });
    };
    const step = (i: number) => {
      const h = handlers[i];
      if (!h) { statusCode = 404; finish({ error: 'Sem resposta' }); return; }
      try {
        const out = h(req, res, (err) => (err ? fail(err) : step(i + 1)));
        if (out && typeof (out as Promise<unknown>).then === 'function') (out as Promise<unknown>).catch(fail);
      } catch (err) {
        fail(err);
      }
    };
    step(0);
  });
}

// Como no Express, Router e chamado sem `new`.
export function Router(): ExpressRouter {
  return new ExpressRouter();
}
export type Router = ExpressRouter;

function express() {
  throw new Error('express() nao existe no modo online — use Router()');
}
express.Router = Router;
export default express;
