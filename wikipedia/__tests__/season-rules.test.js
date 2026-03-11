import { normaliseGoalDifference } from '../season-rules.js';
import {
  mergeSeasonRecords,
  reconcileSeasonInfoContinuity,
  isWarSuspensionSeason,
  shouldIgnoreMissingSeasonData,
  shouldSkipContinuityForSeason,
  getExpectedMinimumTierCount,
  parseSeasonNumber,
} from '../season-rules.js';

describe('season-rules', () => {
  test('parses numeric season keys and flags war years', () => {
    expect(parseSeasonNumber('1992')).toBe(1992);
    expect(parseSeasonNumber('abcd')).toBeNull();
    expect(isWarSuspensionSeason('1915')).toBe(true);
    expect(isWarSuspensionSeason('1945')).toBe(true);
    expect(isWarSuspensionSeason('1991')).toBe(false);
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
  });
});
