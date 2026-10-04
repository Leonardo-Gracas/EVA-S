import db from '../database/db';

// Persistido em saved_campaigns (na linha is_current=1) em vez de memoria: um flag em memoria
// zera a cada restart do processo (crash, redeploy, respawn do ts-node-dev), o que trancava os
// jogadores fora ate o mestre logar de novo — mesmo com a campanha ja selecionada no banco e o
// mestre com a sessao aberta no proprio navegador (localStorage nao tem como saber que o
// servidor reiniciou).
export function openGmSession(): void {
  db.prepare('UPDATE saved_campaigns SET gm_session_open = 1 WHERE is_current = 1').run();
}

export function isGmSessionOpen(): boolean {
  const row = db.prepare('SELECT gm_session_open FROM saved_campaigns WHERE is_current = 1 LIMIT 1').get() as any;
  return row?.gm_session_open === 1;
}
