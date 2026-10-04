import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, GripVertical, RotateCcw, Sparkles, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../services/api';
import {
  ResourceDef, ProtectionDef, ConditionDef, AttributeDef, AttributeRating, SheetType, SheetConfig,
  ATTRIBUTE_RATING_LABELS, ATTRIBUTE_RATING_COLORS, DEFAULT_SHEET_CONFIG,
} from '../../types';
import SkillIconPicker, { ICON_MAP } from '../characters/SkillIconPicker';
import Button from '../common/Button';

const ACCENT_MAP: Record<string, string> = {
  a: 'áàâãä', e: 'éèêë', i: 'íìîï', o: 'óòôõö', u: 'úùûü', c: 'ç', n: 'ñ',
};

function stripAccents(str: string): string {
  let out = str.toLowerCase();
  for (const [plain, accented] of Object.entries(ACCENT_MAP)) {
    for (const ch of accented) out = out.split(ch).join(plain);
  }
  return out;
}

function slugify(label: string): string {
  return stripAccents(label).trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'campo';
}

function makeKey(label: string, existing: string[]): string {
  const base = slugify(label);
  let key = base;
  let i = 1;
  while (existing.includes(key)) key = `${base}_${i++}`;
  return key;
}

/**
 * Chaves de Recursos/Protecoes/Condicoes de todos os OUTROS tipos de ficha da campanha (exclui o
 * tipo atualmente aberto no editor, cujas proprias chaves ja sao passadas separadamente por cada
 * addDef). Efeitos de item/skill mesclam campos de todos os tipos numa unica lista global de stats
 * (ver allEffectStatsForCampaign em types/index.ts) — se dois tipos de ficha diferentes acabarem com
 * a MESMA chave (ex: ambos ganhando um primeiro recurso "Novo campo" -> "novo_campo"), um efeito que
 * mira essa chave passa a afetar as duas fichas ao mesmo tempo, mesmo sendo conceitualmente campos
 * diferentes. Por isso o gerador de chave precisa checar TODOS os tipos, nao so o que esta sendo editado.
 */
function otherTypesKeys(allSheetTypes: SheetType[], currentSheetTypeId: string): string[] {
  return allSheetTypes
    .filter((st) => st.id !== currentSheetTypeId)
    .flatMap((st) => [
      ...st.config.resources.map((r) => r.key),
      ...st.config.protections.map((p) => p.key),
      ...st.config.conditions.map((c) => c.key),
    ]);
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

// ── Sortable row wrapper ─────────────────────────────────────────────────────

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={{ ...s.row, ...style }}>
      <span style={s.grip} {...attributes} {...listeners}>
        <GripVertical size={14} color="var(--text-muted)" />
      </span>
      {children}
    </div>
  );
}

// ── Attribute defs section (nome + nivel padrao) ──────────────────────────────

interface AttrItem { id: string; name: string; defaultRating: AttributeRating }

const ALL_RATINGS: AttributeRating[] = ['excellent', 'good', 'normal', 'bad'];

function toAttrItems(defs: AttributeDef[]): AttrItem[] {
  return defs.map((d) => ({ id: newId(), name: d.name, defaultRating: d.defaultRating }));
}

function toAttributeDefs(items: AttrItem[]): AttributeDef[] {
  return items.map((i) => ({ name: i.name, defaultRating: i.defaultRating }));
}

