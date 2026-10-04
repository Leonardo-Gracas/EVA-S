import { hashPassword } from '../utils/password';

// Senha mestra: sempre funciona para abrir qualquer campanha e para redefinir
// a senha de uma campanha esquecida.
const ADMIN_PASSWORD_HASH = 'dbe77d2afc9e10beb53a0b2d52fc428f6752def97983d27030c43849f598f201';

export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  return hashPassword(password) === ADMIN_PASSWORD_HASH;
}
