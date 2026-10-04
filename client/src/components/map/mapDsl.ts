import { MapNode, MapPath, PathCharacteristic } from '../../types';
import { NODE_R_MIN, NODE_R_MAX, uuidv4 } from './mapEditorUtils';

// ─── Notação MAPDSL ───────────────────────────────────────────────────────────
//
//   MAP    <nome do mapa>
//   GRID   <px por unidade de grade>          (opcional, padrão 200)
//   LAYOUT <radial|layers|ring|grid>          (opcional, padrão radial)
//
//   N | id | Nome | cap | col,row | raio | descrição
//   P | origem | destino | distância | características | rótulo
//
// Tudo depois do 2º campo é opcional. `col,row` são coordenadas de grade
// (inteiros/decimais, podem ser negativos); omitidas, o nó é posicionado
// automaticamente pelo algoritmo de layout simétrico.

export const MAP_DSL_GRID_DEFAULT = 200;

export type LayoutMode = 'radial' | 'layers' | 'ring' | 'grid';

export interface DslIssue {
  line: number;      // 1-indexed; 0 = problema geral, sem linha
  message: string;
}

export interface ParsedMap {
  name: string;
  grid: number;
  layout: LayoutMode;
  nodes: MapNode[];
  paths: MapPath[];
  errors: DslIssue[];    // impedem a importação
  warnings: DslIssue[];  // não impedem: a linha problemática é ignorada
}

// ─── Helpers de normalização ──────────────────────────────────────────────────

/** Minúsculas, sem acentos, sem pontuação — usado para casar ids/nomes/palavras-chave. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function slug(s: string): string {
  return fold(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'no';
}

/** Raio derivado da ocupação quando o código não informa um. */
export function radiusForCapacity(cap: number): number {
  const r = Math.round(24 + Math.max(0, cap) * 3.5);
  return Math.min(NODE_R_MAX, Math.max(NODE_R_MIN, r));
}

const CHAR_ALIASES: Record<string, PathCharacteristic> = {};
{
  const table: Record<PathCharacteristic, string[]> = {
    difficult: ['difficult', 'dificil', 'terrenodificil', 'terreno', 'df'],
    no_vision: ['novision', 'semvisao', 'escuro', 'cego', 'nv'],
    jump:      ['jump', 'salto', 'pulo', 'sl'],
    unstable:  ['unstable', 'instavel', 'in'],
    dangerous: ['dangerous', 'perigoso', 'perigo', 'pr'],
    blocked:   ['blocked', 'bloqueado', 'fechado', 'bl'],
  };
  for (const [key, aliases] of Object.entries(table)) {
    for (const a of aliases) CHAR_ALIASES[a] = key as PathCharacteristic;
  }
}

function parseCharacteristics(raw: string): { chars: PathCharacteristic[]; unknown: string[] } {
  const chars: PathCharacteristic[] = [];
  const unknown: string[] = [];
  for (const token of raw.split(/[,;/]+/)) {
    const t = fold(token).replace(/[^a-z0-9]/g, '');
    if (!t) continue;
    const key = CHAR_ALIASES[t];
    if (!key) unknown.push(token.trim());
    else if (!chars.includes(key)) chars.push(key);
  }
  return { chars, unknown };
}

/**
 * "col,row" → coordenada de grade. O separador decimal é sempre "." — aceitar
 * vírgula decimal tornaria "9,9,9" ambíguo com o separador de campos.
 */