function AttributesSection({ attributes, onChange }: { attributes: AttributeDef[]; onChange: (attributes: AttributeDef[]) => void }) {
  const [items, setItems] = useState<AttrItem[]>(() => toAttrItems(attributes));
  // Só resincroniza a partir da prop quando a mudança veio de FORA (reset, reload de campanha) —
  // nunca a partir do round-trip do nosso próprio onChange, senão cada tecla digitada gera ids
  // novos e remonta os inputs (perdendo o foco).
  const lastEmitted = useRef<AttributeDef[]>(attributes);
  useEffect(() => {
    if (JSON.stringify(attributes) === JSON.stringify(lastEmitted.current)) return;
    lastEmitted.current = attributes;
    setItems(toAttrItems(attributes));
  }, [attributes]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const emit = (next: AttrItem[]) => {
    setItems(next);
    const nextAttrs = toAttributeDefs(next);
    lastEmitted.current = nextAttrs;
    onChange(nextAttrs);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      emit(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>Atributos</span>
        <span style={s.cardSub}>nomes e nível padrão sugeridos ao criar um personagem novo</span>
        <div style={{ flex: 1 }} />
        <button style={s.resetBtn} onClick={() => onChange(DEFAULT_SHEET_CONFIG.attributes.map((a) => ({ ...a })))}>
          <RotateCcw size={12} /> Restaurar padrão
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((item) => (
              <SortableRow key={item.id} id={item.id}>
                <input
                  style={s.labelInput}
                  value={item.name}
                  onChange={(e) => emit(items.map((i) => i.id === item.id ? { ...i, name: e.target.value } : i))}
                />
                <div style={s.ratingBtns}>
                  {ALL_RATINGS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      title={ATTRIBUTE_RATING_LABELS[r]}
                      onClick={() => emit(items.map((i) => i.id === item.id ? { ...i, defaultRating: r } : i))}
                      style={{
                        ...s.ratingBtn,
                        background: item.defaultRating === r ? `${ATTRIBUTE_RATING_COLORS[r]}25` : 'transparent',
                        color: item.defaultRating === r ? ATTRIBUTE_RATING_COLORS[r] : 'var(--text-muted)',
                        border: `1px solid ${item.defaultRating === r ? ATTRIBUTE_RATING_COLORS[r] : 'var(--border)'}`,
                      }}
                    >
                      {ATTRIBUTE_RATING_LABELS[r]}
                    </button>
                  ))}
                </div>
                <button
                  style={s.removeBtn}
                  onClick={() => emit(items.filter((i) => i.id !== item.id))}
                  title="Remover"
                ><X size={13} /></button>
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button style={s.addBtn} onClick={() => emit([...items, { id: newId(), name: 'Novo atributo', defaultRating: 'normal' }])}>
        <Plus size={13} /> Adicionar atributo
      </button>
    </div>
  );
}

// ── Resource / Protection defs section (shared shape) ────────────────────────

interface BaseDef { key: string; label: string; color: string; icon: string }

function DefsSection<T extends BaseDef>({
  title, sub, defs, onChange, defaultDefs, defaultColor, extraDefaults, extraFields, otherKeys,
}: {
  title: string;
  sub: string;
  defs: T[];
  onChange: (defs: T[]) => void;
  defaultDefs: T[];
  defaultColor: string;
  /** Campos extras (fora de key/label/color/icon) atribuidos a um campo novo — ex: defaultValue para Recursos. */
  extraDefaults?: Partial<T>;
  /** Renderiza controles extras na linha de cada item — ex: input de valor padrão para Recursos. */
  extraFields?: (def: T, updateDef: (patch: Partial<T>) => void) => React.ReactNode;
  /** Chaves ja usadas por OUTROS tipos de ficha — evita colisao de chave entre tipos (ver otherTypesKeys). */
  otherKeys: string[];
}) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [pickerOpenKey, setPickerOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (!pickerOpenKey) return;
    const closeIfOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(`[data-picker-row="${pickerOpenKey}"]`)) return;
      setPickerOpenKey(null);
    };
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpenKey(null); };
    document.addEventListener('mousedown', closeIfOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeIfOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [pickerOpenKey]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIndex = defs.findIndex((d) => d.key === active.id);
      const newIndex = defs.findIndex((d) => d.key === over.id);
      onChange(arrayMove(defs, oldIndex, newIndex));
    }
  };

  const updateDef = (key: string, patch: Partial<T>) => {
    onChange(defs.map((d) => d.key === key ? { ...d, ...patch } : d));
  };

  const addDef = () => {
    const label = 'Novo campo';
    const key = makeKey(label, [...defs.map((d) => d.key), ...otherKeys]);
    onChange([...defs, { key, label, color: defaultColor, icon: 'Sparkles', ...extraDefaults } as T]);
  };

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>{title}</span>
        <span style={s.cardSub}>{sub}</span>
        <div style={{ flex: 1 }} />
        <button style={s.resetBtn} onClick={() => onChange(defaultDefs.map((d) => ({ ...d })))}>
          <RotateCcw size={12} /> Restaurar padrão
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={defs.map((d) => d.key)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {defs.map((def) => {
              const Icon = ICON_MAP[def.icon] ?? Sparkles;
              const pickerOpen = pickerOpenKey === def.key;
              return (
                <SortableRow key={def.key} id={def.key}>
                  <button
                    data-picker-row={def.key}
                    style={{ ...s.iconBtn, background: `${def.color}20` }}
                    onClick={() => setPickerOpenKey(pickerOpen ? null : def.key)}
                    title="Icone e cor"
                  >
                    <Icon size={15} color={def.color} />
                  </button>
                  <input
                    style={s.labelInput}
                    value={def.label}
                    onChange={(e) => updateDef(def.key, { label: e.target.value } as Partial<T>)}
                  />
                  {extraFields && extraFields(def, (patch) => updateDef(def.key, patch))}
                  <button
                    style={s.removeBtn}
                    onClick={() => onChange(defs.filter((d) => d.key !== def.key))}
                    title="Remover"
                  ><X size={13} /></button>
                  {pickerOpen && (
                    <div data-picker-row={def.key} style={s.pickerPopover}>
                      <SkillIconPicker
                        selectedIcon={def.icon}
                        selectedColor={def.color}
                        onIconChange={(icon) => updateDef(def.key, { icon } as Partial<T>)}
                        onColorChange={(color) => updateDef(def.key, { color } as Partial<T>)}
                      />
                    </div>
                  )}
                </SortableRow>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <button style={s.addBtn} onClick={addDef}>
        <Plus size={13} /> Adicionar {title.toLowerCase().slice(0, -1)}
      </button>
    </div>
  );
}

// ── Conditions section (defs with nested named-state scales) ─────────────────

function ConditionsSection({ conditions, onChange, otherKeys }: {
  conditions: ConditionDef[];
  onChange: (conditions: ConditionDef[]) => void;
  /** Chaves ja usadas por OUTROS tipos de ficha — evita colisao de chave entre tipos (ver otherTypesKeys). */
  otherKeys: string[];
}) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [pickerOpenKey, setPickerOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (!pickerOpenKey) return;
    const closeIfOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(`[data-picker-row="${pickerOpenKey}"]`)) return;
      setPickerOpenKey(null);
    };
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpenKey(null); };
    document.addEventListener('mousedown', closeIfOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeIfOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [pickerOpenKey]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIndex = conditions.findIndex((d) => d.key === active.id);
      const newIndex = conditions.findIndex((d) => d.key === over.id);
      onChange(arrayMove(conditions, oldIndex, newIndex));
    }
  };

  const updateDef = (key: string, patch: Partial<ConditionDef>) => {
    onChange(conditions.map((d) => d.key === key ? { ...d, ...patch } : d));
  };

  const addDef = () => {
    const label = 'Nova condição';
    const key = makeKey(label, [...conditions.map((d) => d.key), ...otherKeys]);
    onChange([...conditions, { key, label, color: '#6366f1', icon: 'Activity', states: [] }]);
  };

  const addState = (defKey: string) => {
    const def = conditions.find((d) => d.key === defKey);
    if (!def) return;
    updateDef(defKey, { states: [...def.states, { id: newId(), label: 'Novo estado' }] });
  };

  const updateStateLabel = (defKey: string, stateId: string, label: string) => {
    const def = conditions.find((d) => d.key === defKey);
    if (!def) return;
    updateDef(defKey, { states: def.states.map((st) => st.id === stateId ? { ...st, label } : st) });
  };

  const removeState = (defKey: string, stateId: string) => {
    const def = conditions.find((d) => d.key === defKey);
    if (!def) return;
    updateDef(defKey, { states: def.states.filter((st) => st.id !== stateId) });
  };

  const moveState = (defKey: string, stateId: string, dir: -1 | 1) => {
    const def = conditions.find((d) => d.key === defKey);
    if (!def) return;
    const idx = def.states.findIndex((st) => st.id === stateId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= def.states.length) return;
    const next = [...def.states];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    updateDef(defKey, { states: next });
  };

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>Condições</span>
        <span style={s.cardSub}>ex: Saúde (Bem, Mal, Péssimo, Inconsciente, Morto), Fortuna (Galeão, Médio, Pobre, Falência)</span>
      </div>
      <p style={s.hint}>
        Recomendado manter o mesmo número de estados em todas as condições, para facilitar a leitura da ficha —
        mas isso não é obrigatório.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={conditions.map((d) => d.key)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {conditions.map((def) => {
              const Icon = ICON_MAP[def.icon] ?? Activity;
              const pickerOpen = pickerOpenKey === def.key;
              return (
                <SortableRow key={def.key} id={def.key}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        data-picker-row={def.key}
                        style={{ ...s.iconBtn, background: `${def.color}20` }}
                        onClick={() => setPickerOpenKey(pickerOpen ? null : def.key)}
                        title="Icone e cor"
                      >
                        <Icon size={15} color={def.color} />
                      </button>
                      <input
                        style={s.labelInput}
                        value={def.label}
                        onChange={(e) => updateDef(def.key, { label: e.target.value })}
                      />
                      <button
                        style={s.removeBtn}
                        onClick={() => onChange(conditions.filter((d) => d.key !== def.key))}
                        title="Remover"
                      ><X size={13} /></button>
                    </div>
                    {pickerOpen && (
                      <div data-picker-row={def.key} style={{ ...s.pickerPopover, position: 'static', width: 'auto', boxShadow: 'none' }}>
                        <SkillIconPicker
                          selectedIcon={def.icon}
                          selectedColor={def.color}
                          onIconChange={(icon) => updateDef(def.key, { icon })}
                          onColorChange={(color) => updateDef(def.key, { color })}
                        />
                      </div>
                    )}
                    <div style={s.statesRow}>
                      {def.states.map((state, i) => (
                        <div key={state.id} style={s.stateChip}>
                          <button
                            style={{ ...s.stateArrow, opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'not-allowed' : 'pointer' }}
                            disabled={i === 0}
                            onClick={() => moveState(def.key, state.id, -1)}
                            title="Mover para tras"
                          >
                            <ChevronLeft size={11} />
                          </button>
                          <input
                            style={s.stateInput}
                            value={state.label}
                            onChange={(e) => updateStateLabel(def.key, state.id, e.target.value)}
                          />
                          <button
                            style={{ ...s.stateArrow, opacity: i === def.states.length - 1 ? 0.3 : 1, cursor: i === def.states.length - 1 ? 'not-allowed' : 'pointer' }}
                            disabled={i === def.states.length - 1}
                            onClick={() => moveState(def.key, state.id, 1)}
                            title="Mover para frente"
                          >
                            <ChevronRight size={11} />
                          </button>
                          <button style={s.removeStateBtn} onClick={() => removeState(def.key, state.id)} title="Remover estado">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      <button style={s.addStateBtn} onClick={() => addState(def.key)}>
                        <Plus size={11} /> Estado
                      </button>
                    </div>
                  </div>
                </SortableRow>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <button style={s.addBtn} onClick={addDef}>
        <Plus size={13} /> Adicionar condição
      </button>
    </div>
  );
}

// ── Main editor — config de UM tipo de ficha ──────────────────────────────────

export default function SheetTypeEditor({ sheetType, allSheetTypes, onSaved }: { sheetType: SheetType; allSheetTypes: SheetType[]; onSaved: (updated: SheetType) => void }) {
  const otherKeys = otherTypesKeys(allSheetTypes, sheetType.id);
  const [attributes, setAttributes] = useState(sheetType.config.attributes);
  const [resources, setResources] = useState(sheetType.config.resources);
  const [protections, setProtections] = useState(sheetType.config.protections);
  const [conditions, setConditions] = useState(sheetType.config.conditions);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAttributes(sheetType.config.attributes);
    setResources(sheetType.config.resources);
    setProtections(sheetType.config.protections);
    setConditions(sheetType.config.conditions);
  }, [sheetType.id, JSON.stringify(sheetType.config)]);

  const dirty = JSON.stringify({ attributes, resources, protections, conditions }) !== JSON.stringify({
    attributes: sheetType.config.attributes, resources: sheetType.config.resources,
    protections: sheetType.config.protections, conditions: sheetType.config.conditions,
  });

  const resourceKeysChanged = resources.map((r) => r.key).sort().join(',') !== sheetType.config.resources.map((r) => r.key).sort().join(',');
  const protectionKeysChanged = protections.map((p) => p.key).sort().join(',') !== sheetType.config.protections.map((p) => p.key).sort().join(',');
  const conditionsChanged = JSON.stringify(conditions) !== JSON.stringify(sheetType.config.conditions);
  const cascadeWarning = resourceKeysChanged || protectionKeysChanged || conditionsChanged;

  const handleSave = async () => {
    if (cascadeWarning) {
      const ok = confirm(
        'Adicionar ou remover Recursos/Proteções/Condições (ou seus estados) aplica a mudança em TODOS os personagens deste tipo de ficha imediatamente ' +
        '(novos campos entram com valor 0 ou primeiro estado; campos/estados removidos são apagados das fichas). Continuar?'
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const config: SheetConfig = { attributes, resources, protections, conditions };
      const updated = await api.sheetTypes.update(sheetType.id, { config });
      onSaved(updated);
    } catch (err: any) {
      alert(err.message ?? 'Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {dirty && (
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            Salvar alterações
          </Button>
        )}
      </div>

      <AttributesSection attributes={attributes} onChange={setAttributes} />

      <DefsSection
        title="Recursos"
        sub="ex: Saúde, Sanidade, Exposição — barras com valor atual/máximo. O número à direita é o valor padrão ao criar um personagem"
        defs={resources}
        onChange={setResources}
        defaultDefs={DEFAULT_SHEET_CONFIG.resources}
        defaultColor="#6366f1"
        extraDefaults={{ defaultValue: 20 }}
        otherKeys={otherKeys}
        extraFields={(def, updateDef) => (
          <input
            type="number" min={0} max={999}
            value={def.defaultValue}
            onChange={(e) => updateDef({ defaultValue: Number(e.target.value) })}
            style={s.defaultValueInput}
            title="Valor padrão ao criar personagem"
          />
        )}
      />

      <DefsSection
        title="Proteções"
        sub="ex: Física, Mental, Etérea — valores fixos somados a bônus de equipamento"
        defs={protections}
        onChange={setProtections}
        defaultDefs={DEFAULT_SHEET_CONFIG.protections}
        defaultColor="#6366f1"
        otherKeys={otherKeys}
      />

      <ConditionsSection conditions={conditions} onChange={setConditions} otherKeys={otherKeys} />

      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardTitle}>Inspirações</span>
        </div>
        <p style={s.hint}>
          Campo fixo — um contador de pontos que o mestre concede ao personagem como vantagem. O jogador pode gastar
          pontos sozinho (respeitando a permissão "Alterar recursos" em Permissões), mas só o mestre pode conceder novos
          pontos. Aparece automaticamente na ficha de todo personagem deste tipo, sem precisar de configuração aqui.
        </p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, any> = {
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' },
  cardSub: { fontSize: 12, color: 'var(--text-muted)' },
  hint: { fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 },
  resetBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, position: 'relative', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' },
  grip: { cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 },
  iconBtn: { width: 30, height: 30, borderRadius: 'var(--radius-sm)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  labelInput: { flex: 1, padding: '6px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 },
  defaultValueInput: {
    width: 56, padding: '6px 6px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'center', flexShrink: 0,
  },
  ratingBtns: { display: 'flex', gap: 4, flexShrink: 0 },
  ratingBtn: {
    padding: '5px 9px', borderRadius: 'var(--radius-sm)',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 },
  addBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
  },
  pickerPopover: {
    position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20,
    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.45)', width: 280,
  },
  statesRow: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  stateChip: {
    display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-surface)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 2px 2px 6px',
  },
  stateArrow: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
    padding: 2, display: 'flex', alignItems: 'center',
  },
  stateInput: {
    width: 90, padding: '4px 4px', background: 'transparent', border: 'none',
    color: 'var(--text-primary)', fontSize: 12, textAlign: 'center',
  },
  removeStateBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
    padding: 2, display: 'flex', alignItems: 'center',
  },
  addStateBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
  },
};
