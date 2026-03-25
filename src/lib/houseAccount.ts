/**
 * House Account for SatMiner
 *
 * The house wallet credentials (nsec + NWC) are stored server-side in a
 * Cloudflare Worker. This module only knows the public key (safe to expose)
 * and the worker's API URL. All payments happen server-side.
 */

import { nip19 } from 'nostr-tools';

// --- Public constants (safe to ship to the browser) ---

const HOUSE_PUBKEY = import.meta.env.VITE_HOUSE_PUBKEY as string | undefined;
if (!HOUSE_PUBKEY) {
  throw new Error(
    'VITE_HOUSE_PUBKEY is not set. Add the house account hex pubkey to your .env file.',
  );
}

const PAYOUT_API_URL = import.meta.env.VITE_PAYOUT_API_URL as string | undefined;
if (!PAYOUT_API_URL) {
  throw new Error(
    'VITE_PAYOUT_API_URL is not set. Add your Cloudflare Worker URL to your .env file.',
  );
}

/** The house account's hex pubkey (public, safe to expose). */
export const HOUSE_PUBKEY_HEX: string = HOUSE_PUBKEY;

/** The house account's npub. */
export const HOUSE_NPUB: string = nip19.npubEncode(HOUSE_PUBKEY);

/** Time limit: if no one joins within this period, entry fees are refunded. */
export const REFUND_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
export const REFUND_TIMEOUT_SECS = 60 * 60;

// --- Server-side payout API ---

export interface PayoutResult {
  success: boolean;
  preimage?: string;
  totalPot?: number;
  message?: string;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  results: { pubkey: string; success: boolean; error?: string }[];
  message?: string;
  error?: string;
}

/** Ask the payout worker to send the winner their sats. */
export async function requestPayout(
  gameId: string,
  hostPubkey: string,
  winnerPubkey: string,
  relays: string[],
): Promise<PayoutResult> {
  const res = await fetch(`${PAYOUT_API_URL}/payout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, hostPubkey, winnerPubkey, relays }),
  });
  return res.json() as Promise<PayoutResult>;
}

/** Ask the payout worker to refund players from an expired game. */
export async function requestRefund(
  gameId: string,
  hostPubkey: string,
  betAmount: number,
  refundPubkeys: string[],
  relays: string[],
): Promise<RefundResult> {
  const res = await fetch(`${PAYOUT_API_URL}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, hostPubkey, betAmount, refundPubkeys, relays }),
  });
  return res.json() as Promise<RefundResult>;
}
