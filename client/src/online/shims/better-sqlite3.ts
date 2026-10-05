// Shim do better-sqlite3 para rodar o servidor do EVA S dentro do navegador
// (modo online). Implementa so a parte da API que os services usam — prepare
// (run/get/all), exec, pragma e transaction — em cima do sql.js (SQLite em
// WebAssembly). O banco precisa ter sido aberto antes de qualquer
// `new Database()`: ver `setSqlJsDatabase` e online/host/hostRuntime.ts.
import type { Database as SqlJsDatabase, SqlValue } from 'sql.js';

let backing: SqlJsDatabase | null = null;
let onWrite: (() => void) | null = null;

export function setSqlJsDatabase(db: SqlJsDatabase, writeHook?: () => void): void {
  backing = db;
  onWrite = writeHook ?? null;
}

export function getSqlJsDatabase(): SqlJsDatabase {
  if (!backing) throw new Error('Banco do navegador ainda nao foi aberto');
  return backing;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

type Params = unknown[];

function normalize(v: unknown): SqlValue {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Uint8Array) return v;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return String(v);
}

// better-sqlite3 aceita tanto `run(a, b, c)` quanto `run({ nome: x })` com
// @nome/:nome/$nome no SQL. O sql.js quer o prefixo na chave do objeto.
function bindable(sql: string, params: Params): SqlValue[] | Record<string, SqlValue> {
  if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0]) && !(params[0] instanceof Uint8Array)) {
    const obj = params[0] as Record<string, unknown>;
    const out: Record<string, SqlValue> = {};
    for (const [k, v] of Object.entries(obj)) {
      for (const prefix of ['@', ':', '$']) {
        if (sql.includes(prefix + k)) out[prefix + k] = normalize(v);
      }
    }
    return out;
  }
  const flat = params.length === 1 && Array.isArray(params[0]) ? (params[0] as unknown[]) : params;
  return flat.map(normalize);
}

const WRITE_RE = /^\s*(insert|update|delete|replace|create|drop|alter)\b/i;

export class Statement {
  constructor(private db: SqlJsDatabase, private sql: string) {}

  run(...params: Params): RunResult {
    const stmt = this.db.prepare(this.sql);
    try {
      stmt.bind(bindable(this.sql, params) as any);
      while (stmt.step()) { /* consome */ }
    } finally {
      stmt.free();
    }
    const changes = this.db.getRowsModified();
    const idRow = this.db.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = Number(idRow[0]?.values[0]?.[0] ?? 0);
    if (WRITE_RE.test(this.sql)) onWrite?.();
    return { changes, lastInsertRowid };
  }

  get(...params: Params): any {
    const stmt = this.db.prepare(this.sql);
    try {
      stmt.bind(bindable(this.sql, params) as any);
      return stmt.step() ? stmt.getAsObject() : undefined;
    } finally {
      stmt.free();
    }
  }

  all(...params: Params): any[] {
    const stmt = this.db.prepare(this.sql);
    const rows: any[] = [];
    try {
      stmt.bind(bindable(this.sql, params) as any);
      while (stmt.step()) rows.push(stmt.getAsObject());
    } finally {
      stmt.free();
    }
    return rows;
  }
}

let savepointSeq = 0;

export default class Database {
  constructor(_path?: string, _opts?: unknown) {}

  private get db(): SqlJsDatabase {
    return getSqlJsDatabase();
  }

  prepare(sql: string): Statement {
    return new Statement(this.db, sql);
  }

  exec(sql: string): this {
    this.db.exec(sql);
    if (WRITE_RE.test(sql) || /\b(insert|update|delete|create|drop|alter)\b/i.test(sql)) onWrite?.();
    return this;
  }

  pragma(source: string): unknown {
    // WAL nao existe num banco em memoria; o resto (foreign_keys etc.) passa.
    if (/journal_mode/i.test(source)) return 'memory';
    return this.db.exec(`PRAGMA ${source}`);
  }

  // Savepoints em vez de BEGIN: igual ao better-sqlite3, permite transaction()
  // dentro de transaction() (importCampaign chamado dentro de createNewCampaign).
  transaction<F extends (...args: any[]) => any>(fn: F): F {
    const db = () => this.db;
    return ((...args: any[]) => {
      const name = `sp_${++savepointSeq}`;
      db().exec(`SAVEPOINT ${name}`);
      try {
        const result = fn(...args);
        db().exec(`RELEASE ${name}`);
        return result;
      } catch (err) {
        db().exec(`ROLLBACK TO ${name}`);
        db().exec(`RELEASE ${name}`);
        throw err;
      }
    }) as F;
  }
}

export type { Database as DatabaseType };
export { Database };
