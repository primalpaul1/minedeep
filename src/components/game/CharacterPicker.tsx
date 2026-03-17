import { CHARACTERS, type CharacterDef } from '@/lib/gameConstants';
import { cn } from '@/lib/utils';

interface CharacterPickerProps {
  selected: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function CharacterPicker({ selected, onSelect, className }: CharacterPickerProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-xs font-mono text-stone-500 uppercase tracking-wider text-center">
        Choose Your Miner
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {CHARACTERS.map((char: CharacterDef) => (
          <button
            key={char.id}
            type="button"
            onClick={() => onSelect(char.id)}
            className={cn(
              'flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all hover:scale-105',
              selected === char.id
                ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                : 'border-stone-700/50 bg-stone-800/50 hover:border-stone-600',
            )}
          >
            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-stone-700/50">
              <img
                src={char.image}
                alt={char.label}
                className="w-full h-full object-cover"
                loading="eager"
              />
              {selected === char.id && (
                <div className="absolute inset-0 ring-2 ring-amber-400 ring-inset rounded-lg" />
              )}
            </div>
            <span className={cn(
              'text-[10px] font-mono leading-tight text-center',
              selected === char.id ? 'text-amber-400 font-bold' : 'text-stone-400',
            )}>
              {char.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
