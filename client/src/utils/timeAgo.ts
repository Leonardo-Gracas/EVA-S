export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'agora';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}min atrás`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h atrás`;
  return `${Math.floor(ms / 86_400_000)}d atrás`;
}
