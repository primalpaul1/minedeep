import { useState, useCallback } from 'react';
import { useAppContext } from './useAppContext';
import { useToast } from './useToast';
import { HOUSE_PUBKEY_HEX, requestPayout, requestRefund } from '@/lib/houseAccount';
import type { GameLobbyData } from './useGameLobby';

/**
 * Hook to handle house account payouts via the payout worker.
 *
 * All wallet credentials and payment logic live server-side in the Cloudflare
 * Worker. This hook just calls the API and updates UI state.
 */

// Track which game IDs have already been paid out or refunded to prevent duplicates
const payoutFiredForGame = new Set<string>();
const refundFiredForGame = new Set<string>();

export function useHousePayout() {
  const { config } = useAppContext();
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [payoutComplete, setPayoutComplete] = useState(false);

  const relayUrls = config.relayMetadata.relays.map((r) => r.url);

  /**
   * Pay the winner the total pot via the payout worker.
   */
  const payWinner = useCallback(
    async (winnerPubkey: string, lobby: GameLobbyData) => {
      // Idempotency guard
      if (payoutFiredForGame.has(lobby.gameId)) {
        console.log(`[House] Payout already fired for game ${lobby.gameId}, skipping`);
        return null;
      }
      payoutFiredForGame.add(lobby.gameId);

      setIsPaying(true);

      try {
        console.log(`[House] Requesting payout for game ${lobby.gameId}...`);
        const result = await requestPayout(
          lobby.gameId,
          lobby.hostPubkey,
          winnerPubkey,
          relayUrls,
        );

        if (!result.success) {
          throw new Error(result.error || 'Payout failed');
        }

        console.log(`[House] Payout successful! Preimage: ${result.preimage}`);
        setPayoutComplete(true);

        toast({
          title: 'Payout sent!',
          description: `${result.totalPot || lobby.betAmount * lobby.players.length} sats have been sent to the winner's Lightning wallet.`,
        });

        return result.preimage || null;
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
    },
    [relayUrls, toast],
  );

  /**
   * Refund all players who paid. Called when the game expires.
   */
  const refundPlayers = useCallback(
    async (lobby: GameLobbyData, paidPubkeys: string[]) => {
      // Idempotency guard
      if (refundFiredForGame.has(lobby.gameId)) {
        console.log(`[House] Refund already fired for game ${lobby.gameId}, skipping`);
        return [];
      }
      refundFiredForGame.add(lobby.gameId);

      setIsPaying(true);

      try {
        console.log(`[House] Requesting refund for game ${lobby.gameId}...`);
        const result = await requestRefund(
          lobby.gameId,
          lobby.hostPubkey,
          lobby.betAmount,
          paidPubkeys,
          relayUrls,
        );

        const successCount = result.results?.filter((r) => r.success).length ?? 0;

        toast({
          title: successCount > 0 ? 'Refunds sent!' : 'Refund issues',
          description: `${successCount}/${paidPubkeys.length} refunds paid successfully.`,
          variant: successCount > 0 ? undefined : 'destructive',
        });

        return result.results || [];
      } catch (error) {
        console.error('House refund failed:', error);
        toast({
          title: 'Refund issue',
          description: (error as Error).message,
          variant: 'destructive',
        });
        return [];
      } finally {
        setIsPaying(false);
      }
    },
    [relayUrls, toast],
  );

  return {
    payWinner,
    refundPlayers,
    isPaying,
    payoutComplete,
    housePubkey: HOUSE_PUBKEY_HEX,
  };
}
