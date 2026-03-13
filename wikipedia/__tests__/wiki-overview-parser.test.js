import * as cheerio from 'cheerio';
import {
  collectOutcomeTeams,
  deriveMajorTierIndexes,
  findLeagueSectionHeading,
  headingHasLeagueKeyword,
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
});
