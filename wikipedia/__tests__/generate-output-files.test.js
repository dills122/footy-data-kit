import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildDatasetMetadata,
  normaliseLeagueTableEntry,
  createFootballData,
  updateFootballDataFile,
  loadFootballData,
  saveFootballData,
  setSeasonRecord,
} from '../data/generate-output-files.ts';

describe('normaliseLeagueTableEntry', () => {
  test('derives promotion and relegation flags from notes when omitted', () => {
    const entry = normaliseLeagueTableEntry({
      pos: '1',
      team: 'Sample FC',
      played: '42',
      won: '25',
      drawn: '10',
      lost: '7',
      goalsFor: '82',
      goalsAgainst: '44',
      goalDifference: '',
      goalAverage: null,
      points: '60',
      notes: 'Promoted to the First Division',
    });

    expect(entry.team).toBe('Sample FC');
    expect(entry.wasPromoted).toBe(true);
    expect(entry.wasRelegated).toBe(false);
    expect(entry.goalDifference).toBe(38);
  });

  test('preserves explicit boolean flags and normalises numeric strings', () => {
    const entry = normaliseLeagueTableEntry({
      pos: '22',
      team: 'Sample Town',
      played: '42',
      won: '10',
      drawn: '8',
      lost: '24',
      goalsFor: '40',
      goalsAgainst: '80',
      goalAverage: '',
      points: '28',
      notes: null,
      wasRelegated: true,
      wasPromoted: false,
    });

    expect(entry.wasRelegated).toBe(true);
    expect(entry.wasPromoted).toBe(false);
    expect(entry.goalDifference).toBe(-40);
    expect(entry.goalAverage).toBeNull();
  });

  test('rejects rows without a team name', () => {
    expect(() =>
      normaliseLeagueTableEntry({
        pos: 1,
        played: 42,
        won: 25,
        drawn: 10,
        lost: 7,
        goalsFor: 82,
        goalsAgainst: 44,
        points: 60,
      })
    ).toThrow('League table entry is missing a team name');
  });
});

