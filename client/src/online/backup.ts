// Backup do banco inteiro do mestre (.db = SQLite, mesmo formato do servidor local).
import { readStoredDatabase, inspectDatabaseFile, importDatabaseFile } from './host/hostRuntime';
import { imageFileToDataUrl } from './image';

export async function downloadBackup(): Promise<boolean> {
  const bytes = await readStoredDatabase();
  if (!bytes) return false;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const blob = new Blob([bytes as BlobPart], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eva-s-backup-${stamp}.db`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

/** Abre o seletor de arquivos. Precisa ser chamado direto no clique do usuario. */
export function pickFiles(opts: { accept?: string; directory?: boolean; multiple?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (opts.accept) input.accept = opts.accept;
    if (opts.multiple) input.multiple = true;
    if (opts.directory) input.setAttribute('webkitdirectory', '');
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

export interface PendingImport {
  name: string;
  bytes: Uint8Array;
  /** Imagens da pasta server/data/uploads referenciadas pelo banco (EVA S local). */
  uploads: string[];
}

export async function readBackupFile(file: File): Promise<PendingImport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { uploads } = await inspectDatabaseFile(bytes);
  return { name: file.name, bytes, uploads };
}

/** Conclui a importacao, embutindo (reduzidas) as imagens encontradas entre `files`. */
export async function finishImport(
  pending: PendingImport,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ embedded: number; missing: number }> {
  const wanted = new Set(pending.uploads);
  const found = files.filter((f) => wanted.has(f.name));
  const images = new Map<string, string>();
  let i = 0;
  for (const f of found) {
    try { images.set(f.name, await imageFileToDataUrl(f)); } catch { /* imagem quebrada: fica sem */ }
    onProgress?.(++i, found.length);
  }
  await importDatabaseFile(pending.bytes, images);
  return { embedded: images.size, missing: pending.uploads.length - images.size };
}
