import { normaliseGoalDifference } from '../data/season-rules.js';
import {
  buildHistoricalPlaceholderSeasonInfo,
  mergeSeasonRecords,
  reconcileSeasonInfoContinuity,
  getHistoricalSeasonStatus,
  isHistoricalPlaceholderSeason,
  isWarSuspensionSeason,
  shouldIgnoreMissingSeasonData,
  shouldSkipContinuityForSeason,
  getExpectedMinimumTierCount,
  parseSeasonNumber,
  extractSeasonKeyFromSlug,
  extractSeasonYearFromSlug,
  seasonHasTierData,
  isTierKey,
  getTierKeys,
  compareSeasonKeys,
  sortSeasonKeys,
} from '../data/season-rules.js';

describe('season-rules', () => {
  test('parses numeric season keys and flags war years', () => {
    expect(parseSeasonNumber('1992')).toBe(1992);
    expect(parseSeasonNumber('abcd')).toBeNull();
    expect(isWarSuspensionSeason('1915')).toBe(true);
    expect(isWarSuspensionSeason('1945')).toBe(true);
    expect(isWarSuspensionSeason('1991')).toBe(false);
  });

  test('classifies historical placeholder season statuses', () => {
    expect(getHistoricalSeasonStatus('1915')).toBe('wartime-special');
    expect(getHistoricalSeasonStatus('1939')).toBe('abandoned-season');
    expect(getHistoricalSeasonStatus('1942')).toBe('wartime-special');
    expect(getHistoricalSeasonStatus('1945')).toBe('regional-bridge-season');
    expect(getHistoricalSeasonStatus('1946')).toBeNull();
  });

  test('treats placeholder seasons as intentional season data', () => {
    const placeholder = {
      seasonInfo: buildHistoricalPlaceholderSeasonInfo('1945'),
    };

    expect(isHistoricalPlaceholderSeason(placeholder, '1945')).toBe(true);
  });

  test('mergeSeasonRecords keeps richer data and preserves non-tier fields', () => {
    const merged = mergeSeasonRecords(
      {
        seasonInfo: { slug: 'existing' },
        tier1: {
          metadata: { source: 'wikipedia-overview' },
          table: [],
          promoted: [],
          relegated: [],
        },
      },
      {
        seasonInfo: null,
        tier1: {
          metadata: { source: 'wikipedia-overview' },
          table: [{ pos: 1, team: 'A' }],
          promoted: ['A'],
          relegated: [],
        },
        tier2: {
          metadata: { source: 'wikipedia-promotion' },
          table: [{ pos: 1, team: 'B' }],
          promoted: [],
          relegated: [],
        },
      },
      false,
      '1992'
    );

    expect(merged.seasonInfo).toMatchObject({ slug: 'existing' });
    expect(merged.tier1.table).toHaveLength(1);
    expect(merged.tier2).toMatchObject({
      metadata: { source: 'wikipedia-promotion' },
    });
  });

  test('reconciles seasonInfo continuity with team aliases', () => {
    const dataset = {
      seasons: {
        1904: {
          seasonInfo: {
            promoted: [],
            relegated: [],
          },
          tier1: {
            table: [{ team: 'The Wednesday' }, { team: 'Bolton Wanderers' }],
          },
        },
        1905: {
          seasonInfo: {
            promoted: [],
            relegated: [],
          },
          tier1: {
            table: [{ team: 'Sheffield Wednesday' }, { team: 'Aston Villa' }],
          },
        },
      },
    };

    reconcileSeasonInfoContinuity(dataset);

    expect(dataset.seasons['1904'].seasonInfo.promoted).toEqual(['Aston Villa']);
    expect(dataset.seasons['1904'].seasonInfo.relegated).toEqual(['Bolton Wanderers']);
  });

  test('can limit continuity reconciliation to an upper season boundary', () => {
    const baseDataset = {
      seasons: {
        1899: {
          seasonInfo: {
            promoted: [],
            relegated: [],
          },
          tier1: {
            table: [{ team: 'A' }, { team: 'B' }],
          },
        },
        1900: {
          seasonInfo: {
            promoted: [],
            relegated: [],
          },
          tier1: {
            table: [{ team: 'A' }, { team: 'C' }],
          },
        },
        1901: {
          seasonInfo: {
            promoted: [],
            relegated: [],
          },
          tier1: {
            table: [{ team: 'B' }, { team: 'C' }],
          },
        },
      },
    };

    const earlyDataset = JSON.parse(JSON.stringify(baseDataset));
    reconcileSeasonInfoContinuity(earlyDataset, { maxContinuitySeason: 1899 });
    expect(earlyDataset.seasons['1899'].seasonInfo.promoted).toEqual(['C']);
    expect(earlyDataset.seasons['1899'].seasonInfo.relegated).toEqual(['B']);

    const boundedDataset = JSON.parse(JSON.stringify(baseDataset));
    reconcileSeasonInfoContinuity(boundedDataset, { maxContinuitySeason: 1900 });
    expect(boundedDataset.seasons['1899'].seasonInfo.promoted).toEqual(['C']);
    expect(boundedDataset.seasons['1899'].seasonInfo.relegated).toEqual(['B']);
    expect(boundedDataset.seasons['1900'].seasonInfo.promoted).toEqual(['B']);
    expect(boundedDataset.seasons['1900'].seasonInfo.relegated).toEqual(['A']);
  });

  test('normaliseGoalDifference fixes incorrect values in-place', () => {
    const dataset = {
      seasons: {
        2000: {
          tier1: {
            table: [{ goalsFor: 10, goalsAgainst: 7, goalDifference: 1 }],
          },
        },
      },
    };

    normaliseGoalDifference(dataset);

    expect(dataset.seasons['2000'].tier1.table[0].goalDifference).toBe(3);
  });

  test('continuity and coverage helpers are stable', () => {
    expect(getExpectedMinimumTierCount(1991)).toBe(4);
    expect(getExpectedMinimumTierCount(1950)).toBe(2);
    expect(shouldIgnoreMissingSeasonData({ kind: 'promotion-only' }, '1915')).toBe(true);
    expect(shouldIgnoreMissingSeasonData({ kind: 'promotion-only' }, '2005')).toBe(false);
    expect(shouldSkipContinuityForSeason({ kind: 'promotion-only' }, 1991)).toBe(true);
    expect(shouldSkipContinuityForSeason({ kind: 'promotion-only' }, 1990)).toBe(false);
    expect(shouldSkipContinuityForSeason({ kind: 'mixed' }, 1991)).toBe(false);
    expect(extractSeasonKeyFromSlug('1992–93_in_English_football')).toBe('1992');
    expect(extractSeasonYearFromSlug('1992–93_in_English_football')).toBe(1992);
    expect(
      seasonHasTierData({
        seasonInfo: { foo: true },
        tier1: [],
        tier2: { table: [{ team: 'A' }] },
      })
    ).toBe(true);
  });

  test('shared tier-key helpers centralize key filtering and sorting behavior', () => {
    expect(isTierKey('tier1')).toBe(true);
    expect(isTierKey('league')).toBe(false);
    expect(compareSeasonKeys('1992', '1899')).toBeGreaterThan(0);
    expect(compareSeasonKeys('abc', '1901')).toBeGreaterThan(0);
    expect(sortSeasonKeys(['abc', '1991', '1900', 'def', '1899']).slice(0, 5)).toEqual([
      '1899',
      '1900',
      '1991',
      'abc',
      'def',
    ]);
    expect(getTierKeys({ tier1: [], tier2: [], notTier: 1 })).toEqual(['tier1', 'tier2']);
  });
});