describe('createFootballData', () => {
  test('normalises tier data and derives relegated/promoted lists', () => {
    const dataset = createFootballData({
      seasons: {
        1901: {
          tier1: {
            season: 1901,
            table: [
              {
                pos: 1,
                team: 'Alpha FC',
                played: 34,
                won: 20,
                drawn: 8,
                lost: 6,
                goalsFor: 60,
                goalsAgainst: 30,
                goalDifference: 30,
                goalAverage: null,
                points: 68,
                notes: 'Relegated to division below',
              },
              {
                pos: 2,
                team: 'Beta FC',
                played: 34,
                won: 18,
                drawn: 9,
                lost: 7,
                goalsFor: 55,
                goalsAgainst: 32,
                goalDifference: 23,
                goalAverage: null,
                points: 63,
                notes: null,
              },
            ],
            promoted: [],
          },
          tier2: [
            {
              pos: 1,
              team: 'Gamma FC',
              played: 34,
              won: 21,
              drawn: 7,
              lost: 6,
              goalsFor: 70,
              goalsAgainst: 35,
              goalDifference: 35,
              goalAverage: null,
              points: 70,
              notes: 'Promoted to the First Division',
            },
          ],
        },
      },
    });

    const tier1 = dataset.seasons['1901'].tier1;
    expect(tier1.season).toBe(1901);
    expect(tier1.relegated).toEqual(['Alpha FC']);
    expect(tier1.promoted).toEqual([]);

    const tier2 = dataset.seasons['1901'].tier2;
    expect(Array.isArray(tier2)).toBe(true);
    expect(tier2[0].wasPromoted).toBe(true);
  });

  test('normalises structured tier metadata and explicit outcome lists', () => {
    const dataset = createFootballData({
      seasons: {
        1902: {
          tier3: {
            season: '1902',
            table: [
              null,
              {
                pos: '1',
                team: 'Delta FC',
                played: '34',
                won: '22',
                drawn: '5',
                lost: '7',
                goalsFor: '75',
                goalsAgainst: '36',
                points: '49',
                notes: 'Promoted through election',
              },
              {
                pos: '2',
                team: 'Echo FC',
                played: '34',
                won: '20',
                drawn: '7',
                lost: '7',
                goalsFor: '70',
                goalsAgainst: '40',
                points: '47',
                notes: 'Relegated',
              },
            ],
            promoted: ['Manual Promoted FC'],
            relegated: ['Manual Relegated FC'],
            sourceUrl: 'https://example.test/season',
            seasonSlug: '1902-03_example',
            tier: 'tier3',
            title: 'Example Division',
            seasonMetadata: {
              leagueId: 'example-division',
              tableIndex: 2,
              tableCount: 4,
            },
          },
        },
      },
    });

    const tier3 = dataset.seasons['1902'].tier3;
    expect(tier3.season).toBe(1902);
    expect(tier3.table.map((row) => row.team)).toEqual(['Delta FC', 'Echo FC']);
    expect(tier3.promoted).toEqual(['Manual Promoted FC']);
    expect(tier3.relegated).toEqual(['Manual Relegated FC']);
    expect(tier3.metadata).toMatchObject({
      source: 'wikipedia-overview',
      sourceUrl: 'https://example.test/season',
      seasonSlug: '1902-03_example',
      tierKey: 'tier3',
      title: 'Example Division',
      leagueId: 'example-division',
      tableIndex: 2,
      tableCount: 4,
    });
  });

  test('normalises seasonInfo metadata and special competition lists', () => {
    const dataset = createFootballData({
      seasons: {
        1915: {
          seasonInfo: {
            season: '1915',
            promoted: ['Alpha FC', 'Alpha FC', ''],
            relegated: ['Beta FC'],
            seasonSlug: '1915-16_in_English_football',
            sourceUrl: 'https://example.test/1915',
            tableCount: '3',
            competitionStatus: ' suspended ',
            warSuspensionLabel: 'World War I',
            officialLeagueTables: false,
            officialCompetitionsSuspended: true,
            officialCompetitionsAbandoned: false,
            regionalBridgeSeason: true,
            promotionRelegationApplies: false,
            specialCompetitions: ['London Combination', 'London Combination', '', null],
            notes: ' Wartime regional competitions only ',
          },
        },
      },
    });

    expect(dataset.seasons['1915'].seasonInfo).toEqual({
      season: 1915,
      table: [],
      promoted: ['Alpha FC'],
      relegated: ['Beta FC'],
      seasonSlug: '1915-16_in_English_football',
      sourceUrl: 'https://example.test/1915',
      tableCount: 3,
      competitionStatus: 'suspended',
      warSuspensionLabel: 'World War I',
      officialLeagueTables: false,
      officialCompetitionsSuspended: true,
      officialCompetitionsAbandoned: false,
      regionalBridgeSeason: true,
      promotionRelegationApplies: false,
      specialCompetitions: ['London Combination'],
      notes: 'Wartime regional competitions only',
    });
  });

  test('preserves top-level dataset metadata', () => {
    const dataset = createFootballData({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-combined',
        generatedAt: '2026-03-08T12:00:00.000Z',
        gitSha: 'abc1234',
        sourceFiles: ['a.json', 'b.json', 'a.json'],
        buildOptions: {
          includeEmpty: false,
          compact: false,
        },
      },
      seasons: {},
    });

    expect(dataset.metadata).toMatchObject({
      schemaVersion: 1,
      generator: 'wikipedia-combined',
      generatedAt: '2026-03-08T12:00:00.000Z',
      gitSha: 'abc1234',
      sourceFiles: ['a.json', 'b.json'],
      buildOptions: {
        includeEmpty: false,
        compact: false,
      },
    });
  });

  test('normalises top-level club metadata records', () => {
    const dataset = createFootballData({
      clubs: {
        'Birmingham City': {
          canonicalName: 'Birmingham City',
          founded: 1875,
          nameHistory: [
            {
              name: 'Small Heath',
              startSeason: '1875',
              endSeason: '1905',
            },
            {
              name: 'Birmingham',
              startSeason: 1905,
              endSeason: 1943,
            },
          ],
          financialEvents: [
            {
              type: 'administration',
              startSeason: '2023',
              endSeason: '2024',
              seasonsMissed: ['2024', 2025, 2025],
            },
          ],
        },
      },
      seasons: {},
    });

    expect(dataset.clubs).toBeDefined();
    expect(dataset.clubs['Birmingham City']).toEqual({
      canonicalName: 'Birmingham City',
      founded: '1875',
      nameHistory: [
        {
          name: 'Small Heath',
          startSeason: 1875,
          endSeason: 1905,
        },
        {
          name: 'Birmingham',
          startSeason: 1905,
          endSeason: 1943,
        },
      ],
      financialEvents: [
        {
          type: 'administration',
          startSeason: 2023,
          endSeason: 2024,
          seasonsMissed: [2024, 2025],
        },
      ],
    });
  });
});

