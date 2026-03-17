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
import { Zap, Loader2, ShieldCheck } from 'lucide-react';
import { MIN_BET_SATS } from '@/lib/gameConstants';
import { useCreateGame } from '@/hooks/useGameLobby';
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
  const { toast } = useToast();

  const presets = [10, 21, 50, 100, 500, 1000];

  const handleCreate = async () => {
    if (betAmount < MIN_BET_SATS) {
      toast({
        title: 'Invalid bet',
        description: `Minimum bet is ${MIN_BET_SATS} sats`,
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

          {/* Escrow info */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs text-emerald-400/90 font-mono font-bold">Funds held in escrow</p>
              <p className="text-[10px] text-emerald-400/60 font-mono">
                All entry fees are held by the SatMiner house account. The winner is paid out automatically. If no one joins within 1 hour, everyone gets refunded.
              </p>
            </div>
          </div>

          <div className="bg-stone-800/50 border border-stone-700/50 rounded-lg p-3">
            <p className="text-xs text-stone-400 font-mono">
              ⚡ Each player pays{' '}
              <span className="text-amber-400">{betAmount} sats</span> to enter.
              First miner to find the hidden Bitcoin wins the entire pot!
            </p>
          </div>

          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-mono font-bold text-base py-5"
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
