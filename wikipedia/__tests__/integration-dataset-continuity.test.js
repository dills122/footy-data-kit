import {
  findNextComparableSeasonRecord,
  isPlaceholderSeasonRecord,
} from '../__integration_tests__/dataset-continuity.js';

describe('integration dataset continuity helpers', () => {
  test('detects metadata-only placeholder seasons', () => {
    expect(
      isPlaceholderSeasonRecord({
        seasonInfo: {
          season: 1939,
          competitionStatus: 'abandoned-season',
          officialLeagueTables: false,
        },
      })
    ).toBe(true);

    expect(
      isPlaceholderSeasonRecord({
        seasonInfo: {
          season: 1946,
        },
        tier1: {
          table: [{ team: 'Liverpool' }],
        },
      })
    ).toBe(false);
  });

  test('skips wartime placeholders when finding the next comparable saved season', () => {
    const dataset = {
      seasons: {
        1938: {
          seasonInfo: { season: 1938, promoted: [], relegated: [] },
          tier1: { table: [{ team: 'Everton' }] },
        },
        1939: {
          seasonInfo: {
            season: 1939,
            competitionStatus: 'abandoned-season',
            officialLeagueTables: false,
          },
        },
        1940: {
          seasonInfo: {
            season: 1940,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1945: {
          seasonInfo: {
            season: 1945,
            competitionStatus: 'regional-bridge-season',
            officialLeagueTables: false,
          },
        },
        1946: {
          seasonInfo: { season: 1946, promoted: [], relegated: [] },
          tier1: { table: [{ team: 'Liverpool' }] },
        },
      },
    };

    expect(findNextComparableSeasonRecord(dataset, 1938)).toMatchObject({
      season: 1946,
      record: dataset.seasons['1946'],
    });
  });

  test('returns a missing next season when there is no later comparable dataset entry', () => {
    const dataset = {
      seasons: {
        2000: {
          seasonInfo: { season: 2000, promoted: [], relegated: [] },
          tier1: { table: [{ team: 'Alpha FC' }] },
        },
      },
    };

    expect(findNextComparableSeasonRecord(dataset, 2000)).toEqual({
      season: 2001,
      record: null,
    });
  });
});