function parseCoords(raw: string): { col: number; row: number } | null {
  const m = raw.replace(/[@()\[\]]/g, '').trim().match(/^(-?\d+(?:\.\d+)?)\s*[;,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const col = parseFloat(m[1]);
  const row = parseFloat(m[2]);
  if (!isFinite(col) || !isFinite(row)) return null;
  return { col, row };
}

// ─── Parser ───────────────────────────────────────────────────────────────────

interface RawNode {
  id: string; name: string; cap: number;
  at: { col: number; row: number } | null;
  radius: number | null;
  description: string;
  line: number;
}

interface RawPath {
  sourceRef: string; targetRef: string;
  distance: number; chars: PathCharacteristic[]; label: string;
  line: number;
}

const NODE_KEYWORDS = ['n', 'no', 'node', 'sala', 'local'];
const PATH_KEYWORDS = ['p', 'path', 'caminho', 'conexao', 'c'];

export function parseMapDsl(source: string): ParsedMap {
  const errors: DslIssue[] = [];
  const warnings: DslIssue[] = [];

  let name = '';
  let grid = MAP_DSL_GRID_DEFAULT;
  let layout: LayoutMode = 'radial';

  const rawNodes: RawNode[] = [];
  const rawPaths: RawPath[] = [];

  const lines = source.replace(/^\ufeff/, '').split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith('#') || line.startsWith('//') || line.startsWith('```')) return;

    // Diretivas de cabeçalho
    const directive = line.match(/^([A-Za-zÀ-ÿ]+)\s*(?:[:=]\s*|\s+)(.*)$/);
    if (directive && !line.includes('|')) {
      const key = fold(directive[1]);
      const value = directive[2].trim();
      if (key === 'map' || key === 'mapa') { name = value; return; }
      if (key === 'grid' || key === 'grade') {
        const n = parseFloat(value.replace(',', '.'));
        if (isFinite(n) && n > 0) grid = Math.min(2000, Math.max(60, n));
        else warnings.push({ line: lineNo, message: `GRID inválido: "${value}". Usando ${grid}.` });
        return;
      }
      if (key === 'layout') {
        const v = fold(value);
        const table: Record<string, LayoutMode> = {
          radial: 'radial', radia: 'radial', arvore: 'radial', tree: 'radial',
          layers: 'layers', camadas: 'layers', niveis: 'layers', layer: 'layers',
          ring: 'ring', anel: 'ring', circle: 'ring', circulo: 'ring',
          grid: 'grid', grade: 'grid', malha: 'grid',
        };
        if (table[v]) layout = table[v];
        else warnings.push({ line: lineNo, message: `LAYOUT desconhecido: "${value}". Usando "${layout}".` });
        return;
      }
    }

    // Registros
    if (!line.includes('|')) {
      warnings.push({ line: lineNo, message: `Linha ignorada (não é diretiva nem registro): "${line.slice(0, 60)}"` });
      return;
    }

    const cells = line.split('|').map(c => c.trim());
    const kind = fold(cells[0]).replace(/[^a-z]/g, '');
    const parts = cells.slice(1);

    if (NODE_KEYWORDS.includes(kind)) {
      const node = parseNodeLine(parts, lineNo, warnings);
      if (node) rawNodes.push(node);
      return;
    }
    if (PATH_KEYWORDS.includes(kind)) {
      const path = parsePathLine(parts, lineNo, warnings);
      if (path) rawPaths.push(path);
      return;
    }
    warnings.push({ line: lineNo, message: `Tipo de registro desconhecido: "${cells[0]}" (esperado N ou P).` });
  });

  if (rawNodes.length === 0) {
    errors.push({ line: 0, message: 'Nenhum nó encontrado. Cada nó é uma linha começando com "N |".' });
  }

  // ── ids únicos ──────────────────────────────────────────────────────────────
  const byId = new Map<string, RawNode>();
  for (const n of rawNodes) {
    if (byId.has(n.id)) {
      let k = 2;
      while (byId.has(`${n.id}_${k}`)) k++;
      warnings.push({ line: n.line, message: `Id duplicado "${n.id}" — renomeado para "${n.id}_${k}".` });
      n.id = `${n.id}_${k}`;
    }
    byId.set(n.id, n);
  }
  const byName = new Map<string, RawNode>();
  for (const n of rawNodes) {
    const key = slug(n.name);
    if (!byName.has(key)) byName.set(key, n);
  }

  function resolve(ref: string): RawNode | null {
    const s = slug(ref);
    return byId.get(s) ?? byId.get(ref.trim()) ?? byName.get(s) ?? null;
  }

  // ── Nós finais (posições preenchidas depois) ────────────────────────────────
  const nodes: MapNode[] = rawNodes.map(n => ({
    id: n.id,
    name: n.name,
    occupancyLimit: n.cap,
    description: n.description || undefined,
    x: 0, y: 0,
    radius: n.radius ?? radiusForCapacity(n.cap),
  }));

  // ── Caminhos finais ─────────────────────────────────────────────────────────
  const paths: MapPath[] = [];
  const seenPairs = new Set<string>();
  for (const p of rawPaths) {
    const a = resolve(p.sourceRef);
    const b = resolve(p.targetRef);
    if (!a || !b) {
      const missing = !a ? p.sourceRef : p.targetRef;
      warnings.push({ line: p.line, message: `Caminho ignorado: nó "${missing}" não existe.` });
      continue;
    }
    if (a.id === b.id) {
      warnings.push({ line: p.line, message: `Caminho ignorado: "${a.name}" ligado a si mesmo.` });
      continue;
    }
    const pairKey = [a.id, b.id].sort().join('::');
    if (seenPairs.has(pairKey)) {
      warnings.push({ line: p.line, message: `Caminho duplicado entre "${a.name}" e "${b.name}" — ignorado.` });
      continue;
    }
    seenPairs.add(pairKey);
    paths.push({
      id: uuidv4(),
      sourceId: a.id,
      targetId: b.id,
      distance: p.distance,
      characteristics: p.chars,
      label: p.label || undefined,
    });
  }

  // ── Posicionamento ──────────────────────────────────────────────────────────
  const explicit = new Map<string, { col: number; row: number }>();
  for (const n of rawNodes) if (n.at) explicit.set(n.id, n.at);
  layoutMap(nodes, paths, explicit, grid, layout);

  return { name: name || 'Mapa Importado', grid, layout, nodes, paths, errors, warnings };
}

