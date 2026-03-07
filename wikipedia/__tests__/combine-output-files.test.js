import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { combineFootballDataFiles } from '../combine-output-files.js';

describe('combine-output-files CLI', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      const dir = tmpDirs.pop();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('merges inputs, keeps richer tier data, normalises goal difference, and removes war years', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const overviewFile = path.join(tmpDir, 'overview.json');
    const promoFile = path.join(tmpDir, 'promo.json');
    const outputFile = path.join(tmpDir, 'all-seasons.json');

    fs.writeFileSync(
      overviewFile,
      JSON.stringify(
        {
          seasons: {
            2000: {
              tier1: {
                season: 2000,
                table: [
                  {
                    pos: 1,
                    team: 'Team Rich Data',
                    played: 1,
                    won: 1,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 4,
                    goalsAgainst: 1,
                    goalDifference: 999, // intentionally incorrect to ensure normalisation
                    goalAverage: null,
                    points: 3,
                    notes: 'Test notes',
                    wasRelegated: false,
                    wasPromoted: true,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: [],
              },
            },
            1915: {
              tier1: {
                season: 1915,
                table: [
                  {
                    pos: 1,
                    team: 'War Season Team',
                    played: 1,
                    won: 1,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 2,
                    goalsAgainst: 0,
                    goalDifference: 2,
                    goalAverage: null,
                    points: 2,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: [],
              },
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      promoFile,
      JSON.stringify(
        {
          seasons: {
            2000: {
              tier1: {
                season: 2000,
                table: [],
                promoted: [],
                relegated: [],
              },
            },
          },
        },
        null,
        2
      )
    );

    const result = combineFootballDataFiles({
      inputs: [overviewFile, promoFile],
      output: outputFile,
      cwd: process.cwd(),
    });

    expect(fs.existsSync(outputFile)).toBe(true);

    const combined = result.dataset;
    expect(combined).toHaveProperty('seasons.2000');
    const tier1Table = combined.seasons['2000'].tier1.table;
    expect(Array.isArray(tier1Table)).toBe(true);
    expect(tier1Table).toHaveLength(1);

    const mergedRow = tier1Table[0];
    expect(mergedRow.team).toBe('Team Rich Data');
    expect(mergedRow.goalDifference).toBe(mergedRow.goalsFor - mergedRow.goalsAgainst);

    expect(combined.seasons['1915']).toBeUndefined();
  });

  test('combineFootballDataFiles reports missing season ranges and non-numeric keys', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const missingSeasonInput = path.join(tmpDir, 'missing.json');
    const partialInput = path.join(tmpDir, 'partial.json');
    const outputFile = path.join(tmpDir, 'merged.json');

    fs.writeFileSync(
      missingSeasonInput,
      JSON.stringify(
        {
          seasons: {
            abc: {
              tier1: {
                season: 'abc',
                table: [],
                promoted: [],
                relegated: [],
              },
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      partialInput,
      JSON.stringify(
        {
          seasons: {
            2001: {
              tier1: {
                season: 2001,
                table: [],
                promoted: [],
                relegated: [],
              },
            },
          },
        },
        null,
        2
      )
    );

    const result = combineFootballDataFiles({
      inputs: [missingSeasonInput, partialInput],
      output: outputFile,
      includeEmpty: false,
      cwd: process.cwd(),
    });

    expect(result.stats.missingSeasonNumbers).toEqual([2001]);
    expect(result.stats.nonNumericMissing).toEqual(['abc']);
  });

  test('combineFootballDataFiles prefers the richer populated tier when both inputs contain data', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const sparseInput = path.join(tmpDir, 'sparse.json');
    const richInput = path.join(tmpDir, 'rich.json');
    const outputFile = path.join(tmpDir, 'merged.json');

    fs.writeFileSync(
      sparseInput,
      JSON.stringify(
        {
          seasons: {
            2002: {
              tier1: {
                season: 2002,
                table: [
                  {
                    pos: 1,
                    team: 'Alpha FC',
                    played: 1,
                    won: 1,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 2,
                    goalsAgainst: 0,
                    goalDifference: 2,
                    goalAverage: null,
                    points: 3,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: [],
              },
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      richInput,
      JSON.stringify(
        {
          seasons: {
            2002: {
              tier1: {
                season: 2002,
                table: [
                  {
                    pos: 1,
                    team: 'Alpha FC',
                    played: 2,
                    won: 2,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 5,
                    goalsAgainst: 1,
                    goalDifference: 4,
                    goalAverage: null,
                    points: 6,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: true,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                  {
                    pos: 2,
                    team: 'Beta FC',
                    played: 2,
                    won: 1,
                    drawn: 0,
                    lost: 1,
                    goalsFor: 3,
                    goalsAgainst: 3,
                    goalDifference: 0,
                    goalAverage: null,
                    points: 3,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: ['Alpha FC'],
                relegated: [],
                metadata: {
                  source: 'wikipedia-overview',
                  title: 'Rich League',
                  tierKey: 'tier1',
                },
              },
            },
          },
        },
        null,
        2
      )
    );

    const result = combineFootballDataFiles({
      inputs: [sparseInput, richInput],
      output: outputFile,
      cwd: process.cwd(),
    });

    expect(result.dataset.seasons['2002'].tier1.table).toHaveLength(2);
    expect(result.dataset.seasons['2002'].tier1.promoted).toEqual(['Alpha FC']);
    expect(result.dataset.seasons['2002'].tier1.metadata).toMatchObject({
      title: 'Rich League',
      tierKey: 'tier1',
    });
  });

  test('combineFootballDataFiles preserves overview tier ordering for Premier League-era overlaps', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const overviewInput = path.join(tmpDir, 'overview.json');
    const promotionInput = path.join(tmpDir, 'promotion.json');
    const outputFile = path.join(tmpDir, 'merged.json');

    fs.writeFileSync(
      overviewInput,
      JSON.stringify(
        {
          seasons: {
            1992: {
              seasonInfo: {
                season: 1992,
                table: [],
                promoted: ['Newcastle United', 'West Ham United', 'Swindon Town'],
                relegated: ['Crystal Palace', 'Middlesbrough', 'Nottingham Forest'],
                seasonSlug: '1992–93_in_English_football',
                sourceUrl: 'https://en.wikipedia.org/wiki/1992–93_in_English_football',
                tableCount: 4,
              },
              tier1: {
                season: 1992,
                table: [
                  {
                    pos: 1,
                    team: 'Manchester United',
                    played: 42,
                    won: 24,
                    drawn: 12,
                    lost: 6,
                    goalsFor: 67,
                    goalsAgainst: 31,
                    goalDifference: 36,
                    goalAverage: null,
                    points: 84,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: ['Crystal Palace', 'Middlesbrough', 'Nottingham Forest'],
                metadata: {
                  source: 'wikipedia-overview',
                  sourceUrl: 'https://en.wikipedia.org/wiki/1992–93_in_English_football',
                  seasonSlug: '1992–93_in_English_football',
                  leagueId: 'FA_Premier_League',
                  title: 'FA Premier League',
                  tableIndex: 0,
                  tableCount: 4,
                  tierKey: 'tier1',
                },
              },
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      promotionInput,
      JSON.stringify(
        {
          seasons: {
            1992: {
              seasonInfo: {
                season: 1992,
                table: [],
                promoted: ['Stoke City', 'Bolton Wanderers', 'West Bromwich Albion'],
                relegated: ['Bristol City', 'Cambridge United', 'Middlesbrough'],
                seasonSlug: '1992-93_Football_League',
                sourceUrl: 'https://en.wikipedia.org/wiki/1992-93_Football_League',
                tableCount: null,
              },
              tier1: {
                season: 1992,
                table: [
                  {
                    pos: 1,
                    team: 'Newcastle United',
                    played: 46,
                    won: 29,
                    drawn: 11,
                    lost: 6,
                    goalsFor: 88,
                    goalsAgainst: 37,
                    goalDifference: 51,
                    goalAverage: null,
                    points: 98,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                  {
                    pos: 2,
                    team: 'West Ham United',
                    played: 46,
                    won: 25,
                    drawn: 11,
                    lost: 10,
                    goalsFor: 66,
                    goalsAgainst: 44,
                    goalDifference: 22,
                    goalAverage: null,
                    points: 86,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: ['Bristol City', 'Cambridge United', 'Middlesbrough'],
                metadata: {
                  source: 'wikipedia-promotion',
                  sourceUrl: 'https://en.wikipedia.org/wiki/1992-93_Football_League',
                  seasonSlug: '1992-93_Football_League',
                  tierKey: 'tier1',
                },
              },
            },
          },
        },
        null,
        2
      )
    );

    const result = combineFootballDataFiles({
      inputs: [overviewInput, promotionInput],
      output: outputFile,
      cwd: process.cwd(),
    });

    expect(result.dataset.seasons['1992'].tier1.table[0].team).toBe('Manchester United');
    expect(result.dataset.seasons['1992'].tier1.metadata).toMatchObject({
      source: 'wikipedia-overview',
      leagueId: 'FA_Premier_League',
      tierKey: 'tier1',
    });
  });

  test('combineFootballDataFiles reconciles seasonInfo top-flight movement from adjacent seasons', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const inputFile = path.join(tmpDir, 'input.json');
    const outputFile = path.join(tmpDir, 'merged.json');

    fs.writeFileSync(
      inputFile,
      JSON.stringify(
        {
          seasons: {
            1898: {
              seasonInfo: {
                season: 1898,
                table: [],
                promoted: ['Manchester City', 'Glossop North End'],
                relegated: ['Bolton Wanderers', 'The Wednesday'],
                seasonSlug: '1898-99_Football_League',
                sourceUrl: 'https://en.wikipedia.org/wiki/1898-99_Football_League',
                tableCount: 0,
              },
              tier1: {
                season: 1898,
                table: [
                  {
                    pos: 1,
                    team: 'Aston Villa',
                    played: 1,
                    won: 1,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 1,
                    goalsAgainst: 0,
                    goalDifference: 1,
                    goalAverage: null,
                    points: 2,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                  {
                    pos: 2,
                    team: 'Bolton Wanderers',
                    played: 1,
                    won: 0,
                    drawn: 0,
                    lost: 1,
                    goalsFor: 0,
                    goalsAgainst: 1,
                    goalDifference: -1,
                    goalAverage: null,
                    points: 0,
                    notes: null,
                    wasRelegated: true,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: ['Bolton Wanderers'],
                metadata: {
                  source: 'wikipedia-promotion',
                  sourceUrl: 'https://en.wikipedia.org/wiki/1898-99_Football_League',
                  seasonSlug: '1898-99_Football_League',
                  tierKey: 'tier1',
                },
              },
            },
            1899: {
              seasonInfo: {
                season: 1899,
                table: [],
                promoted: [],
                relegated: [],
                seasonSlug: '1899-1900_Football_League',
                sourceUrl: 'https://en.wikipedia.org/wiki/1899-1900_Football_League',
                tableCount: 0,
              },
              tier1: {
                season: 1899,
                table: [
                  {
                    pos: 1,
                    team: 'Aston Villa',
                    played: 1,
                    won: 1,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 1,
                    goalsAgainst: 0,
                    goalDifference: 1,
                    goalAverage: null,
                    points: 2,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                  {
                    pos: 2,
                    team: 'Glossop',
                    played: 1,
                    won: 0,
                    drawn: 1,
                    lost: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    goalDifference: 0,
                    goalAverage: null,
                    points: 1,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                  {
                    pos: 3,
                    team: 'Manchester City',
                    played: 1,
                    won: 0,
                    drawn: 0,
                    lost: 1,
                    goalsFor: 0,
                    goalsAgainst: 1,
                    goalDifference: -1,
                    goalAverage: null,
                    points: 0,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: [],
                metadata: {
                  source: 'wikipedia-promotion',
                  sourceUrl: 'https://en.wikipedia.org/wiki/1899-1900_Football_League',
                  seasonSlug: '1899-1900_Football_League',
                  tierKey: 'tier1',
                },
              },
            },
          },
        },
        null,
        2
      )
    );

    const result = combineFootballDataFiles({
      inputs: [inputFile],
      output: outputFile,
      cwd: process.cwd(),
    });

    expect(result.dataset.seasons['1898'].seasonInfo.promoted).toEqual([
      'Glossop',
      'Manchester City',
    ]);
    expect(result.dataset.seasons['1898'].seasonInfo.relegated).toEqual(['Bolton Wanderers']);
  });

  test('combineFootballDataFiles throws when an input file is missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);
    const outputFile = path.join(tmpDir, 'merged.json');

    expect(() => {
      combineFootballDataFiles({
        inputs: [path.join(tmpDir, 'does-not-exist.json')],
        output: outputFile,
        cwd: process.cwd(),
      });
    }).toThrow(/Input file not found/i);
  });
});
