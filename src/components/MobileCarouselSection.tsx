import React from 'react';
import { Game } from '../types';
import { MobileGameCard } from './MobileGameCard';
import { ChevronRight } from 'lucide-react';

interface MobileCarouselSectionProps {
  title: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  games: Game[];
  onSeeAll?: () => void;
  seeAllLabel?: string;
}

export const MobileCarouselSection: React.FC<MobileCarouselSectionProps> = ({
  title,
  badge,
  icon,
  games,
  onSeeAll,
  seeAllLabel = 'See All',
}) => {
  if (!games || games.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
            <span>{title}</span>
            {badge}
          </h3>
        </div>

        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 active:text-blue-200 flex items-center gap-0.5 py-1 px-1.5 rounded transition-colors cursor-pointer"
          >
            <span>{seeAllLabel}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Horizontal Scroll Track */}
      <div
        className="flex gap-3 overflow-x-auto overflow-y-hidden -mx-4 sm:-mx-6 px-4 sm:px-6 scroll-smooth [scroll-snap-type:x_proximity] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {games.map((game) => (
          <MobileGameCard key={game.id} game={game} />
        ))}

        {/* Trailing space so the final card doesn't stick to the screen edge when fully scrolled */}
        <div className="shrink-0 w-4 sm:w-6" aria-hidden="true" />
      </div>
    </div>
  );
};