function parseNodeLine(parts: string[], line: number, warnings: DslIssue[]): RawNode | null {
  const nonEmpty = parts.filter(p => p !== '');
  if (nonEmpty.length === 0) {
    warnings.push({ line, message: 'Nó sem nome — linha ignorada.' });
    return null;
  }

  let id: string;
  let name: string;
  let rest: string[];

  // Um campo que já parece capacidade ou coordenada significa que a IA omitiu
  // o id: "N | Praça Central | 10 | 0,0" em vez de "N | praca | Praça | 10 | 0,0".
  const looksLikeAttribute = (v: string) => !!v && (/^\d+$/.test(v.trim()) || parseCoords(v) !== null);

  if (parts.length === 1 || parts.slice(1).every(p => p === '')) {
    // "N | Nome" → id derivado do nome
    name = parts[0];
    id = slug(name);
    rest = [];
  } else if (looksLikeAttribute(parts[1])) {
    name = parts[0];
    id = slug(name);
    rest = parts.slice(1);
  } else {
    id = slug(parts[0]);
    name = parts[1] || parts[0];
    rest = parts.slice(2);
  }

  const capRaw = (rest[0] ?? '').trim();
  let cap = 4;
  if (capRaw) {
    const n = parseInt(capRaw.replace(/[^0-9-]/g, ''), 10);
    if (isFinite(n) && n > 0) cap = Math.min(999, n);
    else warnings.push({ line, message: `Capacidade inválida em "${name}": "${capRaw}". Usando 4.` });
  }

  const atRaw = (rest[1] ?? '').trim();
  let at: { col: number; row: number } | null = null;
  if (atRaw) {
    at = parseCoords(atRaw);
    if (!at) warnings.push({ line, message: `Coordenada inválida em "${name}": "${atRaw}". Posição automática.` });
  }

  const rRaw = (rest[2] ?? '').trim();
  let radius: number | null = null;
  if (rRaw) {
    const n = parseInt(rRaw.replace(/[^0-9-]/g, ''), 10);
    if (isFinite(n) && n > 0) radius = Math.min(NODE_R_MAX, Math.max(NODE_R_MIN, n));
    else warnings.push({ line, message: `Raio inválido em "${name}": "${rRaw}". Derivado da capacidade.` });
  }

  const description = rest.slice(3).join('|').trim();

  return { id, name: name.trim(), cap, at, radius, description, line };
}

