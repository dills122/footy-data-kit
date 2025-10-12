import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  normaliseLeagueTableEntry,
  createFootballData,
  updateFootballDataFile,
  loadFootballData,
  setSeasonRecord,
} from '../generate-output-files.js';

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
    expect(entry.goalDifference).toBeNull();
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
        title: 'Premier League',
        leagueId: 'Premier_League',
        seasonSlug: '1955–56_in_English_football',
      },
    };

    setSeasonRecord(dataset, '1955', seasonRecord);
    expect(dataset.seasons['1955'].seasonInfo.seasonSlug).toBe('1955–56_in_English_football');
    expect(dataset.seasons['1955'].tier1.title).toBe('Premier League');
  });
});