describe('updateFootballDataFile', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      const dir = tmpDirs.pop();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('persists tier updates and merges with existing seasons', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-data-kit-'));
    tmpDirs.push(tmpDir);
    const outputFile = path.join(tmpDir, 'output.json');

    updateFootballDataFile(
      outputFile,
      1950,
      'tier1',
      {
        season: 1950,
        table: [
          {
            pos: 1,
            team: 'Tottenham Hotspur',
            played: 42,
            won: 25,
            drawn: 10,
            lost: 7,
            goalsFor: 82,
            goalsAgainst: 44,
            goalDifference: 38,
            goalAverage: null,
            points: 60,
            notes: 'Champions',
            wasRelegated: false,
            wasPromoted: false,
            isExpansionTeam: false,
            wasReElected: false,
            wasReprieved: false,
          },
          {
            pos: 22,
            team: 'Club Example',
            played: 42,
            won: 10,
            drawn: 8,
            lost: 24,
            goalsFor: 45,
            goalsAgainst: 80,
            goalDifference: -35,
            goalAverage: null,
            points: 28,
            notes: 'Relegated to Second Division',
            wasRelegated: true,
            wasPromoted: false,
            isExpansionTeam: false,
            wasReElected: false,
            wasReprieved: false,
          },
        ],
        promoted: ['Another Club'],
        relegated: ['Club Example'],
      },
      { pretty: false }
    );

    updateFootballDataFile(
      outputFile,
      1950,
      'tier2',
      [
        {
          pos: 1,
          team: 'Promotion United',
          played: 42,
          won: 24,
          drawn: 10,
          lost: 8,
          goalsFor: 90,
          goalsAgainst: 50,
          goalDifference: 40,
          goalAverage: null,
          points: 82,
          notes: 'Promoted to First Division',
          wasPromoted: true,
          wasRelegated: false,
          isExpansionTeam: false,
          wasReElected: false,
          wasReprieved: false,
        },
      ],
      { pretty: false }
    );

    const dataset = loadFootballData(outputFile);
    expect(Object.keys(dataset.seasons)).toEqual(['1950']);

    const savedTier1 = dataset.seasons['1950'].tier1;
    expect(savedTier1.relegated).toEqual(['Club Example']);
    expect(savedTier1.promoted).toEqual(['Another Club']);

    const savedTier2 = dataset.seasons['1950'].tier2;
    expect(Array.isArray(savedTier2)).toBe(true);
    expect(savedTier2[0].team).toBe('Promotion United');
    expect(savedTier2[0].wasPromoted).toBe(true);
  });
});

describe('saveFootballData', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('writes dataset provenance metadata alongside seasons', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-data-kit-'));
    tmpDirs.push(tmpDir);
    const outputFile = path.join(tmpDir, 'output.json');
    const dataset = createFootballData({ seasons: {} });

    saveFootballData(outputFile, dataset, {
      metadata: buildDatasetMetadata({
        generator: 'wikipedia-overview',
        generatedAt: '2026-03-08T13:00:00.000Z',
        gitSha: 'def5678',
        sourceFiles: ['/tmp/a.json'],
        buildOptions: {
          startYear: 1991,
          endYear: 2024,
          ignoreWarYears: true,
        },
      }),
    });

    const reloaded = loadFootballData(outputFile);
    expect(reloaded.metadata).toMatchObject({
      schemaVersion: 1,
      generator: 'wikipedia-overview',
      generatedAt: '2026-03-08T13:00:00.000Z',
      gitSha: 'def5678',
      sourceFiles: ['/tmp/a.json'],
      buildOptions: {
        startYear: 1991,
        endYear: 2024,
        ignoreWarYears: true,
      },
    });
  });
});

describe('buildDatasetMetadata', () => {
  test('normalises source files and filters unsupported build options', () => {
    expect(
      buildDatasetMetadata({
        generator: 'wikipedia-overview',
        generatedAt: '2026-03-08T13:00:00.000Z',
        gitSha: 'def5678',
        sourceFiles: ['/tmp/a.json', '/tmp/a.json', ''],
        buildOptions: {
          startYear: 1991,
          endYear: 2024,
          ignoreWarYears: true,
          nullValue: null,
          nested: { unsupported: true },
        },
      })
    ).toEqual({
      schemaVersion: 1,
      generator: 'wikipedia-overview',
      generatedAt: '2026-03-08T13:00:00.000Z',
      gitSha: 'def5678',
      sourceFiles: ['/tmp/a.json'],
      buildOptions: {
        startYear: 1991,
        endYear: 2024,
        ignoreWarYears: true,
        nullValue: null,
      },
    });
  });
});

describe('setSeasonRecord', () => {
  test('preserves metadata fields on tier payloads', () => {
    const dataset = createFootballData();
    const seasonRecord = {
      seasonInfo: {
        season: 1955,
        table: [],
        relegated: [],
        promoted: [],
        seasonSlug: '1955–56_in_English_football',
      },
      tier1: {
        season: 1955,
        table: [
          {
            pos: 1,
            team: 'Example FC',
            played: 42,
            won: 26,
            drawn: 10,
            lost: 6,
            goalsFor: 90,
            goalsAgainst: 40,
            goalDifference: 50,
            goalAverage: null,
            points: 88,
            notes: 'Champions',
            wasRelegated: false,
            wasPromoted: false,
            isExpansionTeam: false,
            wasReElected: false,
            wasReprieved: false,
          },
        ],
        metadata: {
          source: 'wikipedia-overview',
          title: 'Premier League',
          leagueId: 'Premier_League',
          seasonSlug: '1955–56_in_English_football',
          tierKey: 'tier1',
        },
      },
    };

    setSeasonRecord(dataset, '1955', seasonRecord);
    expect(dataset.seasons['1955'].seasonInfo.seasonSlug).toBe('1955–56_in_English_football');
    expect(dataset.seasons['1955'].tier1.metadata).toMatchObject({
      title: 'Premier League',
      leagueId: 'Premier_League',
      seasonSlug: '1955–56_in_English_football',
      tierKey: 'tier1',
    });
  });
});
