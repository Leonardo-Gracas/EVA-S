// So o tipo e usado (socketManager recebe o servidor HTTP). No navegador nao ha servidor.
export interface Server { readonly __fake?: true }
export function createServer(): Server { return {}; }
