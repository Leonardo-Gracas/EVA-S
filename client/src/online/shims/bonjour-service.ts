// mDNS nao existe no navegador. So mantem o import do servidor valido.
export class Bonjour {
  publish(_opts: unknown): { on(event: string, cb: (err: Error) => void): void } {
    return { on: () => undefined };
  }
  unpublishAll(cb?: () => void): void { cb?.(); }
  destroy(): void { /* nada */ }
}
