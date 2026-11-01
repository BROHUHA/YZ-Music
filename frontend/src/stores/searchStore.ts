import { create } from 'zustand';
import { SearchFilterType, SearchResult } from '../types';
import { innertubeService } from '../services/innertube';

const RECENT_SEARCHES_KEY = 'yz_music_recent_searches';

function loadSavedHistory(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

interface SearchState {
  query: string;
  filter: SearchFilterType;
  results: SearchResult[] | null;
  suggestions: string[];
  typeaheadResults: SearchResult[];
  showDropdown: boolean;
  selectedIndex: number;
  loading: boolean;
  history: string[];

  setQuery: (query: string) => void;
  setFilter: (filter: SearchFilterType) => void;
  setShowDropdown: (show: boolean) => void;
  setSelectedIndex: (idx: number | ((prev: number) => number)) => void;
  clearSearch: () => void;
  performSearch: (searchTerm: string, activeFilter?: SearchFilterType) => Promise<void>;
  updateSuggestions: (input: string) => Promise<void>;
  removeHistoryItem: (term: string) => void;
  clearHistory: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  filter: 'ALL',
  results: null,
  suggestions: [],
  typeaheadResults: [],
  showDropdown: false,
  selectedIndex: -1,
  loading: false,
  history: loadSavedHistory(),

  setQuery: (query: string) => {
    set({ query });
    get().updateSuggestions(query);
  },

  setFilter: (filter: SearchFilterType) => {
    set({ filter });
  },

  setShowDropdown: (showDropdown: boolean) => {
    set({ showDropdown });
  },

  setSelectedIndex: (update) => {
    set((state) => ({
      selectedIndex: typeof update === 'function' ? update(state.selectedIndex) : update,
    }));
  },

  clearSearch: () => {
    set({
      query: '',
      results: null,
      suggestions: [],
      typeaheadResults: [],
      showDropdown: false,
      selectedIndex: -1,
    });
  },

  updateSuggestions: async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      set({
        suggestions: [],
        typeaheadResults: [],
        showDropdown: false,
        selectedIndex: -1,
      });
      return;
    }

    set({ showDropdown: true, selectedIndex: -1 });

    try {
      // Parallel fetch of text suggestions and live media typeahead
      const [fetchedSuggestions, fetchedMedia] = await Promise.all([
        innertubeService.getSearchSuggestions(trimmed),
        trimmed.length > 1 ? innertubeService.searchTypeahead(trimmed) : Promise.resolve([]),
      ]);

      // Guard against stale responses
      if (get().query.trim() !== trimmed) return;

      const filtered = fetchedSuggestions.filter(
        (term) => term.toLowerCase() !== trimmed.toLowerCase()
      );

      // Lead row is always the exact query typed, followed by completions
      set({
        suggestions: [trimmed, ...filtered],
        typeaheadResults: fetchedMedia,
      });
    } catch {
      // Keep existing or fallback silently
    }
  },

  performSearch: async (searchTerm: string, activeFilter?: SearchFilterType) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    const filterToUse = activeFilter || get().filter;

    // Save to history
    const currentHistory = get().history;
    const nextHistory = [
      trimmed,
      ...currentHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, 15);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextHistory));
    } catch {}

    set({
      query: trimmed,
      filter: filterToUse,
      loading: true,
      showDropdown: false,
      suggestions: [],
      typeaheadResults: [],
      history: nextHistory,
    });

    try {
      const res = await innertubeService.search(trimmed, filterToUse);
      set({ results: res, loading: false });
    } catch (e) {
      console.error('Search failed', e);
      set({ loading: false });
    }
  },

  removeHistoryItem: (term: string) => {
    set((state) => {
      const next = state.history.filter((item) => item !== term);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return { history: next };
    });
  },

  clearHistory: () => {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
    set({ history: [] });
  },
}));

