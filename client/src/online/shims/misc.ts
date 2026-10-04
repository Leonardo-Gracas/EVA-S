// Shims dos modulos do Node que o codigo do servidor importa mas que, no
// navegador, nao tem papel nenhum (disco, rede local). Mantem o import valido.
export const fs = {
  existsSync: (_p: string) => true,
  mkdirSync: (_p: string, _o?: unknown) => undefined,
};

export const path = {
  join: (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
  resolve: (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
  extname: (p: string) => { const m = /\.[^./]*$/.exec(p); return m ? m[0] : ''; },
  basename: (p: string) => p.split('/').pop() ?? '',
};

export const os = {
  networkInterfaces: () => ({} as Record<string, Array<{ family: string | number; internal: boolean; address: string }> | undefined>),
  hostname: () => 'navegador',
};
