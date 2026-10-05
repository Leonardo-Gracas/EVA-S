import { legacySha256 } from '../utils/password';

// Senha mestra: sempre funciona para abrir qualquer campanha e para redefinir
// a senha de uma campanha esquecida.
// ADMIN_PASSWORD_HASH (SHA-256 da senha) no ambiente substitui o padrao — o
// padrao esta no repositorio publico, entao use uma senha que nao repete em lugar nenhum.
const ADMIN_PASSWORD_HASH = (typeof process !== 'undefined' && process.env?.ADMIN_PASSWORD_HASH)
  || 'dbe77d2afc9e10beb53a0b2d52fc428f6752def97983d27030c43849f598f201';

export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  return legacySha256(password) === ADMIN_PASSWORD_HASH;
}
