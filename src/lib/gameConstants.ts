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
