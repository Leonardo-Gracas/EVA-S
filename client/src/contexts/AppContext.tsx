import React, {
  createContext, useContext, useEffect, useReducer, useCallback, useState, ReactNode,
} from 'react';
import {
  Campaign, Player, Character, HistoryEvent, CharacterRequest, EffectTemplate, ItemTemplate, CombatSession, Grimorio,
  SheetType, ResourceDef, ProtectionDef, ConditionDef, AttributeDef, DEFAULT_SHEET_CONFIG,
} from '../types';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

// ======================== STATE ========================

interface AppState {
  campaign: Campaign | null;
  players: Player[];
  characters: Character[];
  history: HistoryEvent[];
  requests: CharacterRequest[];
  effectTemplates: EffectTemplate[];
  itemTemplates: ItemTemplate[];
  grimorios: Grimorio[];
  sheetTypes: SheetType[];
  activeCombat: CombatSession | null;
  loading: boolean;
  error: string | null;
  connectedCount: number;
}

const initialState: AppState = {
  campaign: null,
  players: [],
  characters: [],
  history: [],
  requests: [],
  effectTemplates: [],
  itemTemplates: [],
  grimorios: [],
  sheetTypes: [],
  activeCombat: null,
  loading: true,
  error: null,
  connectedCount: 0,
};

// ======================== ACTIONS ========================

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CAMPAIGN'; payload: Campaign }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'SET_CHARACTERS'; payload: Character[] }
  | { type: 'SET_HISTORY'; payload: HistoryEvent[] }
  | { type: 'SET_REQUESTS'; payload: CharacterRequest[] }
  | { type: 'ADD_REQUEST'; payload: CharacterRequest }
  | { type: 'UPDATE_REQUEST'; payload: CharacterRequest }
  | { type: 'UPDATE_PLAYER'; payload: Player }
  | { type: 'REMOVE_PLAYER'; payload: string }
  | { type: 'UPDATE_CHARACTER'; payload: Character }
  | { type: 'REMOVE_CHARACTER'; payload: string }
  | { type: 'ADD_HISTORY'; payload: HistoryEvent }
  | { type: 'SET_CONNECTED_COUNT'; payload: number }
  | { type: 'SET_EFFECT_TEMPLATES'; payload: EffectTemplate[] }
  | { type: 'SET_ITEM_TEMPLATES'; payload: ItemTemplate[] }
  | { type: 'SET_GRIMORIOS'; payload: Grimorio[] }
  | { type: 'SET_SHEET_TYPES'; payload: SheetType[] }
  | { type: 'SET_COMBAT'; payload: CombatSession | null };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CAMPAIGN':
      return { ...state, campaign: action.payload };
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };
    case 'SET_CHARACTERS':
      return { ...state, characters: action.payload };
    case 'SET_HISTORY':
      return { ...state, history: action.payload };
    case 'SET_REQUESTS':
      return { ...state, requests: action.payload };
    case 'ADD_REQUEST':
      return { ...state, requests: [action.payload, ...state.requests] };
    case 'UPDATE_REQUEST':
      return {
        ...state,
        requests: state.requests.map((r) => r.id === action.payload.id ? action.payload : r),
      };
    case 'UPDATE_PLAYER':
      return {
        ...state,
        players: state.players.some((p) => p.id === action.payload.id)
          ? state.players.map((p) => p.id === action.payload.id ? action.payload : p)
          : [...state.players, action.payload],
      };
    case 'REMOVE_PLAYER':
      return { ...state, players: state.players.filter((p) => p.id !== action.payload) };
    case 'UPDATE_CHARACTER':
      return {
        ...state,
        characters: state.characters.some((c) => c.id === action.payload.id)
          ? state.characters.map((c) => c.id === action.payload.id ? action.payload : c)
          : [...state.characters, action.payload],
      };
    case 'REMOVE_CHARACTER':
      return { ...state, characters: state.characters.filter((c) => c.id !== action.payload) };
    case 'ADD_HISTORY':
      return { ...state, history: [action.payload, ...state.history].slice(0, 100) };
    case 'SET_CONNECTED_COUNT':
      return { ...state, connectedCount: action.payload };
    case 'SET_EFFECT_TEMPLATES':
      return { ...state, effectTemplates: action.payload };
    case 'SET_ITEM_TEMPLATES':
      return { ...state, itemTemplates: action.payload };
    case 'SET_GRIMORIOS':
      return { ...state, grimorios: action.payload };
    case 'SET_SHEET_TYPES':
      return { ...state, sheetTypes: action.payload };
    case 'SET_COMBAT':
      return { ...state, activeCombat: action.payload };
    default:
      return state;
  }
}

