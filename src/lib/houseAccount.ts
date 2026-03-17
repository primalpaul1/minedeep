/**
 * House Account for SatMiner
 * 
 * This is the escrow-style account that holds all entry fees.
 * - Players zap their entry fees to this account's Lightning address.
 * - When a winner is determined, the house pays out the pot to the winner via NWC.
 * - If no one joins within 1 hour, entry fees are refunded via NWC.
 * 
 * The nsec is used to sign zap requests (Nostr identity).
 * The NWC connection string is used to actually pay Lightning invoices.
 */

import { nip19, getPublicKey } from 'nostr-tools';
import { NSecSigner } from '@nostrify/nostrify';
import { webln as weblnSdk } from '@getalby/sdk';

const HOUSE_NSEC = 'nsec12uf5hr3c0mrzcjtxpy56hmt2rzkpsalx3sjnhmh70rjvagltdamq5wzwy6';

const HOUSE_NWC = 'nostr+walletconnect://abeae6cfe41e808f4bcf09709a66f781d9ed72973e7c726192f5cb02086a67cd?relay=wss://relay.primal.net&secret=bb3220762bc1b9f6e1834e55577ddd2008342efd7279fbf857bb71048b71214d&lud16=quietwalrus11@primal.net';

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

/** Pay a Lightning invoice from the house wallet via NWC directly.
 *  Uses NWCWebLNProvider instead of the LN convenience class so that
 *  we bypass any browser-wallet (WebLN) lookup — the house wallet is
 *  always NWC-only and never needs window.webln.
 */
export async function payInvoiceFromHouse(invoice: string): Promise<{ preimage: string }> {
  const provider = new weblnSdk.NWCWebLNProvider({ nostrWalletConnectUrl: HOUSE_NWC });

  try {
    await provider.enable();
  } catch (err) {
    throw new Error(`House NWC connection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Race against a 30-second timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('House payment timed out after 30 seconds')), 30000);
  });

  try {
    const result = await Promise.race([
      provider.sendPayment(invoice),
      timeoutPromise,
    ]) as { preimage: string };

    return result;
  } finally {
    provider.close?.();
  }
}

/** Time limit: if no one joins within this period, entry fees are refunded */
export const REFUND_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
export const REFUND_TIMEOUT_SECS = 60 * 60; // 1 hour in seconds
