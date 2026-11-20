import { create } from 'zustand';

export type TimeRangePreset = 'all' | '24h' | '7d' | 'custom';

interface TimeRangeState {
  preset: TimeRangePreset;
  from?: string;
  to?: string;
  label: string;
  setPreset: (preset: TimeRangePreset, customFrom?: string, customTo?: string) => void;
}

export const useTimeRangeStore = create<TimeRangeState>((set) => ({
  preset: 'all',
  from: '2026-11-15T00:00:00Z',
  to: '2026-11-19T23:59:59Z',
  label: 'All Demo Data (Nov 15-19, 2026)',

  setPreset: (preset, customFrom, customTo) => {
    switch (preset) {
      case 'all':
        set({
          preset: 'all',
          from: '2026-11-15T00:00:00Z',
          to: '2026-11-19T23:59:59Z',
          label: 'All Demo Data (Nov 15-19, 2026)',
        });
        break;
      case '24h':
        set({
          preset: '24h',
          from: '2026-11-16T00:00:00Z',
          to: '2026-11-17T23:59:59Z',
          label: 'Demo Peak Days (Nov 16-17)',
        });
        break;
      case '7d':
        set({
          preset: '7d',
          from: '2026-11-12T00:00:00Z',
          to: '2026-11-19T23:59:59Z',
          label: 'Demo Week (Nov 12-19)',
        });
        break;
      case 'custom':
        set({
          preset: 'custom',
          from: customFrom,
          to: customTo,
          label: `Custom: ${customFrom?.slice(0, 10)} to ${customTo?.slice(0, 10)}`,
        });
        break;
    }
  },
}));
