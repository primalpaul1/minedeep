import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlayerList } from './PlayerList';
import { usePaidPlayers } from './PaymentGate';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUpdateGameStatus, useGameActions } from '@/hooks/useGameLobby';
import type { GameLobbyData } from '@/hooks/useGameLobby';
import { Zap, Play, Users, Loader2, Copy, ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useNavigate } from 'react-router-dom';

interface WaitingRoomProps {
  lobby: GameLobbyData;
  onGameStart: () => void;
}

export function WaitingRoom({ lobby, onGameStart }: WaitingRoomProps) {
  const { user } = useCurrentUser();
  const { updateStatus } = useUpdateGameStatus();
  const { data: actions } = useGameActions(lobby.gameId);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { paidPlayers, totalPaid } = usePaidPlayers(lobby);

  const isHost = user?.pubkey === lobby.hostPubkey;
  const allPaid = lobby.players.length > 0 && lobby.players.every(p => paidPlayers.has(p));
  const paidCount = lobby.players.filter(p => paidPlayers.has(p)).length;

  // Check for new players from join actions
  useEffect(() => {
    if (!actions) return;

    const joiners = new Set<string>();
    actions.forEach(event => {
      try {
        const action = JSON.parse(event.content);
        if (action.type === 'join' && !lobby.players.includes(event.pubkey)) {
          joiners.add(event.pubkey);
        }
      } catch {
        // Skip invalid
      }
    });

    // If host, update lobby with new players
    if (isHost && joiners.size > 0) {
      const updatedPlayers = [...lobby.players, ...Array.from(joiners)];
      updateStatus({
        ...lobby,
        players: updatedPlayers,
      }, 'waiting').catch(console.error);
    }
  }, [actions, isHost, lobby, updateStatus]);

  const handleStartGame = async () => {
    if (!allPaid) {
      toast({
        title: 'Not all players have paid',
        description: 'Wait for all miners to pay their entry fee before starting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateStatus(lobby, 'playing');
      onGameStart();
    } catch (error) {
      toast({
        title: 'Failed to start game',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  // Check if lobby status changed to 'playing' (non-host sees the update)
  useEffect(() => {
    if (lobby.status === 'playing') {
      onGameStart();
    }
  }, [lobby.status, onGameStart]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/game/${lobby.hostPubkey}/${lobby.gameId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Link copied!',
        description: 'Share this link with other players',
      });
    });
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="text-stone-400 hover:text-stone-200 mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span className="text-xs font-mono">Back</span>
        </Button>

        <div className="relative inline-flex items-center justify-center">
          <div className="absolute w-20 h-20 bg-amber-500/10 rounded-full blur-xl animate-pulse" />
          <div className="relative flex items-center gap-2 bg-stone-800/80 border border-stone-700/50 rounded-2xl px-6 py-3">
            <Zap className="w-6 h-6 text-amber-400 fill-current" />
            <span className="text-3xl font-mono font-bold text-amber-400">{totalPaid}</span>
            <span className="text-sm text-stone-400 font-mono">sats in pot</span>
          </div>
        </div>

        <h2 className="text-xl font-mono font-bold text-stone-200 pt-2">
          Waiting for Miners
        </h2>
        <p className="text-sm text-stone-400 font-mono">
          Entry: {lobby.betAmount} sats per player
        </p>
      </div>

      {/* Payment status banner */}
      <div className={`border rounded-xl p-3 flex items-center gap-3 ${
        allPaid
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        {allPaid ? (
          <>
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-mono text-emerald-400 font-bold">
                All players have paid!
              </p>
              <p className="text-[10px] font-mono text-emerald-400/70">
                {isHost ? 'You can now start the game.' : 'Waiting for host to start the game.'}
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-mono text-amber-400 font-bold">
                {paidCount}/{lobby.players.length} miners have paid
              </p>
              <p className="text-[10px] font-mono text-amber-400/70">
                Waiting for all players to pay their entry fee...
              </p>
            </div>
          </>
        )}
      </div>

      {/* Players */}
      <div className="bg-stone-900/50 border border-stone-700/30 rounded-xl p-4">
        <PlayerList
          players={lobby.players}
          hostPubkey={lobby.hostPubkey}
          currentPubkey={user?.pubkey}
          winner={null}
          paidPlayers={paidPlayers}
        />

        <div className="mt-4 flex items-center justify-center gap-2 text-stone-500">
          <Users className="w-4 h-4" />
          <span className="text-xs font-mono">
            {lobby.players.length}/{lobby.maxPlayers} miners
          </span>
        </div>
      </div>

      {/* Waiting animation */}
      <div className="flex items-center justify-center gap-2 py-4">
        <Loader2 className="w-5 h-5 text-amber-400/60 animate-spin" />
        <span className="text-sm text-stone-400 font-mono animate-pulse">
          {allPaid ? 'Ready to start!' : 'Waiting for players to join & pay...'}
        </span>
      </div>

      {/* Share link */}
      <Button
        variant="outline"
        onClick={handleCopyLink}
        className="w-full border-stone-700 bg-stone-800/50 text-stone-300 hover:bg-stone-700/50 font-mono"
      >
        <Copy className="w-4 h-4 mr-2" />
        Copy Invite Link
      </Button>

      {/* Start button (host only) */}
      {isHost && (
        <Button
          onClick={handleStartGame}
          disabled={!allPaid || lobby.players.length < 1}
          className={`w-full font-mono font-bold text-base py-5 transition-all ${
            allPaid
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-stone-700 text-stone-400 cursor-not-allowed'
          }`}
        >
          <Play className="w-5 h-5 mr-2" />
          {allPaid ? 'Start Mining!' : `Waiting for ${lobby.players.length - paidCount} payment(s)...`}
        </Button>
      )}

      {/* Rules */}
      <div className="bg-stone-900/30 border border-stone-800/50 rounded-lg p-4 space-y-2">
        <h3 className="text-xs font-mono text-amber-400/60 uppercase tracking-wider">Rules</h3>
        <ul className="text-xs text-stone-500 space-y-1.5 font-mono">
          <li className="flex items-start gap-2">
            <span className="text-amber-400/60">1.</span>
            Each player pays {lobby.betAmount} sats to enter
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400/60">2.</span>
            Game starts when all players have paid
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400/60">3.</span>
            Use arrows to move, spacebar to mine rocks
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400/60">4.</span>
            First miner to find the hidden Bitcoin wins the whole pot!
          </li>
        </ul>
      </div>
    </div>
  );
}
