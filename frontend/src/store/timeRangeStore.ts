import { create } from 'zustand';
import { getTrafficTimeRange } from '../services/analytics.service';
import { formatRangeIST } from '../utils/date';

export type TimeRangePreset = 'all' | '24h' | '7d' | 'custom';

interface TimeRangeState {
  preset: TimeRangePreset;
  from?: string;
  to?: string;
  label: string;
  dataRange: {
    earliest: string | null;
    latest: string | null;
  };
  setPreset: (preset: TimeRangePreset, customFrom?: string, customTo?: string) => void;
  fetchDataRange: () => Promise<void>;
}

export const useTimeRangeStore = create<TimeRangeState>((set, get) => ({
  preset: 'all',
  from: undefined,
  to: undefined,
  label: 'All data',
  dataRange: {
    earliest: null,
    latest: null,
  },

  setPreset: (preset, customFrom, customTo) => {
    const { dataRange } = get();

    switch (preset) {
      case 'all':
        set({
          preset: 'all',
          from: undefined,
          to: undefined,
          label:
            dataRange.earliest && dataRange.latest
              ? formatRangeIST(dataRange.earliest, dataRange.latest)
              : 'All data',
        });
        break;

      case '24h': {
        const now = new Date();
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const fromIso = past24h.toISOString();
        const toIso = now.toISOString();
        set({
          preset: '24h',
          from: fromIso,
          to: toIso,
          label: `Last 24h: ${formatRangeIST(fromIso, toIso)}`,
        });
        break;
      }

      case '7d': {
        const now = new Date();
        const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fromIso = past7d.toISOString();
        const toIso = now.toISOString();
        set({
          preset: '7d',
          from: fromIso,
          to: toIso,
          label: `Last 7 days: ${formatRangeIST(fromIso, toIso)}`,
        });
        break;
      }

      case 'custom':
        set({
          preset: 'custom',
          from: customFrom,
          to: customTo,
          label:
            customFrom && customTo
              ? `Custom: ${formatRangeIST(customFrom, customTo)}`
              : 'Custom',
        });
        break;
    }
  },

  fetchDataRange: async () => {
    try {
      const range = await getTrafficTimeRange();
      const earliest = range?.earliest || null;
      const latest = range?.latest || null;

      set((state) => {
        const dataRange = { earliest, latest };
        if (state.preset === 'all') {
          return {
            dataRange,
            from: undefined,
            to: undefined,
            label:
              earliest && latest
                ? formatRangeIST(earliest, latest)
                : 'All data',
          };
        }
        return { dataRange };
      });
    } catch (err) {
      console.warn('Could not fetch data time range from API:', err);
    }
  },
}));
