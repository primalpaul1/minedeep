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

const HOUSE_NSEC = import.meta.env.VITE_HOUSE_NSEC;
if (!HOUSE_NSEC) {
  throw new Error('VITE_HOUSE_NSEC environment variable is not set. Copy .env.example to .env and fill in your house account nsec.');
}

const HOUSE_NWC = import.meta.env.VITE_HOUSE_NWC;
if (!HOUSE_NWC) {
  throw new Error('VITE_HOUSE_NWC environment variable is not set. Copy .env.example to .env and fill in your NWC connection string.');
}

/** Decode the house secret key and derive the public key */
function getHouseKeys() {
  const decoded = nip19.decode(HOUSE_NSEC as `nsec1${string}`);
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
/** Cached provider so we don't reconnect on every payment */
let cachedProvider: InstanceType<typeof weblnSdk.NostrWebLNProvider> | null = null;

async function getHouseProvider(): Promise<InstanceType<typeof weblnSdk.NostrWebLNProvider>> {
  if (cachedProvider) return cachedProvider;

  const provider = new weblnSdk.NostrWebLNProvider({ nostrWalletConnectUrl: HOUSE_NWC });
  await provider.enable();
  cachedProvider = provider;
  return provider;
}

export async function payInvoiceFromHouse(invoice: string): Promise<{ preimage: string }> {
  const MAX_ATTEMPTS = 2;
  const TIMEOUT_MS = 60000; // 60 seconds

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let provider: InstanceType<typeof weblnSdk.NostrWebLNProvider>;
    try {
      provider = await getHouseProvider();
    } catch (err) {
      // Connection failed — reset cache and retry
      cachedProvider = null;
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`House NWC connection failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      console.warn(`[House] NWC connect attempt ${attempt} failed, retrying...`);
      continue;
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('House payment timed out after 60 seconds')), TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([
        provider.sendPayment(invoice),
        timeoutPromise,
      ]) as { preimage: string };

      return result;
    } catch (err) {
      // On failure, reset the cached provider so next attempt reconnects fresh
      cachedProvider?.close?.();
      cachedProvider = null;

      if (attempt === MAX_ATTEMPTS) throw err;
      console.warn(`[House] Payment attempt ${attempt} failed, retrying...`, err);
    }
  }

  throw new Error('House payment failed after all attempts');
}

/** Time limit: if no one joins within this period, entry fees are refunded */
export const REFUND_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
export const REFUND_TIMEOUT_SECS = 60 * 60; // 1 hour in seconds
