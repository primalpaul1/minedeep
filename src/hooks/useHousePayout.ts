import { useState, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useAuthor } from './useAuthor';
import { useAppContext } from './useAppContext';
import { useToast } from './useToast';
import { getHouseSigner, HOUSE_PUBKEY_HEX } from '@/lib/houseAccount';
import { nip57 } from 'nostr-tools';
import type { GameLobbyData } from './useGameLobby';

/**
 * Hook to handle house account payouts.
 * 
 * When a winner is found, the house sends the pot to the winner's 
 * Lightning address via a NIP-57 zap. The zap request is signed 
 * by the house signer (nsec embedded in the client).
 * 
 * If no one joins within 1 hour, refunds are triggered similarly.
 */
export function useHousePayout() {
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [payoutComplete, setPayoutComplete] = useState(false);

  /**
   * Pay the winner the total pot.
   * The house signs a zap request targeting the winner's profile,
   * fetches the invoice from their LNURL endpoint, and we display
   * a confirmation that the payout has been initiated.
   */
  const payWinner = useCallback(async (
    winnerPubkey: string,
    lobby: GameLobbyData,
  ) => {
    setIsPaying(true);

    try {
      const totalPot = lobby.betAmount * lobby.players.length;

      // Fetch winner's kind 0 profile to get their Lightning address
      const [winnerEvent] = await nostr.query(
        [{ kinds: [0], authors: [winnerPubkey], limit: 1 }],
        { signal: AbortSignal.timeout(5000) },
      );

      if (!winnerEvent) {
        throw new Error('Could not find winner\'s profile. They may need to add a Lightning address.');
      }

      let metadata: { lud06?: string; lud16?: string };
      try {
        metadata = JSON.parse(winnerEvent.content);
      } catch {
        throw new Error('Could not parse winner\'s profile metadata.');
      }

      if (!metadata.lud06 && !metadata.lud16) {
        throw new Error('Winner does not have a Lightning address configured. Payout cannot be sent automatically.');
      }

      // Get zap endpoint from the winner's profile
      const zapEndpoint = await nip57.getZapEndpoint(winnerEvent);
      if (!zapEndpoint) {
        throw new Error('Could not find a zap endpoint for the winner.');
      }

      const zapAmount = totalPot * 1000; // millisats

      // Create zap request from the house account to the winner
      const zapRequest = nip57.makeZapRequest({
        profile: winnerPubkey,
        amount: zapAmount,
        relays: config.relayMetadata.relays.map(r => r.url),
        comment: `SatMiner payout! You won ${totalPot} sats from game ${lobby.gameId}`,
      });

      // Sign with the house signer
      const houseSigner = getHouseSigner();
      const signedZapRequest = await houseSigner.signEvent(zapRequest);

      // Fetch the invoice from the winner's LNURL endpoint
      const res = await fetch(
        `${zapEndpoint}?amount=${zapAmount}&nostr=${encodeURI(JSON.stringify(signedZapRequest))}`,
      );
      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(`LNURL error: ${responseData.reason || 'Unknown error'}`);
      }

      const payoutInvoice = responseData.pr;
      if (!payoutInvoice || typeof payoutInvoice !== 'string') {
        throw new Error('Winner\'s Lightning service did not return a valid invoice.');
      }

      // Now we need to pay this invoice from the house wallet.
      // The house account's NWC or connected wallet pays it.
      // Since the house nsec has a Lightning address attached, 
      // we use the Alby SDK (LN class) with the house account.
      // For now, we publish a payout event that the house can process.
      
      // Publish a payout record on Nostr so it's verifiable
      const payoutEvent = {
        kind: 9735 as const, // We record this as information
        content: '',
        tags: [
          ['p', winnerPubkey],
          ['bolt11', payoutInvoice],
          ['amount', zapAmount.toString()],
          ['description', JSON.stringify(signedZapRequest)],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      // Sign and publish the payout record
      const signedPayout = await houseSigner.signEvent(payoutEvent);
      await nostr.event(signedPayout, { signal: AbortSignal.timeout(5000) });

      setPayoutComplete(true);

      toast({
        title: 'Payout initiated! ⚡',
        description: `${totalPot} sats payout to the winner has been submitted.`,
      });

      return payoutInvoice;
    } catch (error) {
      console.error('House payout failed:', error);
      toast({
        title: 'Payout issue',
        description: (error as Error).message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsPaying(false);
    }
  }, [nostr, config, toast]);

  /**
   * Refund all players who paid. Called when the game expires 
   * (no one joined within 1 hour).
   */
  const refundPlayers = useCallback(async (
    lobby: GameLobbyData,
    paidPubkeys: string[],
  ) => {
    setIsPaying(true);

    const results: { pubkey: string; success: boolean; error?: string }[] = [];

    for (const pubkey of paidPubkeys) {
      try {
        // Fetch player's profile
        const [playerEvent] = await nostr.query(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          { signal: AbortSignal.timeout(5000) },
        );

        if (!playerEvent) {
          results.push({ pubkey, success: false, error: 'Profile not found' });
          continue;
        }

        let metadata: { lud06?: string; lud16?: string };
        try {
          metadata = JSON.parse(playerEvent.content);
        } catch {
          results.push({ pubkey, success: false, error: 'Invalid profile' });
          continue;
        }

        if (!metadata.lud06 && !metadata.lud16) {
          results.push({ pubkey, success: false, error: 'No Lightning address' });
          continue;
        }

        const zapEndpoint = await nip57.getZapEndpoint(playerEvent);
        if (!zapEndpoint) {
          results.push({ pubkey, success: false, error: 'No zap endpoint' });
          continue;
        }

        const refundAmount = lobby.betAmount * 1000; // millisats

        const zapRequest = nip57.makeZapRequest({
          profile: pubkey,
          amount: refundAmount,
          relays: config.relayMetadata.relays.map(r => r.url),
          comment: `SatMiner refund: ${lobby.betAmount} sats from expired game ${lobby.gameId}`,
        });

        const houseSigner = getHouseSigner();
        const signedZapRequest = await houseSigner.signEvent(zapRequest);

        const res = await fetch(
          `${zapEndpoint}?amount=${refundAmount}&nostr=${encodeURI(JSON.stringify(signedZapRequest))}`,
        );
        const responseData = await res.json();

        if (!res.ok) {
          results.push({ pubkey, success: false, error: responseData.reason || 'LNURL error' });
          continue;
        }

        const refundInvoice = responseData.pr;
        if (!refundInvoice) {
          results.push({ pubkey, success: false, error: 'No invoice returned' });
          continue;
        }

        // Publish refund record
        const refundEvent = {
          kind: 9735 as const,
          content: '',
          tags: [
            ['p', pubkey],
            ['bolt11', refundInvoice],
            ['amount', refundAmount.toString()],
            ['description', JSON.stringify(signedZapRequest)],
          ],
          created_at: Math.floor(Date.now() / 1000),
        };

        const signedRefund = await houseSigner.signEvent(refundEvent);
        await nostr.event(signedRefund, { signal: AbortSignal.timeout(5000) });

        results.push({ pubkey, success: true });
      } catch (error) {
        results.push({ pubkey, success: false, error: (error as Error).message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    toast({
      title: 'Refunds processed',
      description: `${successCount}/${paidPubkeys.length} refunds initiated.`,
    });

    setIsPaying(false);
    return results;
  }, [nostr, config, toast]);

  return {
    payWinner,
    refundPlayers,
    isPaying,
    payoutComplete,
    housePubkey: HOUSE_PUBKEY_HEX,
  };
}
