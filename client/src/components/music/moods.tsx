import React from 'react';
import { Sword, Compass, Drama, AlertTriangle, Music, Sparkles, Star } from 'lucide-react';
import type { PlaylistMood } from '../../types';

// Metadados de mood das playlists da campanha. Ficam aqui (e nao no player)
// porque sao a mesma coisa em qualquer lugar que mostre uma playlist.

export const MOOD_LABELS: Record<PlaylistMood, string> = {
  combat: 'Combate',
  exploration: 'Exploração',
  drama: 'Drama',
  tension: 'Tensão',
  ambient: 'Ambiente',
  celebration: 'Celebração',
  other: 'Outro',
};

export const MOOD_COLORS: Record<PlaylistMood, string> = {
  combat: '#ef4444',
  exploration: '#22c55e',
  drama: '#8b5cf6',
  tension: '#f59e0b',
  ambient: '#06b6d4',
  celebration: '#f97316',
  other: '#6b7280',
};

const MOOD_ICONS = {
  combat: Sword,
  exploration: Compass,
  drama: Drama,
  tension: AlertTriangle,
  ambient: Music,
  celebration: Sparkles,
  other: Star,
} as const;

export const MOOD_OPTIONS = (Object.keys(MOOD_LABELS) as PlaylistMood[])
  .map((value) => ({ value, label: MOOD_LABELS[value] }));

/** Mood vindo do banco pode ser um valor antigo — cai em `other` sem quebrar. */
export function MoodIcon({ mood, size = 13 }: { mood: PlaylistMood; size?: number }) {
  const Icon = MOOD_ICONS[mood] ?? Star;
  return <Icon size={size} />;
}

export function moodColor(mood: PlaylistMood): string {
  return MOOD_COLORS[mood] ?? MOOD_COLORS.other;
}

export function moodLabel(mood: PlaylistMood): string {
  return MOOD_LABELS[mood] ?? MOOD_LABELS.other;
}
