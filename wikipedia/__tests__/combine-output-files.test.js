import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jest } from '@jest/globals';
import {
  combineFootballDataFiles,
  groupMissingSeasons,
  runCli,
  splitSeasonEntriesForOutput,
} from '../data/combine-output-files.js';

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

  test('combineFootballDataFiles reconciles season continuity across canonical club aliases', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const promoInput = path.join(tmpDir, 'promo.json');
    const outputFile = path.join(tmpDir, 'merged.json');

    fs.writeFileSync(
      promoInput,
      JSON.stringify(
        {
          seasons: {
            1904: {
              seasonInfo: {
                season: 1904,
                table: [],
                promoted: ['Liverpool', 'Bolton Wanderers', 'Birmingham'],
                relegated: ['Small Heath'],
                seasonSlug: '1904-05_Football_League',
                sourceUrl: 'https://example.com/1904',
                tableCount: 0,
              },
              tier1: {
                season: 1904,
                table: [
                  {
                    pos: 1,
                    team: 'Small Heath',
                    played: 34,
                    won: 20,
                    drawn: 8,
                    lost: 6,
                    goalsFor: 50,
                    goalsAgainst: 30,
                    goalDifference: 20,
                    goalAverage: null,
                    points: 48,
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
                  seasonSlug: '1904-05',
                  tierKey: 'tier1',
                },
              },
            },
            1905: {
              seasonInfo: {
                season: 1905,
                table: [],
                promoted: ['Bristol City', 'Manchester United'],
                relegated: ['Nottingham Forest', 'Wolverhampton Wanderers'],
                seasonSlug: '1905-06_Football_League',
                sourceUrl: 'https://example.com/1905',
                tableCount: 0,
              },
              tier1: {
                season: 1905,
                table: [
                  {
                    pos: 1,
                    team: 'Birmingham',
                    played: 38,
                    won: 24,
                    drawn: 7,
                    lost: 7,
                    goalsFor: 65,
                    goalsAgainst: 31,
                    goalDifference: 34,
                    goalAverage: null,
                    points: 55,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                  {
                    pos: 19,
                    team: 'Nottingham Forest',
                    played: 38,
                    won: 12,
                    drawn: 6,
                    lost: 20,
                    goalsFor: 40,
                    goalsAgainst: 60,
                    goalDifference: -20,
                    goalAverage: null,
                    points: 30,
                    notes: null,
                    wasRelegated: true,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                  {
                    pos: 20,
                    team: 'Wolverhampton Wanderers',
                    played: 38,
                    won: 10,
                    drawn: 8,
                    lost: 20,
                    goalsFor: 35,
                    goalsAgainst: 61,
                    goalDifference: -26,
                    goalAverage: null,
                    points: 28,
                    notes: null,
                    wasRelegated: true,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: ['Nottingham Forest', 'Wolverhampton Wanderers'],
                metadata: {
                  source: 'wikipedia-promotion',
                  seasonSlug: '1905-06',
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
      inputs: [promoInput],
      output: outputFile,
      cwd: process.cwd(),
    });

    expect(result.dataset.seasons['1904'].seasonInfo.promoted).toEqual([
      'Nottingham Forest',
      'Wolverhampton Wanderers',
    ]);
    expect(result.dataset.seasons['1904'].seasonInfo.relegated).toEqual([]);
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

  test('combineFootballDataFiles merges top-level clubs from dataset files and sidecar club metadata files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const seasonInput = path.join(tmpDir, 'season-input.json');
    const clubInput = path.join(tmpDir, 'club-input.json');
    const outputFile = path.join(tmpDir, 'merged.json');

    fs.writeFileSync(
      seasonInput,
      JSON.stringify(
        {
          clubs: {
            Arsenal: {
              canonicalName: 'Arsenal',
              founded: '1886',
              nameHistory: [{ name: 'Woolwich Arsenal', startSeason: 1886, endSeason: 1912 }],
            },
          },
          seasons: {
            1900: {
              tier1: {
                season: 1900,
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
      clubInput,
      JSON.stringify(
        {
          Arsenal: {
            canonicalName: 'Arsenal',
            financialEvents: [{ type: 'administration', startSeason: 1910, endSeason: 1911 }],
          },
          'Birmingham City': {
            canonicalName: 'Birmingham City',
            founded: '1875',
            nameHistory: [{ name: 'Small Heath', startSeason: 1875, endSeason: 1905 }],
          },
        },
        null,
        2
      )
    );

    const result = combineFootballDataFiles({
      inputs: [seasonInput],
      clubMetadataInputs: [clubInput],
      output: outputFile,
      cwd: process.cwd(),
    });

    expect(result.dataset.clubs).toBeDefined();
    expect(result.dataset.clubs.Arsenal).toEqual({
      canonicalName: 'Arsenal',
      founded: '1886',
      nameHistory: [{ name: 'Woolwich Arsenal', startSeason: 1886, endSeason: 1912 }],
      financialEvents: [{ type: 'administration', startSeason: 1910, endSeason: 1911 }],
    });
    expect(result.dataset.clubs['Birmingham City']).toEqual({
      canonicalName: 'Birmingham City',
      founded: '1875',
      nameHistory: [{ name: 'Small Heath', startSeason: 1875, endSeason: 1905 }],
    });
  });

  test('runCli accepts club metadata before the input file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const seasonInput = path.join(tmpDir, 'season-input.json');
    const clubInput = path.join(tmpDir, 'club-input.json');
    const outputFile = path.join(tmpDir, 'merged.json');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    fs.writeFileSync(
      seasonInput,
      JSON.stringify({
        seasons: {
          2024: {
            tier1: {
              season: 2024,
              table: [{ team: 'Arsenal' }],
              promoted: [],
              relegated: [],
            },
          },
        },
      })
    );
    fs.writeFileSync(
      clubInput,
      JSON.stringify({
        clubs: {
          arsenal: {
            canonicalName: 'Arsenal',
            derived: {
              aliases: ['Arsenal'],
              seasonsSeen: [2024],
            },
          },
        },
      })
    );

    try {
      const result = runCli([
        'node',
        'combine-output-files.js',
        '--output',
        outputFile,
        '--club-metadata',
        clubInput,
        seasonInput,
      ]);

      expect(result.dataset.clubs.arsenal.derived.seasonsSeen).toEqual([2024]);
    } finally {
      consoleSpy.mockRestore();
    }
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

  test('splitSeasonEntriesForOutput filters war seasons and empties consistently', () => {
    const { filteredSeasonEntries, excludedSeasonEntries, removedWarSeasons } =
      splitSeasonEntriesForOutput({
        seasonEntries: [
          ['1915', { tier1: { table: [{ team: 'War Club' }] } }],
          ['1916', { tier1: { table: [] } }],
          ['2000', { tier1: { table: [{ team: 'League Club' }] } }],
          ['2001', { seasonInfo: { note: true } }],
          ['2002', { tier1: { table: [{ team: 'AFC' }] } }],
          ['abc', {}],
        ],
        includeEmpty: false,
      });

    expect(removedWarSeasons).toBe(2);
    expect(filteredSeasonEntries.map(([seasonKey]) => seasonKey)).toEqual(['2000', '2002']);
    expect(excludedSeasonEntries.map(([seasonKey]) => seasonKey)).toEqual(['2001', 'abc']);
  });

  test('splitSeasonEntriesForOutput preserves wartime placeholder seasons', () => {
    const { filteredSeasonEntries, excludedSeasonEntries, removedWarSeasons } =
      splitSeasonEntriesForOutput({
        seasonEntries: [
          [
            '1939',
            {
              seasonInfo: {
                season: 1939,
                table: [],
                promoted: [],
                relegated: [],
                competitionStatus: 'abandoned-season',
                officialLeagueTables: false,
              },
            },
          ],
          ['1941', { seasonInfo: { season: 1941, table: [], promoted: [], relegated: [] } }],
          ['2000', { tier1: { table: [{ team: 'League Club' }] } }],
        ],
        includeEmpty: false,
      });

    expect(removedWarSeasons).toBe(1);
    expect(filteredSeasonEntries.map(([seasonKey]) => seasonKey)).toEqual(['1939', '2000']);
    expect(excludedSeasonEntries).toEqual([]);
  });

  test('groupMissingSeasons buckets missing seasons by era', () => {
    expect(groupMissingSeasons([2002, 1916, 1941, 2001, 1915])).toEqual({
      ww1: [1915, 1916],
      ww2: [1941],
      other: [2001, 2002],
    });
  });
});
