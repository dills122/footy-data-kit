import * as cheerio from 'cheerio';
import {
  collectOutcomeTeams,
  deriveMajorTierIndexes,
  findLeagueSectionHeading,
  headingHasLeagueKeyword,
  inferOverviewTierNumber,
  isExcludedOverviewCompetitionLabel,
  parseOverviewTablesForHeading,
} from '../parser-core/wiki-overview-parser.js';

describe('wiki-overview-parser', () => {
  test('locates league section headings using heuristic scoring', () => {
    const html = `
      <h2 id="Intro">Season details</h2>
      <h2 id="League_tables">League tables</h2>
      <h2 id="Other">League season</h2>
    `;
    const $ = cheerio.load(html);

    const heading = findLeagueSectionHeading($);
    expect(heading?.length).toBe(1);
    expect(heading.attr('id')).toBe('League_tables');
  });

  test('prefers Football League as the root section when no League tables heading exists', () => {
    const html = `
      <h2 id="Honours">Honours</h2>
      <h2 id="Football_League">The Football League</h2>
      <h2 id="Southern_League">Southern League</h2>
    `;
    const $ = cheerio.load(html);

    const heading = findLeagueSectionHeading($);
    expect(heading?.length).toBe(1);
    expect(heading.attr('id')).toBe('Football_League');
  });

  test('prefers Football League over a generic League season section', () => {
    const html = `
      <h2 id="League_season">League season</h2>
      <h2 id="Football_League">Football League</h2>
    `;
    const $ = cheerio.load(html);

    const heading = findLeagueSectionHeading($);
    expect(heading?.length).toBe(1);
    expect(heading.attr('id')).toBe('Football_League');
  });

  test('builds parsed table entries with suppressed promotion flags for top flight', () => {
    const html = `
      <div class="mw-heading mw-heading3"><h3 id="Premier_League">Premier League</h3></div>
      <table class="wikitable">
        <tr><th>Pos</th><th>Team</th><th>Pts</th><th>Notes</th></tr>
        <tr><td>1</td><th scope="row">League FC</th><td>99</td><td></td></tr>
      </table>
    `;
    const $ = cheerio.load(html);
    const headingWrapper = $('.mw-heading');
    const entries = parseOverviewTablesForHeading($, headingWrapper, undefined, {
      hasPremierLeagueHeading: true,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      title: 'Premier League',
      id: 'Premier_League',
      tableIndex: 0,
      isTopFlight: true,
    });
    expect(entries[0].rows[0]).toMatchObject({ team: 'League FC' });
  });

  test('builds parsed table entries from plain heading tags', () => {
    const html = `
      <h3 id="Football_League">The Football League</h3>
      <table class="wikitable">
        <tr><th>Pos</th><th>Team</th><th>Pts</th></tr>
        <tr><td>1</td><th scope="row">Preston North End</th><td>40</td></tr>
      </table>
    `;
    const $ = cheerio.load(html);
    const heading = $('h3').first();
    const entries = parseOverviewTablesForHeading($, heading, undefined, {});

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      title: 'The Football League',
      id: 'Football_League',
      tableIndex: 0,
    });
    expect(entries[0].rows[0]).toMatchObject({ team: 'Preston North End', points: 40 });
  });

  test('deriveMajorTierIndexes detects top flight and second tier tables', () => {
    const tables = [
      { title: 'Premier League', rows: [{}, {}], isTopFlight: true },
      { title: 'Championship', rows: [{}], isTopFlight: false },
      { title: 'League One', rows: [{}] },
    ];

    const result = deriveMajorTierIndexes(tables);
    expect(result.topFlightIndex).toBe(0);
    expect(result.secondTierIndex).toBe(1);
  });

  test('deriveMajorTierIndexes treats Football Alliance as tier 2 before 1892', () => {
    const tables = [
      { title: 'The Football League', rows: [{ team: 'Everton' }], season: 1890 },
      { title: 'The Football Alliance', rows: [{ team: 'Stoke' }], season: 1890 },
      { title: 'Southern League', rows: [{ team: 'Example Town' }], season: 1890 },
    ];

    const result = deriveMajorTierIndexes(tables);
    expect(result.topFlightIndex).toBe(0);
    expect(result.secondTierIndex).toBe(1);
  });

  test('infers historically renamed tier 3 and tier 4 league levels', () => {
    expect(
      inferOverviewTierNumber({ title: 'Third Division South', id: 'Third_Division_South' }, 1957)
    ).toBe(3);
    expect(inferOverviewTierNumber({ title: 'Fourth Division', id: 'Fourth_Division' }, 1958)).toBe(
      4
    );
    expect(
      inferOverviewTierNumber(
        { title: 'Football League Second Division', id: 'Football_League_Second_Division' },
        2003
      )
    ).toBe(3);
    expect(
      inferOverviewTierNumber({ title: 'Football League One', id: 'Football_League_One' }, 2004)
    ).toBe(3);
    expect(inferOverviewTierNumber({ title: 'League Two', id: 'League_Two' }, 2021)).toBe(4);
  });

  test('infers parallel National League North and South as level 6', () => {
    expect(
      inferOverviewTierNumber({ title: 'National League North', id: 'National_League_North' }, 2021)
    ).toBe(6);
    expect(inferOverviewTierNumber({ title: 'South', id: 'South' }, 2025)).toBe(6);
    expect(
      inferOverviewTierNumber(
        { title: 'Northern Premier League Premier Division', id: 'Northern_Premier_League' },
        2025
      )
    ).toBe(7);
  });

  test('collectOutcomeTeams filters by selected indexes and flags', () => {
    const tables = [
      { title: 'Division one', rows: [{ team: 'A', wasRelegated: true }, { team: 'B' }] },
      { title: 'Division two', rows: [{ team: 'C', wasRelegated: true }, { team: 'D' }] },
    ];

    expect(collectOutcomeTeams(tables, 'wasRelegated')).toEqual(['A', 'C']);
    expect(collectOutcomeTeams(tables, 'wasRelegated', { includeIndexes: [1] })).toEqual(['C']);
  });

  test('recognizes league heading keywords', () => {
    expect(headingHasLeagueKeyword('League table')).toBe(true);
    expect(headingHasLeagueKeyword('Something else')).toBe(false);
  });

  test('recognizes excluded non-football-league competition labels', () => {
    expect(isExcludedOverviewCompetitionLabel('Southern Football League', 'Division One')).toBe(
      true
    );
    expect(isExcludedOverviewCompetitionLabel('Football League', 'First Division')).toBe(false);
  });
});