// ======================== TOAST ========================

export interface RequestToast {
  id: string;
  playerName: string;
  description: string;
  requestId: string;
}

// ======================== CONTEXT ========================

interface AppContextValue extends AppState {
  refreshAll: () => Promise<void>;
  dispatch: React.Dispatch<Action>;
  toasts: RequestToast[];
  dismissToast: (id: string) => void;
  /** Tipo de ficha padrao da campanha (fallback quando nenhum sheetTypeId e passado). */
  defaultSheetType: SheetType;
  getSheetType: (sheetTypeId?: string) => SheetType;
  getResourceDefs: (sheetTypeId?: string) => ResourceDef[];
  getProtectionDefs: (sheetTypeId?: string) => ProtectionDef[];
  getConditionDefs: (sheetTypeId?: string) => ConditionDef[];
  getResourceDef: (key: string, sheetTypeId?: string) => ResourceDef | undefined;
  getProtectionDef: (key: string, sheetTypeId?: string) => ProtectionDef | undefined;
  getConditionDef: (key: string, sheetTypeId?: string) => ConditionDef | undefined;
  getResourceLabel: (key: string, sheetTypeId?: string) => string;
  getResourceColor: (key: string, sheetTypeId?: string) => string;
  getProtectionLabel: (key: string, sheetTypeId?: string) => string;
  getProtectionColor: (key: string, sheetTypeId?: string) => string;
  getAttributeDefaults: (sheetTypeId?: string) => AttributeDef[];
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toasts, setToasts] = useState<RequestToast[]>([]);

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const refreshAll = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const [campaign, players, characters, history, requests, effectTemplates, itemTemplates, grimorios, sheetTypes, activeCombat] = await Promise.all([
        api.campaign.get(),
        api.players.list(),
        api.characters.list(),
        api.history.list(50),
        api.requests.list(),
        api.effectTemplates.list(),
        api.itemTemplates.list(),
        api.grimorios.list(),
        api.sheetTypes.list(),
        api.combat.getActive(),
      ]);
      dispatch({ type: 'SET_CAMPAIGN', payload: campaign });
      dispatch({ type: 'SET_PLAYERS', payload: players });
      dispatch({ type: 'SET_CHARACTERS', payload: characters });
      dispatch({ type: 'SET_HISTORY', payload: history });
      dispatch({ type: 'SET_REQUESTS', payload: requests });
      dispatch({ type: 'SET_EFFECT_TEMPLATES', payload: effectTemplates });
      dispatch({ type: 'SET_ITEM_TEMPLATES', payload: itemTemplates });
      dispatch({ type: 'SET_GRIMORIOS', payload: grimorios });
      dispatch({ type: 'SET_SHEET_TYPES', payload: sheetTypes });
      dispatch({ type: 'SET_COMBAT', payload: activeCombat });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const socket = getSocket();

    socket.on('campaign:updated', (campaign: Campaign) => {
      dispatch({ type: 'SET_CAMPAIGN', payload: campaign });
    });
    socket.on('campaign:switched', () => {
      refreshAll();
    });
    socket.on('player:updated', (player: Player) => {
      dispatch({ type: 'UPDATE_PLAYER', payload: player });
    });
    socket.on('player:removed', ({ id }: { id: string }) => {
      dispatch({ type: 'REMOVE_PLAYER', payload: id });
    });
    socket.on('players:online', (players: Player[]) => {
      dispatch({ type: 'SET_PLAYERS', payload: players });
      dispatch({ type: 'SET_CONNECTED_COUNT', payload: players.filter((p) => p.status === 'online').length });
    });
    socket.on('character:updated', (character: Character) => {
      dispatch({ type: 'UPDATE_CHARACTER', payload: character });
    });
    socket.on('character:removed', ({ id }: { id: string }) => {
      dispatch({ type: 'REMOVE_CHARACTER', payload: id });
    });
    socket.on('combat:updated', (session: CombatSession) => {
      dispatch({ type: 'SET_COMBAT', payload: session.status === 'active' ? session : null });
    });
    socket.on('history:event', (event: HistoryEvent) => {
      dispatch({ type: 'ADD_HISTORY', payload: event });
    });
    socket.on('request:new', (req: CharacterRequest) => {
      dispatch({ type: 'ADD_REQUEST', payload: req });
      const toast: RequestToast = {
        id: `toast-${Date.now()}`,
        playerName: req.playerName,
        description: req.description,
        requestId: req.id,
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => dismissToast(toast.id), 7000);
    });
    socket.on('request:updated', (req: CharacterRequest) => {
      dispatch({ type: 'UPDATE_REQUEST', payload: req });
    });
    socket.on('itemTemplates:updated', (templates: ItemTemplate[]) => {
      dispatch({ type: 'SET_ITEM_TEMPLATES', payload: templates });
    });
    socket.on('effectTemplates:updated', (templates: EffectTemplate[]) => {
      dispatch({ type: 'SET_EFFECT_TEMPLATES', payload: templates });
    });
    socket.on('grimorios:updated', (grimorios: Grimorio[]) => {
      dispatch({ type: 'SET_GRIMORIOS', payload: grimorios });
    });
    socket.on('sheetTypes:updated', (sheetTypes: SheetType[]) => {
      dispatch({ type: 'SET_SHEET_TYPES', payload: sheetTypes });
    });

    return () => {
      socket.off('campaign:updated');
      socket.off('campaign:switched');
      socket.off('player:updated');
      socket.off('player:removed');
      socket.off('players:online');
      socket.off('character:updated');
      socket.off('character:removed');
      socket.off('history:event');
      socket.off('request:new');
      socket.off('request:updated');
      socket.off('itemTemplates:updated');
      socket.off('effectTemplates:updated');
      socket.off('grimorios:updated');
      socket.off('sheetTypes:updated');
    };
  }, []);

  // Tipo de ficha padrao — usado como fallback sempre que um chamador nao informa um sheetTypeId
  // (editores de template globais, formularios antes de um personagem existir, etc). Enquanto o
  // primeiro fetch nao chega, cai num SheetType sintetico a partir do DEFAULT_SHEET_CONFIG.
  const fallbackSheetType: SheetType = {
    id: '', name: 'Padrão', icon: 'Scroll', color: '#6366f1', isDefault: true, sortOrder: 0,
    config: DEFAULT_SHEET_CONFIG, createdAt: '', updatedAt: '',
  };
  const defaultSheetType = state.sheetTypes.find((t) => t.isDefault) ?? state.sheetTypes[0] ?? fallbackSheetType;
  const getSheetType = (sheetTypeId?: string): SheetType => {
    if (!sheetTypeId) return defaultSheetType;
    return state.sheetTypes.find((t) => t.id === sheetTypeId) ?? defaultSheetType;
  };
  const getResourceDefs = (sheetTypeId?: string) => getSheetType(sheetTypeId).config.resources;
  const getProtectionDefs = (sheetTypeId?: string) => getSheetType(sheetTypeId).config.protections;
  const getConditionDefs = (sheetTypeId?: string) => getSheetType(sheetTypeId).config.conditions;
  const getResourceDef = (key: string, sheetTypeId?: string) => getResourceDefs(sheetTypeId).find((r) => r.key === key);
  const getProtectionDef = (key: string, sheetTypeId?: string) => getProtectionDefs(sheetTypeId).find((p) => p.key === key);
  const getConditionDef = (key: string, sheetTypeId?: string) => getConditionDefs(sheetTypeId).find((c) => c.key === key);
  const getResourceLabel = (key: string, sheetTypeId?: string) => getResourceDef(key, sheetTypeId)?.label ?? key;
  const getResourceColor = (key: string, sheetTypeId?: string) => getResourceDef(key, sheetTypeId)?.color ?? 'var(--text-muted)';
  const getProtectionLabel = (key: string, sheetTypeId?: string) => getProtectionDef(key, sheetTypeId)?.label ?? key;
  const getProtectionColor = (key: string, sheetTypeId?: string) => getProtectionDef(key, sheetTypeId)?.color ?? 'var(--text-muted)';
  const getAttributeDefaults = (sheetTypeId?: string) => getSheetType(sheetTypeId).config.attributes;

  return (
    <AppContext.Provider value={{
      ...state, refreshAll, dispatch, toasts, dismissToast,
      defaultSheetType, getSheetType, getResourceDefs, getProtectionDefs, getConditionDefs, getResourceDef, getProtectionDef, getConditionDef,
      getResourceLabel, getResourceColor, getProtectionLabel, getProtectionColor, getAttributeDefaults,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}
