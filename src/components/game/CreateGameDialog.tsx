import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, Loader2, AlertCircle } from 'lucide-react';
import { MIN_BET_SATS } from '@/lib/gameConstants';
import { useCreateGame } from '@/hooks/useGameLobby';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useToast } from '@/hooks/useToast';

interface CreateGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGameCreated: (gameId: string, seed: string) => void;
}

export function CreateGameDialog({ open, onOpenChange, onGameCreated }: CreateGameDialogProps) {
  const [betAmount, setBetAmount] = useState(MIN_BET_SATS);
  const [isCreating, setIsCreating] = useState(false);
  const { createGame } = useCreateGame();
  const { user } = useCurrentUser();
  const hostAuthor = useAuthor(user?.pubkey);
  const { toast } = useToast();

  const presets = [10, 21, 50, 100, 500, 1000];

  // Check if the host has a lightning address configured
  const hasLightningAddress = !!(hostAuthor.data?.metadata?.lud06 || hostAuthor.data?.metadata?.lud16);

  const handleCreate = async () => {
    if (betAmount < MIN_BET_SATS) {
      toast({
        title: 'Invalid bet',
        description: `Minimum bet is ${MIN_BET_SATS} sats`,
        variant: 'destructive',
      });
      return;
    }

    if (!hasLightningAddress) {
      toast({
        title: 'Lightning address required',
        description: 'You need a Lightning address on your Nostr profile to host a game. Players will zap their entry fees to your wallet.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { gameId, seed } = await createGame(betAmount);
      onOpenChange(false);
      onGameCreated(gameId, seed);
    } catch (error) {
      toast({
        title: 'Failed to create game',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-stone-900 border-stone-700 text-stone-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-amber-400 flex items-center gap-2">
            <Zap className="w-5 h-5 fill-current" />
            Create New Game
          </DialogTitle>
          <DialogDescription className="text-stone-400">
            Set the entry fee for your mining game. All players pay via Lightning before the game starts. Winner takes all!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-stone-300 font-mono text-sm">
              Entry Fee (sats)
            </Label>
            <Input
              type="number"
              min={MIN_BET_SATS}
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(MIN_BET_SATS, parseInt(e.target.value) || MIN_BET_SATS))}
              className="bg-stone-800 border-stone-600 text-amber-400 font-mono text-lg text-center"
            />

            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setBetAmount(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    betAmount === preset
                      ? 'bg-amber-600 text-black font-bold'
                      : 'bg-stone-800 text-stone-400 hover:bg-stone-700 border border-stone-600/50'
                  }`}
                >
                  ⚡ {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Lightning address warning */}
          {!hasLightningAddress && user && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400 font-mono font-bold">Lightning address required</p>
                <p className="text-[10px] text-red-400/70 font-mono mt-1">
                  As the host, players will zap their entry fees to your Lightning address. 
                  Add a Lightning address (lud16) to your Nostr profile first.
                </p>
              </div>
            </div>
          )}

          <div className="bg-stone-800/50 border border-stone-700/50 rounded-lg p-3 space-y-2">
            <p className="text-xs text-stone-400 font-mono">
              ⚡ <span className="text-amber-400/80">How it works:</span> Each player pays{' '}
              <span className="text-amber-400">{betAmount} sats</span> via Lightning before the game starts. 
              The game host can start when all players have paid. The winner who finds the hidden Bitcoin first wins the entire pot!
            </p>
            <p className="text-[10px] text-stone-500 font-mono">
              💡 As the host, entry fees are zapped to your Lightning wallet. You&apos;ll also pay your own entry fee.
            </p>
          </div>

          <Button
            onClick={handleCreate}
            disabled={isCreating || !hasLightningAddress}
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-mono font-bold text-base py-5 disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2 fill-current" />
                Create Game — {betAmount} sats entry
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
