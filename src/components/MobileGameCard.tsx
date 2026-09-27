import React, { useRef } from 'react';
import { Game } from '../types';
import { useStore } from '../context/StoreContext';
import { Star } from 'lucide-react';

interface MobileGameCardProps {
  game: Game;
}

export const MobileGameCard: React.FC<MobileGameCardProps> = ({ game }) => {
  const { openGameDetail, formatUSD, formatGHS, convertToGHS } = useStore();
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = useRef(false);

  // Compute lowest price across available account types
  const prices = Object.values(game.accountPrices).filter(
    (p): p is number => typeof p === 'number' && p > 0
  );
  const lowestPriceUSD = prices.length > 0 ? Math.min(...prices) : 10.0;
  const lowestPriceGHS = convertToGHS(lowestPriceUSD);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // If moved more than 7px in any direction, treat as swipe/scroll gesture
    if (deltaX > 7 || deltaY > 7) {
      isSwipingRef.current = true;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Prevent click trigger if the user was swiping horizontally or scrolling vertically
    if (isSwipingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    openGameDetail(game);
  };

  const isPs5 = Boolean(game.ps5Available || (game as any).supportedConsoles?.includes('PS5'));
  const isPs4 = Boolean(game.ps4Available || (game as any).supportedConsoles?.includes('PS4'));

  return (
    <article
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      className="group w-[54vw] min-w-[170px] max-w-[230px] shrink-0 [scroll-snap-align:start] cursor-pointer select-none flex flex-col transition-transform active:scale-[0.98]"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Cover Image Container (PlayStation portrait aspect ratio 3:4) */}
      <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-md group-hover:border-blue-500/50 group-active:border-blue-500/60 transition-colors">
        <img
          src={game.coverImage}
          alt={game.title}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80';
          }}
        />

        {/* Subtle shadow gradient at bottom and top */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 pointer-events-none" />

        {/* Featured Badge */}
        {game.isFeatured && (
          <div className="absolute top-2.5 left-2.5 bg-amber-500/90 text-slate-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md backdrop-blur-sm">
            <Star className="w-2.5 h-2.5 fill-slate-950" />
            <span>Featured</span>
          </div>
        )}

        {/* Floating Console Availability in Top-Right */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          {isPs5 && (
            <span className="bg-blue-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
              PS5
            </span>
          )}
          {isPs4 && (
            <span className="bg-indigo-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
              PS4
            </span>
          )}
        </div>

        {/* Genre Pill in Bottom-Left */}
        {game.genre && (
          <div className="absolute bottom-2 left-2 pointer-events-none">
            <span className="text-[10px] font-medium text-slate-300 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
              {game.genre}
            </span>
          </div>
        )}
      </div>

      {/* Card Info Below Cover */}
      <div className="mt-2.5 px-0.5 space-y-0.5 flex-1 flex flex-col justify-between">
        <div>
          <h4 className="text-sm font-bold text-white group-hover:text-blue-400 group-active:text-blue-400 transition-colors line-clamp-1 leading-snug">
            {game.title}
          </h4>

          {/* Clean metadata line */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium pt-0.5">
            {isPs5 && <span className="text-blue-400 font-bold">PS5</span>}
            {isPs5 && isPs4 && <span className="text-slate-600">·</span>}
            {isPs4 && <span className="text-indigo-400 font-bold">PS4</span>}
            {game.genre && (
              <>
                <span className="text-slate-600">·</span>
                <span className="truncate text-slate-400">{game.genre}</span>
              </>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div className="pt-1 flex items-baseline gap-1.5">
          <span className="text-[11px] text-slate-400 font-normal">From</span>
          <span className="text-sm font-black text-white tracking-tight">
            {formatUSD(lowestPriceUSD)}
          </span>
          <span className="text-[11px] font-bold text-emerald-400 font-mono">
            ({formatGHS(lowestPriceGHS)})
          </span>
        </div>
      </div>
    </article>
  );
};
