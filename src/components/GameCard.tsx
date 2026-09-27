import React from 'react';
import { Game } from '../types';
import { useStore } from '../context/StoreContext';
import { Gamepad, ArrowRight, Star } from 'lucide-react';

interface GameCardProps {
  game: Game;
}

export const GameCard: React.FC<GameCardProps> = ({ game }) => {
  const { openGameDetail, formatUSD, formatGHS, convertToGHS } = useStore();

  // Find lowest price among available account options
  const prices = Object.values(game.accountPrices).filter((p): p is number => typeof p === 'number' && p > 0);
  const lowestPriceUSD = prices.length > 0 ? Math.min(...prices) : 10.0;
  const lowestPriceGHS = convertToGHS(lowestPriceUSD);

  return (
    <div className="group bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 transform hover:-translate-y-1">
      {/* Cover Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
        <img
          src={game.coverImage}
          alt={game.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            // fallback image if broken link
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

        {/* Featured Tag */}
        {game.isFeatured && (
          <div className="absolute top-3 left-3 bg-amber-500/90 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
            <Star className="w-3 h-3 fill-slate-950" /> Featured
          </div>
        )}

        {/* Console Badges */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {game.ps5Available && (
            <span className="bg-blue-600/90 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-md">
              PS5
            </span>
          )}
          {game.ps4Available && (
            <span className="bg-indigo-700/90 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-md">
              PS4
            </span>
          )}
        </div>

        {/* Genre Tag */}
        <div className="absolute bottom-2 left-3">
          <span className="text-[11px] font-medium text-slate-300 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
            {game.genre}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
            {game.title}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
            {game.description}
          </p>
        </div>

        {/* Pricing Breakdown & Action */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              From
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-white">
                {formatUSD(lowestPriceUSD)}
              </span>
              <span className="text-xs font-semibold text-emerald-400 font-mono">
                ({formatGHS(lowestPriceGHS)})
              </span>
            </div>
          </div>

          <button
            onClick={() => openGameDetail(game)}
            className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/40 hover:border-blue-600 font-semibold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span>Options</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
