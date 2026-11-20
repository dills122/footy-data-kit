import { jest } from '@jest/globals';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLowerTierSupplement } from '../builders/parse-ext-season-overview-pages.js';
import { resolveWikipediaDatasetPath } from '../config.js';
import { canonicalizeTeamName } from '../data/data-quality-config.js';
import { lowerTierFixtures } from './lower-tiers.config.js';
import { parseRequestedSources } from './source-selection.js';

jest.setTimeout(120_000);

function expectLowerTierSeason(season, fixture) {
  const {
    year,
    tables,
    promoted = {},
    relegated = {},
    rows = [],
    sourceSlug,
    titles,
    southSchedule,
  } = fixture;
  const parallelGroup =
    year < 2004
      ? 'pre-2004-conference-feeders'
      : year < 2015
      ? 'conference-north-south'
      : 'national-league-north-south';
  expect(season.tier5.metadata).toMatchObject({ tierKey: 'tier5', leagueLevel: 5 });
  expect(season.tier6.metadata).toMatchObject({
    tierKey: 'tier6',
    leagueLevel: 6,
    structure: 'parallel-leagues',
    parallelGroup,
    divisionCount: tables.length - 1,
  });
  expect(season.tier6.divisions.map((division) => division.metadata.divisionKey)).toEqual(
    tables.slice(1).map(([key]) => key)
  );
  const divisions = new Map([
    ['national', season.tier5],
    ...season.tier6.divisions.map((division) => [division.metadata.divisionKey, division]),
  ]);

  if (sourceSlug) {
    expect(season.tier6.metadata.seasonSlug).toBe(sourceSlug);
    expect(
      [...divisions.values()].map(({ metadata: { seasonSlug, title } }) => ({ seasonSlug, title }))
    ).toEqual(titles.map((title) => ({ seasonSlug: sourceSlug, title })));
  }
  if (southSchedule) {
    const southTable = divisions.get('south').table;
    expect(new Set(southTable.map(({ played }) => played))).toEqual(
      new Set([southSchedule.played])
    );
    if (southSchedule.absentClub) {
      expect(southTable.map(({ team }) => team)).not.toContain(southSchedule.absentClub);
    }
  }

  for (const [key, rowCount, champion, points, bottom] of tables) {
    const table = divisions.get(key);
    expect(table.metadata.leagueLevel).toBe(key === 'national' ? 5 : 6);
    expect(table.table).toHaveLength(rowCount);
    expect(table.table[0]).toMatchObject({ pos: 1, team: champion, points });
    expect(table.table.at(-1).team).toBe(bottom);
    if (promoted[key]) expect(table.promoted).toEqual(promoted[key]);
    if (relegated[key]) expect(table.relegated).toEqual(relegated[key]);
  }
  for (const [key, row] of rows) {
    expect(divisions.get(key).table).toEqual(
      expect.arrayContaining([expect.objectContaining(row)])
    );
  }
  expect(season.tier6.promoted).toEqual([
    ...new Set(season.tier6.divisions.flatMap((division) => division.promoted)),
  ]);
  expect(season.tier6.relegated).toEqual([
    ...new Set(season.tier6.divisions.flatMap((division) => division.relegated)),
  ]);
}

function expectConferenceRestructure(feederSeason, conferenceSeason) {
  const regionalIntake = new Set(
    conferenceSeason.tier6.divisions.flatMap((division) =>
      division.table.map((row) => canonicalizeTeamName(row.team))
    )
  );
  const nationalIntake = new Set(
    conferenceSeason.tier5.table.map((row) => canonicalizeTeamName(row.team))
  );
  const placementCounts = [];
  for (const feeder of feederSeason.tier6.divisions) {
    const placed = feeder.table.filter((row) => regionalIntake.has(canonicalizeTeamName(row.team)));
    const promoted = feeder.table.filter((row) =>
      nationalIntake.has(canonicalizeTeamName(row.team))
    );
    placementCounts.push(placed.length);
    expect(feeder.table.filter((row) => row.outcomeStatus === 'restructure-placement')).toEqual(
      placed
    );
    expect(placed.every((row) => !row.wasPromoted && !row.wasRelegated)).toBe(true);
    expect(feeder.table.filter((row) => row.wasPromoted)).toEqual(promoted);
    expect(feeder.promoted).toEqual(promoted.map((row) => row.team));
    expect(feeder.relegated).toEqual([]);
  }
  // Three of the 44 regional entrants came from outside these feeder tables.
  expect(placementCounts).toEqual([15, 13, 13]);
  expect(feederSeason.tier6.promoted).toEqual(['Crawley Town', 'Canvey Island']);
}

const requestedSources = parseRequestedSources(process.env.WIKI_TEST_SOURCE);
const describeOverview =
  !requestedSources || requestedSources.has('overview') ? describe : describe.skip;

describeOverview('Wikipedia lower-tier competition pages', () => {
  let savedSeasons;

  beforeAll(async () => {
    const input = await readFile(resolveWikipediaDatasetPath('overview'), 'utf8');
    savedSeasons = JSON.parse(input).seasons;
  });

  test.each(lowerTierFixtures)(
    '$year live and saved tier-five and level-six standings',
    async (fixture) => {
      const directory = await mkdtemp(join(tmpdir(), 'footy-lower-tier-integration-'));
      try {
        const { year, compareConferenceIntake } = fixture;
        const live = await buildLowerTierSupplement(
          year,
          compareConferenceIntake ? year + 1 : year,
          resolveWikipediaDatasetPath('overview', directory)
        );
        expectLowerTierSeason(live.seasons[year], fixture);
        expectLowerTierSeason(savedSeasons[year], fixture);
        if (compareConferenceIntake) {
          expectConferenceRestructure(live.seasons[year], live.seasons[year + 1]);
          expectConferenceRestructure(savedSeasons[year], savedSeasons[year + 1]);
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  );
});