function parsePathLine(parts: string[], line: number, warnings: DslIssue[]): RawPath | null {
  let fields = parts;

  // Aceita "P | origem > destino | 3 | ..." além de "P | origem | destino | 3 | ..."
  const arrow = (fields[0] ?? '').match(/^(.+?)\s*(?:<->|->|>|→)\s*(.+)$/);
  if (arrow) fields = [arrow[1], arrow[2], ...fields.slice(1)];

  const sourceRef = (fields[0] ?? '').trim();
  const targetRef = (fields[1] ?? '').trim();
  if (!sourceRef || !targetRef) {
    warnings.push({ line, message: 'Caminho sem origem ou destino — linha ignorada.' });
    return null;
  }

  const distRaw = (fields[2] ?? '').trim();
  let distance = 1;
  if (distRaw) {
    const n = parseFloat(distRaw.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    if (isFinite(n) && n > 0) distance = Math.round(n * 100) / 100;
    else warnings.push({ line, message: `Distância inválida: "${distRaw}". Usando 1.` });
  }

  const { chars, unknown } = parseCharacteristics(fields[3] ?? '');
  for (const u of unknown) {
    warnings.push({ line, message: `Característica desconhecida: "${u}" — ignorada.` });
  }

  const label = fields.slice(4).join('|').trim();

  return { sourceRef, targetRef, distance, chars, label, line };
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface Graph {
  ids: string[];
  index: Map<string, number>;
  adj: number[][];
}

function buildGraph(nodes: MapNode[], paths: MapPath[]): Graph {
  const ids = nodes.map(n => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const adj: number[][] = ids.map(() => []);
  for (const p of paths) {
    const a = index.get(p.sourceId);
    const b = index.get(p.targetId);
    if (a === undefined || b === undefined) continue;
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }
  return { ids, index, adj };
}

/** Componentes conexos, cada um em ordem BFS a partir do nó de maior grau. */
function components(g: Graph): number[][] {
  const seen = new Array(g.ids.length).fill(false);
  const out: number[][] = [];
  // Ordem determinística: percorre na ordem de declaração, mas cada componente
  // começa pelo seu nó mais conectado (raiz visualmente natural).
  for (let start = 0; start < g.ids.length; start++) {
    if (seen[start]) continue;
    // descobre o componente inteiro
    const bag: number[] = [];
    const stack = [start];
    seen[start] = true;
    while (stack.length) {
      const v = stack.pop()!;
      bag.push(v);
      for (const w of g.adj[v]) if (!seen[w]) { seen[w] = true; stack.push(w); }
    }
    let root = bag[0];
    for (const v of bag) if (g.adj[v].length > g.adj[root].length) root = v;
    // reordena em BFS a partir da raiz
    const order: number[] = [];
    const inOrder = new Set<number>([root]);
    const queue = [root];
    while (queue.length) {
      const v = queue.shift()!;
      order.push(v);
      for (const w of g.adj[v].slice().sort((a, b) => a - b)) {
        if (!inOrder.has(w)) { inOrder.add(w); queue.push(w); }
      }
    }
    for (const v of bag) if (!inOrder.has(v)) order.push(v);
    out.push(order);
  }
  return out;
}

interface Placement { x: number; y: number }

/** Árvore radial: raiz no centro, cada camada num anel, filhos em setores proporcionais. */
function radialComponent(g: Graph, order: number[], ring: number): Map<number, Placement> {
  const pos = new Map<number, Placement>();
  const root = order[0];
  if (order.length === 1) { pos.set(root, { x: 0, y: 0 }); return pos; }

  const parent = new Map<number, number>();
  const children = new Map<number, number[]>();
  const depth = new Map<number, number>([[root, 0]]);
  const visited = new Set<number>([root]);
  const queue = [root];
  while (queue.length) {
    const v = queue.shift()!;
    const kids: number[] = [];
    for (const w of g.adj[v].slice().sort((a, b) => a - b)) {
      if (visited.has(w)) continue;
      visited.add(w);
      parent.set(w, v);
      depth.set(w, (depth.get(v) ?? 0) + 1);
      kids.push(w);
      queue.push(w);
    }
    children.set(v, kids);
  }
  for (const v of order) if (!visited.has(v)) { children.set(v, []); depth.set(v, 1); }

  // Folhas por subárvore (peso angular)
  const weight = new Map<number, number>();
  const post = order.slice().sort((a, b) => (depth.get(b) ?? 0) - (depth.get(a) ?? 0));
  for (const v of post) {
    const kids = children.get(v) ?? [];
    weight.set(v, kids.length === 0 ? 1 : kids.reduce((s, k) => s + (weight.get(k) ?? 1), 0));
  }

  // Percorre atribuindo setores
  pos.set(root, { x: 0, y: 0 });
  const stack: { node: number; from: number; to: number }[] = [{ node: root, from: -Math.PI / 2, to: Math.PI * 1.5 }];
  while (stack.length) {
    const { node, from, to } = stack.pop()!;
    const kids = children.get(node) ?? [];
    if (kids.length === 0) continue;
    const total = kids.reduce((s, k) => s + (weight.get(k) ?? 1), 0) || 1;
    let cursor = from;
    for (const k of kids) {
      const span = (to - from) * ((weight.get(k) ?? 1) / total);
      const angle = cursor + span / 2;
      const d = depth.get(k) ?? 1;
      const r = ring * d;
      pos.set(k, { x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      // filhos ficam dentro do setor do pai, levemente estreitado para não colidir
      stack.push({ node: k, from: angle - span / 2, to: angle + span / 2 });
      cursor += span;
    }
  }
  return pos;
}

/** Camadas horizontais centradas: profundidade = linha, irmãos distribuídos simetricamente. */
function layersComponent(g: Graph, order: number[], grid: number): Map<number, Placement> {
  const pos = new Map<number, Placement>();
  const root = order[0];
  const depth = new Map<number, number>([[root, 0]]);
  const visited = new Set<number>([root]);
  const queue = [root];
  while (queue.length) {
    const v = queue.shift()!;
    for (const w of g.adj[v].slice().sort((a, b) => a - b)) {
      if (visited.has(w)) continue;
      visited.add(w);
      depth.set(w, (depth.get(v) ?? 0) + 1);
      queue.push(w);
    }
  }
  let maxDepth = 0;
  for (const v of order) { if (!depth.has(v)) depth.set(v, 0); maxDepth = Math.max(maxDepth, depth.get(v)!); }

  for (let d = 0; d <= maxDepth; d++) {
    const row = order.filter(v => depth.get(v) === d);
    row.forEach((v, i) => {
      pos.set(v, { x: (i - (row.length - 1) / 2) * grid * 1.15, y: d * grid });
    });
  }
  return pos;
}

/** Todos os nós num único círculo. */
function ringComponent(order: number[], grid: number): Map<number, Placement> {
  const pos = new Map<number, Placement>();
  const n = order.length;
  if (n === 1) { pos.set(order[0], { x: 0, y: 0 }); return pos; }
  const radius = Math.max(grid, (n * grid * 0.95) / (2 * Math.PI));
  order.forEach((v, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    pos.set(v, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return pos;
}

/** Malha quadrada centrada. */
function gridComponent(order: number[], grid: number): Map<number, Placement> {
  const pos = new Map<number, Placement>();
  const cols = Math.max(1, Math.ceil(Math.sqrt(order.length)));
  const rows = Math.ceil(order.length / cols);
  order.forEach((v, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const rowCount = Math.min(cols, order.length - r * cols);
    pos.set(v, {
      x: (c - (rowCount - 1) / 2) * grid,
      y: (r - (rows - 1) / 2) * grid,
    });
  });
  return pos;
}

function bbox(points: Placement[]) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

/**
 * Posiciona todos os nós. Coordenadas explícitas (`col,row`) sempre mandam;
 * os demais nós são distribuídos pelo algoritmo escolhido — e, quando o mapa
 * mistura os dois casos, encaixados ao redor dos nós fixos sem sobreposição.
 */
export function layoutMap(
  nodes: MapNode[],
  paths: MapPath[],
  explicit: Map<string, { col: number; row: number }>,
  grid: number,
  mode: LayoutMode,
): void {
  if (nodes.length === 0) return;

  const g = buildGraph(nodes, paths);
  const autoIdx = nodes.map((n, i) => (explicit.has(n.id) ? -1 : i)).filter(i => i >= 0);

  // Coordenadas explícitas → px
  for (const n of nodes) {
    const at = explicit.get(n.id);
    if (at) { n.x = at.col * grid; n.y = at.row * grid; }
  }

  if (autoIdx.length === 0) { centerNodes(nodes); return; }

  if (autoIdx.length === nodes.length) {
    // Mapa inteiro automático: layout puro, componentes lado a lado.
    let offsetX = 0;
    for (const comp of components(g)) {
      const pos =
        mode === 'layers' ? layersComponent(g, comp, grid)
        : mode === 'ring' ? ringComponent(comp, grid)
        : mode === 'grid' ? gridComponent(comp, grid)
        : radialComponent(g, comp, grid);
      const box = bbox([...pos.values()]);
      for (const [i, p] of pos) {
        nodes[i].x = p.x + offsetX - box.minX;
        nodes[i].y = p.y;
      }
      offsetX += box.maxX - box.minX + grid * 1.4;
    }
    centerNodes(nodes);
    return;
  }

  // Misto: semeia cada nó automático perto dos vizinhos já fixos e relaxa.
  relaxAuto(nodes, g, autoIdx, grid);
}

function centerNodes(nodes: MapNode[]): void {
  const box = bbox(nodes.map(n => ({ x: n.x, y: n.y })));
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  for (const n of nodes) { n.x -= cx; n.y -= cy; }
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function relaxAuto(nodes: MapNode[], g: Graph, autoIdx: number[], grid: number): void {
  const fixed = new Set(nodes.map((_, i) => i).filter(i => !autoIdx.includes(i)));

  // Semeadura determinística
  autoIdx.forEach((i, k) => {
    const placedNeighbors = g.adj[i].filter(j => fixed.has(j));
    const angle = GOLDEN_ANGLE * k;
    if (placedNeighbors.length > 0) {
      const cx = placedNeighbors.reduce((s, j) => s + nodes[j].x, 0) / placedNeighbors.length;
      const cy = placedNeighbors.reduce((s, j) => s + nodes[j].y, 0) / placedNeighbors.length;
      nodes[i].x = cx + Math.cos(angle) * grid;
      nodes[i].y = cy + Math.sin(angle) * grid;
    } else {
      const box = bbox([...fixed].map(j => ({ x: nodes[j].x, y: nodes[j].y })));
      nodes[i].x = (box.minX + box.maxX) / 2 + Math.cos(angle) * grid * (1.5 + k * 0.12);
      nodes[i].y = (box.minY + box.maxY) / 2 + Math.sin(angle) * grid * (1.5 + k * 0.12);
    }
  });

  // Relaxamento: molas nas arestas + repulsão contra todos
  for (let iter = 0; iter < 240; iter++) {
    const fx = new Array(nodes.length).fill(0);
    const fy = new Array(nodes.length).fill(0);

    for (const i of autoIdx) {
      for (const j of g.adj[i]) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const d = Math.hypot(dx, dy) || 0.01;
        const pull = (d - grid) * 0.06;
        fx[i] += (dx / d) * pull;
        fy[i] += (dy / d) * pull;
      }
    }
    for (const i of autoIdx) {
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = ((nodes[i].radius ?? 36) + (nodes[j].radius ?? 36)) * 1.7;
        if (d < min) {
          const push = (min - d) * 0.5;
          fx[i] += (dx / d) * push;
          fy[i] += (dy / d) * push;
        }
      }
    }
    const damp = 1 - iter / 300;
    for (const i of autoIdx) {
      nodes[i].x += fx[i] * damp;
      nodes[i].y += fy[i] * damp;
    }
  }

  // Alinha na meia-grade para casar visualmente com os nós fixos
  const step = grid / 2;
  const taken = new Set<string>(
    [...fixed].map(j => `${Math.round(nodes[j].x / step)}:${Math.round(nodes[j].y / step)}`),
  );
  for (const i of autoIdx) {
    let c = Math.round(nodes[i].x / step);
    let r = Math.round(nodes[i].y / step);
    for (let attempt = 0; attempt < 64 && taken.has(`${c}:${r}`); attempt++) {
      const angle = GOLDEN_ANGLE * attempt;
      c = Math.round(nodes[i].x / step + Math.cos(angle) * (1 + attempt / 8));
      r = Math.round(nodes[i].y / step + Math.sin(angle) * (1 + attempt / 8));
    }
    taken.add(`${c}:${r}`);
    nodes[i].x = c * step;
    nodes[i].y = r * step;
  }
}

// ─── Serialização (mapa → código) ─────────────────────────────────────────────

const CHAR_TO_DSL: Record<PathCharacteristic, string> = {
  difficult: 'dificil',
  no_vision: 'sem_visao',
  jump: 'salto',
  unstable: 'instavel',
  dangerous: 'perigoso',
  blocked: 'bloqueado',
};

function cell(v: string | undefined): string {
  return (v ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

function round2(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Converte um mapa existente de volta para código MAPDSL (edição por IA / backup). */
export function serializeMapDsl(
  map: { name: string; nodes: MapNode[]; paths: MapPath[] },
  grid = MAP_DSL_GRID_DEFAULT,
): string {
  const idOf = new Map<string, string>();
  const used = new Set<string>();
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v);
  for (const n of map.nodes) {
    // Ids legíveis (vindos de uma importação anterior) sobrevivem ao round-trip;
    // uuids gerados pelo editor viram um slug do nome.
    let s = isUuid(n.id) ? slug(n.name) : slug(n.id);
    if (used.has(s)) { let k = 2; while (used.has(`${s}_${k}`)) k++; s = `${s}_${k}`; }
    used.add(s);
    idOf.set(n.id, s);
  }

  const out: string[] = [];
  out.push(`MAP ${cell(map.name)}`);
  out.push(`GRID ${grid}`);
  out.push('');
  out.push('# N | id | Nome | cap | col,row | raio | descrição');
  for (const n of map.nodes) {
    const fields = [
      idOf.get(n.id)!,
      cell(n.name),
      String(n.occupancyLimit),
      `${round2(n.x / grid)},${round2(n.y / grid)}`,
      n.radius ? String(Math.round(n.radius)) : '',
      cell(n.description),
    ];
    while (fields.length > 2 && fields[fields.length - 1] === '') fields.pop();
    out.push(`N | ${fields.join(' | ')}`);
  }
  if (map.paths.length > 0) {
    out.push('');
    out.push('# P | origem | destino | distância | características | rótulo');
    for (const p of map.paths) {
      const a = idOf.get(p.sourceId);
      const b = idOf.get(p.targetId);
      if (!a || !b) continue;
      const fields = [
        a, b,
        String(p.distance),
        p.characteristics.map(c => CHAR_TO_DSL[c]).join(','),
        cell(p.label),
      ];
      while (fields.length > 3 && fields[fields.length - 1] === '') fields.pop();
      out.push(`P | ${fields.join(' | ')}`);
    }
  }
  return out.join('\n');
}

// ─── Exemplo e prompt para IA ─────────────────────────────────────────────────

export const MAP_DSL_EXAMPLE = `MAP Cripta de Vhalor
GRID 200
LAYOUT radial

# N | id | Nome | cap | col,row | raio | descrição
N | entrada    | Entrada da Cripta   | 4 | 0,2   |    | Portas de bronze rachadas, cobertas de limo.
N | salao      | Salão das Colunas   | 8 | 0,1   | 55 | Doze colunas quebradas sustentam o teto ruído.
N | ala_leste  | Ala Leste           | 3 | 1,0   |    | Nichos funerários vazios.
N | ala_oeste  | Ala Oeste           | 3 | -1,0  |    | Restos de um altar derrubado.
N | tumba      | Tumba de Vhalor     | 6 | 0,-1  | 60 | O sarcófago está aberto. Algo saiu daqui.

# P | origem | destino | distância | características | rótulo
P | entrada   | salao     | 3 | dificil          | Escadaria íngreme
P | salao     | ala_leste | 2 |                  |
P | salao     | ala_oeste | 2 | sem_visao        | Corredor sem tochas
P | ala_leste | tumba     | 4 | perigoso,salto   | Fenda no chão
P | ala_oeste | tumba     | 4 | instavel         |`;

/** Especificação completa da notação — texto colável em qualquer IA. */
export const MAP_DSL_PROMPT = `Você vai gerar um mapa de RPG no formato de texto MAPDSL. Responda APENAS com o código, sem explicações e sem blocos de markdown.

## Formato

Uma instrução por linha. Linhas vazias e linhas começando com "#" são ignoradas.

### Cabeçalho
MAP <nome do mapa>
GRID <número>            (opcional, padrão 200 — espaçamento em pixels de 1 unidade de grade)
LAYOUT <modo>            (opcional, padrão radial — usado só para os nós SEM coordenada)

Modos de LAYOUT: radial (árvore a partir do nó mais conectado), layers (camadas horizontais centradas), ring (todos num círculo), grid (malha quadrada).

### Nós (locais / salas)
N | id | Nome | capacidade | col,row | raio | descrição

- id: identificador curto, sem espaços nem acentos (ex: salao_norte). Usado nos caminhos.
- Nome: texto exibido no nó.
- capacidade: quantas criaturas cabem no local (inteiro, padrão 4).
- col,row: coordenada NA GRADE, não em pixels. Inteiros ou decimais com PONTO (0.5, nunca 0,5), positivos ou negativos. col cresce para a direita, row cresce para BAIXO. Ex: 0,0 é o centro; -1,2 é uma coluna à esquerda e duas linhas abaixo.
- raio: tamanho do círculo em pixels, 20 a 80 (opcional — se vazio, é derivado da capacidade).
- descrição: texto livre. Não use o caractere "|" dentro dela.

Todos os campos a partir da capacidade são opcionais; deixe vazio (dois "|" seguidos) ou corte o resto da linha.

Formas curtas aceitas: "N | Nome" (id derivado do nome) e "N | Nome | capacidade | col,row" (sem id explícito). Nos caminhos você pode escrever "P | origem > destino | distância | ...".

### Caminhos (conexões)
P | origem | destino | distância | características | rótulo

- origem/destino: o id (ou o nome exato) dos nós.
- distância: número em metros (padrão 1).
- características: nenhuma, uma ou várias separadas por vírgula. Valores válidos:
  dificil, sem_visao, salto, instavel, perigoso, bloqueado
- rótulo: texto curto opcional (ex: "Porta emperrada").

Os caminhos são bidirecionais. Não repita a mesma dupla de nós.

## Regras de posicionamento

1. Prefira dar coordenadas col,row explícitas a TODOS os nós — assim o mapa fica exatamente como você planejou.
2. Pense na grade como papel quadriculado. Mantenha simetria: se há uma ala leste em 1,0, coloque a ala oeste em -1,0. Eixos principais em col=0 ou row=0.
3. Não repita a mesma coordenada em dois nós.
4. Se preferir que o programa posicione tudo sozinho, omita TODAS as coordenadas e escolha um LAYOUT — o resultado será simétrico automaticamente.
5. Use no máximo ~25 nós para o mapa continuar legível.

## Exemplo completo

${MAP_DSL_EXAMPLE}

## Sua tarefa

Gere o código MAPDSL para o mapa descrito a seguir. Dê nomes evocativos, descrições curtas (1-2 frases) e distâncias coerentes com o tamanho dos locais.

MAPA PEDIDO: `;
