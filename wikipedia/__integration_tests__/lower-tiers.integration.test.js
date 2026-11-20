import { jest } from '@jest/globals';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLowerTierSupplement } from '../builders/parse-ext-season-overview-pages.js';
import { resolveWikipediaDatasetPath } from '../config.js';
import { parseRequestedSources } from './source-selection.js';

jest.setTimeout(120_000);

// Tuples record the division key, row count, champion, points and bottom club
// from the competition tables. "national" identifies the single tier-five table.
const fixtures = [
  {
    year: 1979,
    tables: [
      ['national', 20, 'Altrincham', 56, 'Redditch United'],
      ['northern-premier', 22, 'Mossley', 65, 'Tamworth'],
      ['southern-midland', 22, 'Bridgend Town', 62, 'Corby Town'],
      ['southern-southern', 24, 'Dorchester Town', 62, 'Tonbridge Angels'],
      ['isthmian-premier', 22, 'Enfield', 84, 'Tilbury'],
    ],
    promoted: { 'southern-midland': [], 'southern-southern': [] },
  },
  {
    year: 1980,
    tables: [
      ['national', 20, 'Altrincham', 54, 'Bangor City'],
      ['northern-premier', 22, 'Runcorn', 71, 'Tamworth'],
      ['southern-midland', 22, 'Alvechurch', 61, 'Milton Keynes City'],
      ['southern-southern', 24, 'Dartford', 66, 'Andover'],
      ['isthmian-premier', 22, 'Slough Town', 82, 'Woking'],
    ],
    promoted: { 'southern-midland': ['Trowbridge Town'], 'southern-southern': ['Dartford'] },
  },
  {
    year: 1981,
    tables: [
      ['national', 22, 'Runcorn', 93, 'AP Leamington'],
      ['northern-premier', 22, 'Bangor City', 62, 'Netherfield'],
      ['southern-midland', 22, 'Nuneaton Borough', 65, 'Redditch United'],
      ['southern-southern', 24, 'Wealdstone', 72, 'Thanet United'],
      ['isthmian-premier', 22, 'Leytonstone & Ilford', 83, 'Boreham Wood'],
    ],
    promoted: { 'southern-midland': ['Nuneaton Borough'], 'southern-southern': ['Wealdstone'] },
    rows: [
      ['southern-midland', { team: 'Bedford Town', outcomeStatus: 'folded' }],
      ['southern-southern', { team: 'Thanet United', wasRelegated: true }],
    ],
  },
  {
    year: 1982,
    tables: [
      ['national', 22, 'Enfield', 84, 'Stafford Rangers'],
      ['northern-premier', 22, 'Gateshead', 100, 'Netherfield'],
      ['southern-premier', 20, 'AP Leamington', 79, 'Addlestone & Weybridge Town'],
      ['isthmian-premier', 22, 'Wycombe Wanderers', 85, 'Leatherhead'],
    ],
    promoted: { 'southern-premier': ['Kidderminster Harriers'] },
    rows: [['southern-premier', { team: 'AP Leamington', wasPromoted: false }]],
  },
  {
    year: 2003,
    tables: [
      ['national', 22, 'Chester City', 92, 'Northwich Victoria'],
      ['northern-premier', 23, 'Hucknall Town', 95, 'Wakefield & Emley'],
      ['southern-premier', 22, 'Crawley Town', 84, 'Grantham Town'],
      ['isthmian-premier', 24, 'Canvey Island', 104, 'Aylesbury United'],
    ],
    promoted: {
      national: ['Chester City', 'Shrewsbury Town'],
      'southern-premier': ['Crawley Town'],
      'isthmian-premier': ['Canvey Island'],
    },
    rows: [
      ['national', { team: 'Northwich Victoria', wasReprieved: true, outcomeStatus: 'reprieved' }],
      ['southern-premier', { team: 'Weymouth', notes: 'Qualified for the Conference South' }],
    ],
  },
  {
    year: 2004,
    tables: [
      ['national', 22, 'Barnet', 86, 'Leigh RMI'],
      ['north', 22, 'Southport', 84, 'Bradford (Park Avenue)'],
      ['south', 22, 'Grays Athletic', 98, 'Redbridge'],
    ],
    promoted: {
      national: ['Barnet', 'Carlisle United'],
      north: ['Southport', 'Altrincham'],
      south: ['Grays Athletic'],
    },
    rows: [
      ['national', { team: 'Crawley Town' }],
      ['national', { team: 'Canvey Island' }],
      ['national', { team: 'Forest Green Rovers', wasReprieved: true, outcomeStatus: 'reprieved' }],
      ['north', { team: 'Hucknall Town' }],
      ['south', { team: 'Weymouth' }],
      ['south', { team: 'Eastbourne Borough', wasPromoted: false }],
      ['south', { team: 'Maidenhead United', wasReprieved: true, outcomeStatus: 'reprieved' }],
    ],
  },
  {
    year: 2025,
    tables: [
      ['national', 24, 'York City', 108, 'Truro City'],
      ['north', 24, 'AFC Fylde', 100, 'Leamington'],
      ['south', 24, 'Worthing', 84, 'Eastbourne Borough'],
    ],
    promoted: {
      national: ['York City', 'Rochdale'],
      north: ['AFC Fylde', 'Kidderminster Harriers'],
      south: ['Worthing', 'Hornchurch'],
    },
    relegated: {
      national: ['Brackley Town', 'Morecambe', 'Braintree Town', 'Truro City'],
      north: ['Curzon Ashton', 'Alfreton Town', 'Peterborough Sports', 'Leamington'],
      south: ['Bath City', 'Chippenham Town', 'Enfield Town', 'Eastbourne Borough'],
    },
  },
];

function expectLowerTierSeason(season, fixture) {
  const { year, tables, promoted = {}, relegated = {}, rows = [] } = fixture;
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

const requestedSources = parseRequestedSources(process.env.WIKI_TEST_SOURCE);
const describeOverview =
  !requestedSources || requestedSources.has('overview') ? describe : describe.skip;

describeOverview('Wikipedia lower-tier competition pages', () => {
  let savedSeasons;

  beforeAll(async () => {
    const input = await readFile(resolveWikipediaDatasetPath('overview'), 'utf8');
    savedSeasons = JSON.parse(input).seasons;
  });

  test.each(fixtures)('$year live and saved tier-five and level-six standings', async (fixture) => {
    const directory = await mkdtemp(join(tmpdir(), 'footy-lower-tier-integration-'));
    try {
      const { year } = fixture;
      const live = await buildLowerTierSupplement(
        year,
        year,
        resolveWikipediaDatasetPath('overview', directory)
      );
      expectLowerTierSeason(live.seasons[year], fixture);
      expectLowerTierSeason(savedSeasons[year], fixture);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
