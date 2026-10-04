import { MapNode } from '../../types';

export const NODE_R_DEFAULT = 36;
export const NODE_R_MIN = 20;
export const NODE_R_MAX = 80;

export type Selection = { type: 'node' | 'path'; id: string };

export function nodeEditorRadius(n: MapNode) { return n.radius ?? NODE_R_DEFAULT; }

export function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const w = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine - 1) + '…' : word;
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxCharsPerLine) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
