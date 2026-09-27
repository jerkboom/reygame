import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { GameCard } from './GameCard';
import { MobileCarouselSection } from './MobileCarouselSection';
import { Filter, Layers, Gamepad2, Sparkles, Compass, Search, X } from 'lucide-react';

export const GameCatalog: React.FC = () => {
  const {
    games,
    searchQuery,
    selectedGenre,
    setSelectedGenre,
    selectedConsoleFilter,
    setSelectedConsoleFilter,
    setSearchQuery,
  } = useStore();

  // Extract unique genres from games list
  const genres = useMemo(() => {
    const list = new Set<string>();
    games.forEach((g) => {
      if (g.genre) list.add(g.genre);
    });
    return ['ALL', ...Array.from(list)];
  }, [games]);

  const isFilterActive =
    selectedConsoleFilter !== 'ALL' ||
    selectedGenre !== 'ALL' ||
    Boolean(searchQuery.trim());

  // Curated database-driven collections for mobile horizontal carousels
  const featuredGames = useMemo(() => {
    return games.filter((g) => g.isActive && !g.isArchived && g.isFeatured);
  }, [games]);

  const ps5Games = useMemo(() => {
    return games.filter((g) => g.isActive && !g.isArchived && g.ps5Available);
  }, [games]);

  const ps4Games = useMemo(() => {
    return games.filter((g) => g.isActive && !g.isArchived && g.ps4Available);
  }, [games]);

  const allActiveGames = useMemo(() => {
    return games.filter((g) => g.isActive && !g.isArchived);
  }, [games]);

  // Filtered games combining search query, console filter, and genre filter
  const filteredGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matches = games.filter((game) => {
      // Must be active and not archived
      if (!game.isActive || game.isArchived) return false;

      // Console filter
      if (selectedConsoleFilter === 'PS5' && !game.ps5Available) return false;
      if (selectedConsoleFilter === 'PS4' && !game.ps4Available) return false;

      // Genre filter
      if (selectedGenre !== 'ALL' && game.genre !== selectedGenre) return false;

      // Search query across relevant public game catalog fields
      if (query) {
        const matchTitle = game.title.toLowerCase().includes(query);
        const matchGenre = game.genre?.toLowerCase().includes(query);
        const matchConsole =
          (query.includes('ps5') && game.ps5Available) ||
          (query.includes('ps4') && game.ps4Available) ||
          (query.includes('playstation') && (game.ps5Available || game.ps4Available));

        if (!matchTitle && !matchGenre && !matchConsole) return false;
      }

      return true;
    });

    // Prioritize title matches when search query is active
    if (query) {
      return [...matches].sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(query) ? 1 : 0;
        const bTitle = b.title.toLowerCase().includes(query) ? 1 : 0;
        return bTitle - aTitle;
      });
    }

    return matches;
  }, [games, selectedConsoleFilter, selectedGenre, searchQuery]);

  return (
    <section id="games" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">
            <Gamepad2 className="w-4 h-4" />
            <span>Digital Game Library</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Browse Available PlayStation Games
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Choose your game, select PS4 or PS5, pick your account type, and pay in GHS via Paystack.
          </p>
        </div>

        {/* Counter Badge */}
        <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg self-start md:self-auto flex items-center gap-1.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Showing <strong className="text-white">{filteredGames.length}</strong> of{' '}
            {games.filter((g) => g.isActive && !g.isArchived).length} games
          </span>
        </div>
      </div>

      {/* Mobile Search Field (Positioned directly between badge and filter panel on mobile) */}
      <div className="block md:hidden mb-4">
        <form onSubmit={(e) => e.preventDefault()} className="relative w-full" role="search">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search games..."
            aria-label="Search games..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
              aria-label="Clear search query"
            >
              <X className="w-4 h-4 bg-slate-800 hover:bg-slate-700 rounded-full p-0.5" />
            </button>
          )}
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl mb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Console Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setSelectedConsoleFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedConsoleFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Consoles
            </button>
            <button
              onClick={() => setSelectedConsoleFilter('PS5')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedConsoleFilter === 'PS5'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PS5 Only
            </button>
            <button
              onClick={() => setSelectedConsoleFilter('PS4')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedConsoleFilter === 'PS4'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PS4 Only
            </button>
          </div>

          {/* Active Filter Clear if applied */}
          {(selectedConsoleFilter !== 'ALL' || selectedGenre !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedConsoleFilter('ALL');
                setSelectedGenre('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Genre Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Genre:
          </span>
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors shrink-0 font-medium ${
                selectedGenre === g
                  ? 'bg-white text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
              }`}
            >
              {g === 'ALL' ? 'All Genres' : g}
            </button>
          ))}
        </div>
      </div>

      {/* Games Catalog Rendering */}
      {games.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Gamepad2 className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No games available at the moment.</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            The store catalog is currently empty. Games configured in the Admin Portal will appear here automatically.
          </p>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No games found</h3>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            {searchQuery.trim() ? (
              <>
                We couldn&apos;t find a game matching &ldquo;<span className="text-white font-semibold">{searchQuery.trim()}</span>&rdquo;
                {(selectedConsoleFilter !== 'ALL' || selectedGenre !== 'ALL') && (
                  <span className="block mt-1 text-slate-500">
                    with the current {selectedConsoleFilter !== 'ALL' ? selectedConsoleFilter : ''} {selectedGenre !== 'ALL' ? selectedGenre : ''} filters.
                  </span>
                )}
              </>
            ) : (
              'Try adjusting your console and genre filters.'
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Clear Search
              </button>
            )}
            {(selectedConsoleFilter !== 'ALL' || selectedGenre !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedConsoleFilter('ALL');
                  setSelectedGenre('ALL');
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Clear Filters
              </button>
            )}
            {searchQuery.trim() && (selectedConsoleFilter !== 'ALL' || selectedGenre !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedConsoleFilter('ALL');
                  setSelectedGenre('ALL');
                }}
                className="text-slate-400 hover:text-white text-xs underline px-2 py-1 cursor-pointer"
              >
                Reset All
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 1. MOBILE EXPERIENCE (< md): Horizontal Swipe Carousels Inspired by Airbnb */}
          <div className="block md:hidden space-y-8">
            {isFilterActive ? (
              // When user is actively filtering or searching on mobile
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400 font-medium">
                    Showing <strong className="text-white">{filteredGames.length}</strong> matching {filteredGames.length === 1 ? 'game' : 'games'}
                  </div>
                  <div className="flex items-center gap-2">
                    {searchQuery.trim() && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
                      >
                        Clear Search
                      </button>
                    )}
                    {(selectedConsoleFilter !== 'ALL' || selectedGenre !== 'ALL') && (
                      <button
                        onClick={() => {
                          setSelectedConsoleFilter('ALL');
                          setSelectedGenre('ALL');
                        }}
                        className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>
                <MobileCarouselSection
                  title={searchQuery.trim() ? 'Search Results' : selectedConsoleFilter !== 'ALL' ? `${selectedConsoleFilter} Games` : `${selectedGenre} Games`}
                  icon={searchQuery.trim() ? <Search className="w-4 h-4 text-blue-400" /> : undefined}
                  games={filteredGames}
                />
              </div>
            ) : (
              // Default browsing view on mobile: Curated Horizontal Swipe Rows
              <>
                {/* Featured Games Row */}
                {featuredGames.length > 0 && (
                  <MobileCarouselSection
                    title="Featured Games"
                    icon={<Sparkles className="w-4 h-4 text-amber-400" />}
                    games={featuredGames}
                    seeAllLabel="View All"
                    onSeeAll={() => {
                      const el = document.getElementById('all-mobile-games');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                )}

                {/* PS5 Games Row */}
                {ps5Games.length > 0 && (
                  <MobileCarouselSection
                    title="PS5 Games"
                    badge={
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-600/90 text-white font-mono">
                        PS5
                      </span>
                    }
                    games={ps5Games}
                    onSeeAll={() => setSelectedConsoleFilter('PS5')}
                  />
                )}

                {/* PS4 Games Row */}
                {ps4Games.length > 0 && (
                  <MobileCarouselSection
                    title="PS4 Games"
                    badge={
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-600/90 text-white font-mono">
                        PS4
                      </span>
                    }
                    games={ps4Games}
                    onSeeAll={() => setSelectedConsoleFilter('PS4')}
                  />
                )}

                {/* All Available Titles Row */}
                <div id="all-mobile-games">
                  <MobileCarouselSection
                    title="All Available Games"
                    icon={<Compass className="w-4 h-4 text-blue-400" />}
                    games={allActiveGames}
                  />
                </div>
              </>
            )}
          </div>

          {/* 2. DESKTOP EXPERIENCE (>= md): Existing Multi-Column Grid */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </>
      )}
    </section>
  );
};
