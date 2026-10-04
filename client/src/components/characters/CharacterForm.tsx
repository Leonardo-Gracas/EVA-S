import React, { useState, useRef } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Upload, X, Image } from 'lucide-react';
import { api } from '../../services/api';
import {
  Character, CreateCharacterDTO, AttributeRating, AttributeDef,
  ATTRIBUTE_RATING_LABELS, ATTRIBUTE_RATING_COLORS, DEFAULT_DISPLACEMENT,
} from '../../types';
import { Input, Textarea, Select } from '../common/Input';
import Button from '../common/Button';
import { useApp } from '../../contexts/AppContext';
import { ICON_MAP } from './SkillIconPicker';

interface AttributeItem {
  id: string;
  name: string;
  rating: AttributeRating;
}

function buildDefaultAttributes(defs: AttributeDef[]): AttributeItem[] {
  return defs.map((def, i) => ({
    id: `attr-${i}`,
    name: def.name,
    rating: def.defaultRating,
  }));
}

const ALL_RATINGS: AttributeRating[] = ['excellent', 'good', 'normal', 'bad'];

function SortableAttr({ attr, onChange }: { attr: AttributeItem; onChange: (rating: AttributeRating) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: attr.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={{ ...attrStyles.row, ...style }}>
      <span style={attrStyles.grip} {...attributes} {...listeners}>
        <GripVertical size={14} color="var(--text-muted)" />
      </span>
      <span style={attrStyles.name}>{attr.name}</span>
      <div style={attrStyles.ratingBtns}>
        {ALL_RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            style={{
              ...attrStyles.ratingBtn,
              background: attr.rating === r ? `${ATTRIBUTE_RATING_COLORS[r]}25` : 'transparent',
              color: attr.rating === r ? ATTRIBUTE_RATING_COLORS[r] : 'var(--text-muted)',
              border: `1px solid ${attr.rating === r ? ATTRIBUTE_RATING_COLORS[r] : 'var(--border)'}`,
            }}
          >
            {ATTRIBUTE_RATING_LABELS[r]}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  character?: Character;
  defaultType?: 'pc' | 'npc';
  lockedPlayerId?: string;
  onSave: (character: Character) => void;
  onCancel: () => void;
  /** When provided, bypasses the API call and passes the DTO directly (used for request flows) */
  onRequestDTO?: (dto: CreateCharacterDTO) => Promise<void>;
}

export default function CharacterForm({ character, defaultType = 'pc', lockedPlayerId, onSave, onCancel, onRequestDTO }: Props) {
  const { players, getResourceDefs, getProtectionDefs, getAttributeDefaults, sheetTypes, defaultSheetType } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const characterType = character?.type ?? defaultType;

  const [sheetTypeId, setSheetTypeId] = useState(character?.sheetTypeId ?? defaultSheetType.id);
  const resourceDefs = getResourceDefs(sheetTypeId);
  const protectionDefs = getProtectionDefs(sheetTypeId);

  const [name, setName] = useState(character?.name ?? '');
  const [playerId, setPlayerId] = useState(character?.playerId ?? lockedPlayerId ?? '');
  const [description, setDescription] = useState(character?.description ?? '');
  const [avatar, setAvatar] = useState(character?.avatar ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [resources, setResources] = useState<Record<string, number>>(() =>
    Object.fromEntries(resourceDefs.map((def) => [def.key, character?.resources[def.key] ?? def.defaultValue]))
  );
  const [displacement, setDisplacement] = useState(character?.displacement ?? DEFAULT_DISPLACEMENT);
  const [protections, setProtections] = useState<Record<string, number>>(() =>
    Object.fromEntries(protectionDefs.map((def) => [def.key, character?.protections?.[def.key] ?? 0]))
  );
  const [inspiration, setInspiration] = useState(character?.inspiration ?? 0);
  const [attrs, setAttrs] = useState<AttributeItem[]>(
    character?.attributes?.map((a) => ({ id: a.id, name: a.name, rating: a.rating })) ?? buildDefaultAttributes(getAttributeDefaults(sheetTypeId))
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Trocar o tipo de ficha re-renderiza Recursos/Proteções/Atributos com os campos e valores
  // padrão do tipo escolhido. Preserva valores só do personagem sendo editado (dado real) —
  // NUNCA do estado anterior do formulário: dois tipos podem ter uma chave com o mesmo nome
  // por coincidência (ambos herdados do mesmo template ao serem criados) representando campos
  // sem nenhuma relação entre si (ex: "health" = "Riqueza" num tipo e "Fortuna" no outro), e usar
  // `prev[key]` fazia o valor do tipo ANTERIOR vazar pro campo do tipo novo nesse caso.
  const changeSheetType = (id: string) => {
    setSheetTypeId(id);
    const newResourceDefs = getResourceDefs(id);
    const newProtectionDefs = getProtectionDefs(id);
    setResources(Object.fromEntries(newResourceDefs.map((def) => [def.key, character?.resources[def.key] ?? def.defaultValue])));
    setProtections(Object.fromEntries(newProtectionDefs.map((def) => [def.key, character?.protections?.[def.key] ?? 0])));
    setAttrs(buildDefaultAttributes(getAttributeDefaults(id)));
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const resourceValues = resourceDefs.map((def) => resources[def.key] ?? 0);
  const resourceSum = resourceValues.reduce((a, b) => a + b, 0);
  // Balanceamento de ponto-compra (soma 70, faixa 15-30) só faz sentido para o conjunto padrão de 3 recursos
  const isDefaultResourceSet = resourceDefs.length === 3 && resourceDefs.every((d) => ['health', 'sanity', 'exposure'].includes(d.key));
  const resourceValid = !isDefaultResourceSet || (resourceSum === 70 && resourceValues.every((v) => v >= 15 && v <= 30));

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Falha no upload');
      const { url } = await res.json();
      setAvatar(url);
    } catch {
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setAttrs((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const changeAttrRating = (id: string, rating: AttributeRating) => {
    setAttrs((prev) => prev.map((a) => a.id === id ? { ...a, rating } : a));
  };

  // Apenas avisa — só o nome bloqueia
  const updateWarnings = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Nome obrigatório';
    if (!resourceValid) e.resources = resourceSum !== 70
      ? `Aviso: soma deve ser 70 (atual: ${resourceSum})`
      : 'Aviso: cada recurso deve estar entre 15 e 30';
    setErrors(e);
    return !e.name;
  };

  const handleSave = async () => {
    if (!updateWarnings()) return;
    if (character && sheetTypeId !== character.sheetTypeId) {
      const ok = confirm(
        'Trocar o tipo de ficha reconcilia Recursos/Proteções/Condições do personagem contra os campos do novo tipo ' +
        '(chaves que não existem no novo tipo somem; chaves novas entram zeradas). Continuar?'
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const dto: CreateCharacterDTO = {
        name: name.trim(),
        type: characterType,
        playerId: characterType === 'npc' ? null : (playerId || null),
        avatar: avatar || null,
        description,
        sheetTypeId,
        resources,
        attributes: attrs.map(({ name: n, rating }) => ({ name: n, rating })),
        protections,
        inspiration,
      };
      // @ts-ignore — displacement passed via update patch
      if (character) (dto as any).displacement = displacement;

      if (onRequestDTO) {
        await onRequestDTO(dto);
        return;
      }

      let result: Character;
      if (character) {
        result = await api.characters.update(character.id, dto);
      } else {
        result = await api.characters.create(dto);
      }
      onSave(result);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const playerOptions = [
    { value: '', label: '— Nenhum jogador —' },
    ...players.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div style={styles.form}>
      {sheetTypes.length > 1 && (
        <div>
          <label style={styles.label}>Tipo de ficha</label>
          <div style={styles.sheetTypeRow}>
            {sheetTypes.map((st) => {
              const Icon = ICON_MAP[st.icon] ?? ICON_MAP['Scroll'];
              const active = st.id === sheetTypeId;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => changeSheetType(st.id)}
                  style={{
                    ...styles.sheetTypeBtn,
                    ...(active ? { background: `${st.color}20`, borderColor: st.color, color: st.color } : {}),
                  }}
                >
                  <Icon size={13} color={active ? st.color : 'var(--text-muted)'} />
                  {st.name}
                </button>
              );
            })}
          </div>
          {character && sheetTypeId !== character.sheetTypeId && (
            <p style={styles.hint}>
              Ao salvar, Recursos/Proteções/Condições serão reconciliados contra o novo tipo.
            </p>
          )}
        </div>
      )}

      <Input
        label="Nome do personagem"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />

      {characterType === 'pc' && !lockedPlayerId && (
        <Select
          label="Jogador"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          options={playerOptions}
        />
      )}

      <Textarea
        label="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      {/* Avatar upload */}
      <div>
        <label style={styles.label}>Avatar / Foto do personagem</label>
        <div style={styles.avatarRow}>
          {/* Preview */}
          <div style={styles.avatarPreview}>
            {avatar ? (
              <>
                <img src={avatar} alt="avatar" style={styles.avatarImg} />
                <button
                  type="button"
                  style={styles.removeAvatar}
                  onClick={() => setAvatar('')}
                  title="Remover avatar"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <div style={styles.avatarEmpty}>
                <Image size={20} color="var(--text-muted)" />
              </div>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Upload size={13} />}
              loading={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingAvatar ? 'Enviando...' : 'Escolher imagem'}
            </Button>
            <p style={styles.hint}>JPG, PNG, GIF ou WebP · máx. 10 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>
        </div>
      </div>

      {/* Recursos */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Recursos</span>
          {isDefaultResourceSet && (
            <span style={{ ...styles.sumBadge, color: resourceValid ? 'var(--success)' : 'var(--warning)' }}>
              Soma: {resourceSum}/70
            </span>
          )}
        </div>
        {errors.resources && <span style={styles.fieldWarn}>{errors.resources}</span>}
        <div style={styles.resourceGrid}>
          {resourceDefs.map((def) => (
            <div key={def.key} style={styles.resourceBox}>
              <label style={{ ...styles.resourceLabel, color: def.color }}>{def.label}</label>
              <input
                type="number" min={1} max={99} value={resources[def.key] ?? 0}
                onChange={(e) => setResources((prev) => ({ ...prev, [def.key]: Number(e.target.value) }))}
                style={{ ...styles.resourceInput, borderColor: def.color + '60', color: def.color }}
              />
            </div>
          ))}
        </div>
      </div>


      {/* Proteções */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Proteções</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>base — bônus de equipamentos somados automaticamente</span>
        </div>
        <div style={styles.resourceGrid}>
          {protectionDefs.map((def) => (
            <div key={def.key} style={styles.resourceBox}>
              <label style={{ ...styles.resourceLabel, color: def.color }}>{def.label}</label>
              <input
                type="number" min={0} max={99} value={protections[def.key] ?? 0}
                onChange={(e) => setProtections((prev) => ({ ...prev, [def.key]: Number(e.target.value) }))}
                style={{ ...styles.resourceInput, borderColor: def.color + '60', color: def.color }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Inspirações */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Inspirações</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>pontos concedidos pelo mestre como vantagem</span>
        </div>
        <input
          type="number" min={0} max={99} value={inspiration}
          onChange={(e) => setInspiration(Number(e.target.value))}
          style={{ ...styles.resourceInput, borderColor: '#f59e0b60', color: '#f59e0b', width: 90 }}
        />
      </div>

      {/* Deslocamento */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Deslocamento</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>metros disponíveis por turno no mapa</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number" min={0} max={99} step={0.5} value={displacement}
            onChange={e => setDisplacement(Number(e.target.value))}
            style={{ ...styles.resourceInput, borderColor: '#22c55e60', color: '#22c55e', width: 90 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>m / turno</span>
        </div>
      </div>

      {/* Atributos */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Atributos</span>
        </div>
        <p style={styles.hint}>Arraste para reordenar.</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={attrs.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {attrs.map((attr) => (
                <SortableAttr key={attr.id} attr={attr} onChange={(r) => changeAttrRating(attr.id, r)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div style={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={handleSave}>
          {character ? 'Salvar alterações' : 'Criar personagem'}
        </Button>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' },
  avatarRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  avatarPreview: {
    width: '64px', height: '64px', borderRadius: 'var(--radius)',
    overflow: 'hidden', flexShrink: 0, position: 'relative',
    border: '1px solid var(--border)', background: 'var(--bg-elevated)',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarEmpty: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  removeAvatar: {
    position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)',
    border: 'none', color: 'white', borderRadius: '50%', width: '18px', height: '18px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  hint: { fontSize: '11px', color: 'var(--text-muted)' },
  sheetTypeRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  sheetTypeBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
    borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  section: {
    background: 'var(--bg-elevated)', borderRadius: 'var(--radius)',
    padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  sumBadge: { fontSize: '12px', fontWeight: 600 },
  fieldWarn: { fontSize: '11px', color: 'var(--warning)' },
  resourceGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  resourceBox: { display: 'flex', flexDirection: 'column', gap: '5px' },
  resourceLabel: { fontSize: '12px', fontWeight: 600 },
  resourceInput: {
    padding: '8px', background: 'var(--bg-surface)', border: '1px solid',
    borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '18px',
    fontWeight: 700, textAlign: 'center', width: '100%',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' },
};

const attrStyles: Record<string, any> = {
  row: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
    padding: '7px 10px', cursor: 'default',
  },
  grip: { cursor: 'grab', display: 'flex', alignItems: 'center' },
  name: { flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' },
  ratingBtns: { display: 'flex', gap: '4px' },
  ratingBtn: {
    padding: '3px 8px', borderRadius: 'var(--radius-sm)',
    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
    transition: 'all var(--transition)',
  },
};
