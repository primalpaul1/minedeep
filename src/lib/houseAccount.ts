/**
 * House Account for SatMiner
 * 
 * This is the escrow-style account that holds all entry fees.
 * - Players zap their entry fees to this account's Lightning address.
 * - When a winner is determined, the house pays out the pot to the winner.
 * - If no one joins within 1 hour, entry fees are refunded.
 * 
 * The nsec is embedded in the client. In a production environment, 
 * payout logic would live on a server. For this game, the winning 
 * player's browser triggers the payout using the house signer.
 */

import { nip19, getPublicKey } from 'nostr-tools';
import { NSecSigner } from '@nostrify/nostrify';

const HOUSE_NSEC = 'nsec12uf5hr3c0mrzcjtxpy56hmt2rzkpsalx3sjnhmh70rjvagltdamq5wzwy6';

/** Decode the house secret key and derive the public key */
function getHouseKeys() {
  const decoded = nip19.decode(HOUSE_NSEC);
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid house nsec');
  }
  const secretKey = decoded.data;
  const pubkey = getPublicKey(secretKey);
  return { secretKey, pubkey };
}

const { secretKey: HOUSE_SECRET_KEY, pubkey: HOUSE_PUBKEY } = getHouseKeys();

/** The house account's hex pubkey */
export const HOUSE_PUBKEY_HEX = HOUSE_PUBKEY;

/** The house account's npub */
export const HOUSE_NPUB = nip19.npubEncode(HOUSE_PUBKEY);

/** Create a signer for the house account (for signing zap requests / payouts) */
export function getHouseSigner(): NSecSigner {
  return new NSecSigner(HOUSE_SECRET_KEY);
}

/** Time limit: if no one joins within this period, entry fees are refunded */
export const REFUND_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
export const REFUND_TIMEOUT_SECS = 60 * 60; // 1 hour in seconds
