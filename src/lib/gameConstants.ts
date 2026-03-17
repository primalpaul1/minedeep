/** Available character avatars */
export interface CharacterDef {
  id: string;
  label: string;
  image: string;
}

const base = import.meta.env.BASE_URL;

export const CHARACTERS: CharacterDef[] = [
  { id: 'saylor', label: 'Michael Saylor', image: `${base}saylor.png` },
  { id: 'dorsey', label: 'Jack Dorsey', image: `${base}dorsey.png` },
  { id: 'mow', label: 'Samson Mow', image: `${base}mow.png` },
  { id: 'saifedean', label: 'Saifedean Ammous', image: `${base}saifedean.png` },
  { id: 'odell', label: 'Odell', image: `${base}odell.png` },
];

/** Nostr event kinds for the SatMiner game */
export const GAME_KINDS = {
  /** Addressable event: Game lobby room */
  LOBBY: 35303,
  /** Regular event: Player game actions (moves, swings) */
  ACTION: 1159,
  /** Regular event: Game result / win claim */
  RESULT: 7107,
} as const;

/** Minimum bet in satoshis */
export const MIN_BET_SATS = 10;

/** Maximum players per game */
export const MAX_PLAYERS = 8;

/** Action types */
export const ACTION_TYPES = {
  MOVE: 'move',
  SWING: 'swing',
  JOIN: 'join',
  READY: 'ready',
  /**
   * Full player state snapshot (position + mined cells).
   * Replaces per-move events for remote player synchronisation.
   * Published on the same kind (ACTION) with the same #d filter.
   */
  STATE: 'state',
} as const;

/**
 * How often (ms) each client broadcasts its full state to the relay.
 * Even if individual publishes drop, the next broadcast re-syncs everyone.
 */
export const STATE_BROADCAST_INTERVAL = 500;

/** Game balance constants */
export const HARDROCK_PROBABILITY = 0.3;
export const HARDROCK_HEALTH = 3;
export const BITCOIN_DEPTH_RATIO = 0.6;
export const BITCOIN_EDGE_BUFFER = 2;
export const SWING_ANIMATION_FRAMES = 8;
