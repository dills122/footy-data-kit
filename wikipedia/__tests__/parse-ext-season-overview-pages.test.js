import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { Blob } from 'node:buffer';

if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = ReadableStream;
}
if (typeof globalThis.WritableStream === 'undefined') {
  globalThis.WritableStream = WritableStream;
}
if (typeof globalThis.TransformStream === 'undefined') {
  globalThis.TransformStream = TransformStream;
}
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = Blob;
}
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {};
}
if (typeof globalThis.FormData === 'undefined') {
  globalThis.FormData = class FormData {};
}
if (typeof globalThis.DOMException === 'undefined') {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message = '', name = 'DOMException') {
      super(message);
      this.name = name;
    }
  };
}

const overviewModule = await import('../builders/parse-ext-season-overview-pages.js');
const {
  parseOverviewLeagueTables,
  buildSeasonOverview,
  buildSeasonOverviewSeasonRecord,
  buildHistoricalSeasonPlaceholderRecord,
} = overviewModule;

function buildTableHtml(teamName, points = 30) {
  return `
  <table class="wikitable">
    <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
    <tr>
      <td>1</td>
      <th scope="row">${teamName}</th>
      <td>30</td>
      <td>${points}</td>
      <td></td>
    </tr>
  </table>`;
}

describe('parseOverviewLeagueTables', () => {
  test('parses league tables beneath the standard League tables section', () => {
    const html = `
      <div class="mw-heading mw-heading2"><h2 id="League_tables">League tables</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="First_Division">First Division</h3></div>
      ${buildTableHtml('First Division FC', 42)}
      <div class="mw-heading mw-heading3"><h3 id="Second_Division">Second Division</h3></div>
      ${buildTableHtml('Second Division FC', 35)}
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ title: 'First Division' });
    expect(result[0].rows[0]).toMatchObject({ team: 'First Division FC', points: 42 });
    expect(result[1].rows[0]).toMatchObject({ team: 'Second Division FC' });
  });

  test('falls back to parent headings when only generic "League table" headings exist', () => {
    const html = `
      <div class="mw-heading mw-heading2"><h2 id="Overview">Overview</h2></div>
      <div class="mw-heading mw-heading2"><h2 id="Football_League">The Football League</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="League_table">League table</h3></div>
      ${buildTableHtml('Fallback FC', 55)}
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('The Football League');
    expect(result[0].rows[0]).toMatchObject({ team: 'Fallback FC', points: 55 });
  });

  test('limits parsing to the Football League section when sibling Southern League tables exist', () => {
    const html = `
      <div class="mw-heading mw-heading2"><h2 id="Football_League">The Football League</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="First_Division">First Division</h3></div>
      ${buildTableHtml('First Division FC', 42)}
      <div class="mw-heading mw-heading3"><h3 id="Second_Division">Second Division</h3></div>
      ${buildTableHtml('Second Division FC', 35)}
      <div class="mw-heading mw-heading2"><h2 id="Southern_League">Southern League</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="Southern_League_First_Division">Southern League First Division</h3></div>
      ${buildTableHtml('Portsmouth', 58)}
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.title)).toEqual(['First Division', 'Second Division']);
    expect(result.some((entry) => entry.rows.some((row) => row.team === 'Portsmouth'))).toBe(false);
  });

  test('prefers Football League tables over a preceding League season narrative section', () => {
    const html = `
      <div class="mw-heading mw-heading2"><h2 id="League_season">League season</h2></div>
      <p>Everton won the First Division title during the league season.</p>
      <div class="mw-heading mw-heading2"><h2 id="Football_League">Football League</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="First_Division">First Division</h3></div>
      ${buildTableHtml('Everton', 90)}
      <div class="mw-heading mw-heading3"><h3 id="Second_Division">Second Division</h3></div>
      ${buildTableHtml('Oxford United', 80)}
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.title)).toEqual(['First Division', 'Second Division']);
    expect(result[0].rows[0]).toMatchObject({ team: 'Everton', points: 90 });
    expect(result[1].rows[0]).toMatchObject({ team: 'Oxford United', points: 80 });
  });

  test('ignores Southern League subsections beneath a generic League table root', () => {
    const html = `
      <div class="mw-heading mw-heading2"><h2 id="League_table">League table</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="First_Division">First Division</h3></div>
      ${buildTableHtml('Aston Villa', 40)}
      <div class="mw-heading mw-heading3"><h3 id="Second_Division">Second Division</h3></div>
      ${buildTableHtml('Liverpool', 39)}
      <div class="mw-heading mw-heading3"><h3 id="Southern_Football_League">Southern Football League</h3></div>
      <div class="mw-heading mw-heading4"><h4 id="Division_One">Division One</h4></div>
      ${buildTableHtml('Millwall Athletic', 34)}
      <div class="mw-heading mw-heading4"><h4 id="Division_Two">Division Two</h4></div>
      ${buildTableHtml('Luton Town', 28)}
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.title)).toEqual(['First Division', 'Second Division']);
    expect(result.some((entry) => entry.rows.some((row) => row.team === 'Millwall Athletic'))).toBe(
      false
    );
  });

  test('parses Football League sections after league changes when no League tables heading exists', () => {
    const html = `
      <div class="mw-heading mw-heading2"><h2 id="League_changes">League changes</h2></div>
      <p>Doncaster Rovers and Bristol City joined the Football League.</p>
      <div class="mw-heading mw-heading2"><h2 id="Football_League">Football League</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="First_Division">First Division</h3></div>
      ${buildTableHtml('Sunderland', 44)}
      <div class="mw-heading mw-heading3"><h3 id="Second_Division">Second Division</h3></div>
      ${buildTableHtml('West Bromwich Albion', 45)}
      <div class="mw-heading mw-heading2"><h2 id="Southern_League">Southern League</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="Southern_League_Table">League table</h3></div>
      ${buildTableHtml('Portsmouth', 40)}
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ title: 'First Division' });
    expect(result[0].rows[0]).toMatchObject({ team: 'Sunderland', points: 44 });
    expect(result[1].rows[0]).toMatchObject({ team: 'West Bromwich Albion', points: 45 });
    expect(result.some((entry) => entry.rows.some((row) => row.team === 'Portsmouth'))).toBe(false);
  });

  test('parses direct tables attached to a Football League root heading', () => {
    const html = `
      <div class="mw-heading mw-heading2"><h2 id="Football_League">Football League</h2></div>
      ${buildTableHtml('Preston North End', 33)}
      <div class="mw-heading mw-heading2"><h2 id="Football_Alliance">Football Alliance</h2></div>
      ${buildTableHtml('The Wednesday', 29)}
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: 'Football League' });
    expect(result[0].rows[0]).toMatchObject({ team: 'Preston North End', points: 33 });
  });

  test('parses older pages that use plain h2 and h3 tags instead of mw-heading wrappers', () => {
    const html = `
      <h2 id="Football_League">Football League</h2>
      <h3 id="The_Football_League">The Football League</h3>
      ${buildTableHtml('Preston North End', 40)}
      <h3 id="Football_Alliance">Football Alliance</h3>
      ${buildTableHtml('Wednesday', 32)}
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(2);
    expect(result[0].rows[0]).toMatchObject({ team: 'Preston North End', points: 40 });
    expect(result[1].title).toBe('Football Alliance');
    expect(result[1].rows[0]).toMatchObject({ team: 'Wednesday', points: 32 });
  });

  test('uses table legends to infer promotion and relegation flags', () => {
    const html = `
      <div class="mw-heading mw-heading2"><h2 id="League_tables">League tables</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="Sample_League">Sample League</h3></div>
      <table class="wikitable">
        <tr>
          <th>Pos</th><th>Team</th><th>Pld</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
        </tr>
        <tr>
          <td>1</td>
          <th scope="row">Alpha <span>(C)</span></th>
          <td>10</td><td>7</td><td>2</td><td>1</td><td>20</td><td>10</td><td>10</td><td>23</td>
        </tr>
        <tr>
          <td>2</td>
          <th scope="row">Beta <span>(P)</span></th>
          <td>10</td><td>6</td><td>3</td><td>1</td><td>18</td><td>9</td><td>9</td><td>21</td>
        </tr>
        <tr>
          <td>3</td>
          <th scope="row">Gamma <span>(R)</span></th>
          <td>10</td><td>2</td><td>1</td><td>7</td><td>8</td><td>19</td><td>-11</td><td>7</td>
        </tr>
      </table>
      <div class="sports-table-notes">
        <span>(C)</span> Champions; <span>(P)</span> Promoted; <span>(R)</span> Relegated
      </div>
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(1);
    const rows = result[0].rows;
    expect(rows[1].wasPromoted).toBe(true);
    expect(rows[2].wasRelegated).toBe(true);
  });

  test('does not suppress promotion flags for second-tier First Division when Premier League is present', () => {
    const html = `
      <div class="mw-heading mw-heading2"><h2 id="League_tables">League tables</h2></div>
      <div class="mw-heading mw-heading3"><h3 id="Premier_League">FA Premier League</h3></div>
      <table class="wikitable">
        <tr><th>Pos</th><th>Team</th><th>Pld</th><th>Pts</th></tr>
        <tr><td>1</td><th scope="row">Top Club</th><td>38</td><td>80</td></tr>
      </table>
      <div class="mw-heading mw-heading3"><h3 id="First_Division">Football League First Division</h3></div>
      <table class="wikitable">
        <tr><th>Pos</th><th>Team</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
        <tr><td>1</td><th scope="row">Norwich</th><td>46</td><td>94</td><td>Promotion to the Premier League</td></tr>
      </table>
    `;

    const result = parseOverviewLeagueTables(html);
    expect(result).toHaveLength(2);
    expect(result[1].rows[0].wasPromoted).toBe(true);
  });

  test('does not treat League One as the second tier when the Championship table is absent', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '2019',
      seasonYear: 2019,
      seasonSlug: '2019–20_in_English_football',
      tables: [
        {
          title: 'Premier League',
          id: 'Premier_League',
          tableIndex: 0,
          rows: [
            { pos: 1, team: 'Liverpool', played: 38, points: 99 },
            { pos: 20, team: 'Norwich City', played: 38, points: 21, wasRelegated: true },
          ],
        },
        {
          title: 'League One',
          id: 'League_One',
          tableIndex: 1,
          rows: [
            { pos: 1, team: 'Coventry City', played: 34, points: 67, wasPromoted: true },
            { pos: 2, team: 'Rotherham United', played: 35, points: 62, wasPromoted: true },
          ],
        },
      ],
    });

    expect(seasonRecord.seasonInfo.relegated).toEqual(['Norwich City']);
    expect(seasonRecord.seasonInfo.promoted).toEqual([]);
    expect(seasonRecord.tier1.metadata).toMatchObject({
      title: 'Premier League',
      leagueId: 'Premier_League',
      tierKey: 'tier1',
    });
    expect(seasonRecord.tier2).toBeUndefined();
    expect(seasonRecord.tier3.metadata).toMatchObject({
      title: 'League One',
      leagueId: 'League_One',
      tierKey: 'tier3',
    });
  });

  test('treats Football Alliance as the second tier before 1892 and captures election-based promotion', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '1890',
      seasonYear: 1890,
      seasonSlug: '1890–91_in_English_football',
      tables: [
        {
          title: 'The Football League',
          id: 'The_Football_League',
          tableIndex: 0,
          rows: [
            { pos: 1, team: 'Everton', played: 22, points: 29 },
            {
              pos: 12,
              team: 'Burnley',
              played: 22,
              points: 14,
              notes: 'Not re-elected to the Football League',
            },
          ],
        },
        {
          title: 'The Football Alliance',
          id: 'The_Football_Alliance',
          tableIndex: 1,
          rows: [
            {
              pos: 1,
              team: 'Stoke',
              played: 22,
              points: 33,
              notes: 'Elected to the Football League',
            },
          ],
        },
      ],
    });

    expect(seasonRecord.seasonInfo.promoted).toEqual(['Stoke']);
    expect(seasonRecord.seasonInfo.relegated).toEqual(['Burnley']);
    expect(seasonRecord.tier1.relegated).toEqual(['Burnley']);
    expect(seasonRecord.tier2.promoted).toEqual(['Stoke']);
    expect(seasonRecord.tier2.metadata).toMatchObject({
      title: 'The Football Alliance',
      leagueId: 'The_Football_Alliance',
      tierKey: 'tier2',
    });
  });

  test('does not treat election to the Second Division as top-flight promotion', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '1891',
      seasonYear: 1891,
      seasonSlug: '1891–92_in_English_football',
      tables: [
        {
          title: 'The Football League',
          id: 'The_Football_League',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Sunderland', played: 26, points: 42 }],
        },
        {
          title: 'The Football Alliance',
          id: 'The_Football_Alliance',
          tableIndex: 1,
          rows: [
            {
              pos: 1,
              team: 'Sheffield United',
              played: 22,
              points: 35,
              notes: 'Elected to the Football League Second Division',
            },
          ],
        },
      ],
    });

    expect(seasonRecord.seasonInfo.promoted).toEqual([]);
    expect(seasonRecord.tier2.promoted).toEqual([]);
  });

  test('keeps the single 1888 Football League table as tier1', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '1888',
      seasonYear: 1888,
      seasonSlug: '1888–89_in_English_football',
      tables: [
        {
          title: 'The Football League',
          id: 'The_Football_League',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Preston North End', played: 22, points: 40 }],
        },
      ],
    });

    expect(seasonRecord.tier1.metadata).toMatchObject({
      title: 'The Football League',
      leagueId: 'The_Football_League',
      tierKey: 'tier1',
    });
    expect(seasonRecord.tier2).toBeUndefined();
    expect(seasonRecord.seasonInfo.promoted).toEqual([]);
    expect(seasonRecord.seasonInfo.relegated).toEqual([]);
  });

  test('stores regional third divisions as parallel level-3 divisions after 1921', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '1921',
      seasonYear: 1921,
      seasonSlug: '1921–22_in_English_football',
      tables: [
        {
          title: 'First Division',
          id: 'First_Division',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Liverpool', played: 42, points: 61 }],
        },
        {
          title: 'Second Division',
          id: 'Second_Division',
          tableIndex: 1,
          rows: [{ pos: 1, team: 'Notts County', played: 42, points: 58, wasPromoted: true }],
        },
        {
          title: 'Third Division North',
          id: 'Third_Division_North',
          tableIndex: 2,
          rows: [{ pos: 1, team: 'Stockport County', played: 38, points: 53 }],
        },
        {
          title: 'Third Division South',
          id: 'Third_Division_South',
          tableIndex: 3,
          rows: [{ pos: 1, team: 'Plymouth Argyle', played: 38, points: 54 }],
        },
      ],
    });

    expect(seasonRecord.tier3.metadata).toMatchObject({
      structure: 'parallel-leagues',
      leagueLevel: 3,
      parallelGroup: 'third-division-north-south',
      divisionCount: 2,
      tierKey: 'tier3',
    });
    expect(seasonRecord.tier3.table).toEqual([]);
    expect(seasonRecord.tier3.divisions).toHaveLength(2);
    expect(seasonRecord.tier3.divisions[0].metadata).toMatchObject({
      title: 'Third Division North',
      divisionKey: 'north',
      tierKey: 'tier3',
    });
    expect(seasonRecord.tier3.divisions[1].metadata).toMatchObject({
      title: 'Third Division South',
      divisionKey: 'south',
      tierKey: 'tier3',
    });
    expect(seasonRecord.tier4).toBeUndefined();
    expect(seasonRecord.seasonInfo.leagueStructureSpecialCases).toEqual([
      expect.objectContaining({
        type: 'parallel-regional-level',
        tierKeys: ['tier3', 'tier4'],
      }),
    ]);
  });

  test('annotates the 1957 regional-to-national tier restructure season', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '1957',
      seasonYear: 1957,
      seasonSlug: '1957–58_in_English_football',
      tables: [
        {
          title: 'First Division',
          id: 'First_Division',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Wolverhampton Wanderers', played: 42, points: 64 }],
        },
        {
          title: 'Second Division',
          id: 'Second_Division',
          tableIndex: 1,
          rows: [{ pos: 1, team: 'West Ham United', played: 42, points: 57 }],
        },
        {
          title: 'Third Division North',
          id: 'Third_Division_North',
          tableIndex: 2,
          rows: [
            { pos: 1, team: 'Scunthorpe & Lindsey United', played: 46, points: 66 },
            {
              pos: 13,
              team: 'Bradford City',
              played: 46,
              points: 48,
              notes: 'Relegation to the Fourth Division',
            },
          ],
        },
        {
          title: 'Third Division South',
          id: 'Third_Division_South',
          tableIndex: 3,
          rows: [
            { pos: 1, team: 'Brighton & Hove Albion', played: 46, points: 60 },
            {
              pos: 24,
              team: 'Southend United',
              played: 46,
              points: 32,
              notes: 'Re-elected to the Fourth Division',
            },
          ],
        },
      ],
    });

    expect(seasonRecord.tier3.metadata).toMatchObject({
      structure: 'parallel-leagues',
      leagueLevel: 3,
      parallelGroup: 'third-division-north-south',
    });
    expect(seasonRecord.tier3.divisions.map((division) => division.metadata.divisionKey)).toEqual([
      'north',
      'south',
    ]);
    expect(seasonRecord.tier3.relegated).toEqual([]);
    expect(seasonRecord.tier3.divisions.map((division) => division.relegated)).toEqual([[], []]);
    expect(
      seasonRecord.tier3.divisions[0].table.find((row) => row.team === 'Bradford City')
    ).toMatchObject({
      notes: 'Relegation to the Fourth Division',
      wasRelegated: false,
    });
    expect(
      seasonRecord.tier3.divisions[1].table.find((row) => row.team === 'Southend United')
    ).toMatchObject({
      notes: 'Re-elected to the Fourth Division',
      wasRelegated: false,
    });
    expect(seasonRecord.tier4).toBeUndefined();
    expect(seasonRecord.seasonInfo.leagueStructureSpecialCases).toEqual([
      expect.objectContaining({
        type: 'restructure-placement',
        levels: [3, 4],
      }),
    ]);
  });

  test('annotates the 2004 League One and League Two rebrand boundary', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '2004',
      seasonYear: 2004,
      seasonSlug: '2004–05_in_English_football',
      tables: [
        {
          title: 'FA Premier League',
          id: 'FA_Premier_League',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Chelsea', played: 38, points: 95 }],
        },
        {
          title: 'Football League Championship',
          id: 'Football_League_Championship',
          tableIndex: 1,
          rows: [{ pos: 1, team: 'Sunderland', played: 46, points: 94 }],
        },
        {
          title: 'Football League One',
          id: 'Football_League_One',
          tableIndex: 2,
          rows: [{ pos: 1, team: 'Luton Town', played: 46, points: 98 }],
        },
        {
          title: 'Football League Two',
          id: 'Football_League_Two',
          tableIndex: 3,
          rows: [{ pos: 1, team: 'Yeovil Town', played: 46, points: 83 }],
        },
      ],
    });

    expect(seasonRecord.tier3.metadata).toMatchObject({
      title: 'Football League One',
      leagueLevel: 3,
    });
    expect(seasonRecord.tier4.metadata).toMatchObject({
      title: 'Football League Two',
      leagueLevel: 4,
    });
    expect(seasonRecord.seasonInfo.leagueStructureSpecialCases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'efl-rebrand' }),
        expect.objectContaining({ type: 'national-league-system-restructure' }),
      ])
    );
  });

  test('stores National League North and South as parallel level 6 tables', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '2021',
      seasonYear: 2021,
      seasonSlug: '2021–22_in_English_football',
      tables: [
        {
          title: 'Premier League',
          id: 'Premier_League',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Manchester City', played: 38, points: 93 }],
        },
        {
          title: 'Championship',
          id: 'Championship',
          tableIndex: 1,
          rows: [{ pos: 1, team: 'Fulham', played: 46, points: 90 }],
        },
        {
          title: 'League One',
          id: 'League_One',
          tableIndex: 2,
          rows: [{ pos: 1, team: 'Wigan Athletic', played: 46, points: 92 }],
        },
        {
          title: 'League Two',
          id: 'League_Two',
          tableIndex: 3,
          rows: [{ pos: 1, team: 'Forest Green Rovers', played: 46, points: 84 }],
        },
        {
          title: 'National League',
          id: 'National_League',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Stockport County', played: 44, points: 94 }],
        },
        {
          title: 'National League',
          id: 'National_League',
          tableIndex: 1,
          rows: [{ pos: 1, team: 'Gateshead', played: 42, points: 94 }],
        },
        {
          title: 'National League',
          id: 'National_League',
          tableIndex: 2,
          rows: [{ pos: 1, team: 'Maidstone United', played: 40, points: 87 }],
        },
      ],
    });

    expect(seasonRecord.tier6.metadata).toMatchObject({
      structure: 'parallel-leagues',
      leagueLevel: 6,
      parallelGroup: 'national-league-north-south',
      divisionCount: 2,
    });
    expect(seasonRecord.tier6.divisions.map((division) => division.metadata.divisionKey)).toEqual([
      'north',
      'south',
    ]);
    expect(seasonRecord.tier7).toBeUndefined();
  });

  test('keeps pre-war four-division seasons aligned with second-tier top-flight movement', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '1936',
      seasonYear: 1936,
      seasonSlug: '1936–37_in_English_football',
      tables: [
        {
          title: 'First Division',
          id: 'First_Division',
          tableIndex: 0,
          rows: [
            { pos: 1, team: 'Manchester City', played: 42, points: 57 },
            { pos: 21, team: 'Manchester United', played: 42, points: 29, wasRelegated: true },
          ],
        },
        {
          title: 'Second Division',
          id: 'Second_Division',
          tableIndex: 1,
          rows: [
            { pos: 1, team: 'Leicester City', played: 42, points: 55, wasPromoted: true },
            { pos: 2, team: 'Blackburn Rovers', played: 42, points: 52, wasPromoted: true },
          ],
        },
        {
          title: 'Third Division North',
          id: 'Third_Division_North',
          tableIndex: 2,
          rows: [{ pos: 1, team: 'Stockport County', played: 42, points: 58, wasPromoted: true }],
        },
        {
          title: 'Third Division South',
          id: 'Third_Division_South',
          tableIndex: 3,
          rows: [{ pos: 1, team: 'Ipswich Town', played: 42, points: 56, wasPromoted: true }],
        },
      ],
    });

    expect(seasonRecord.seasonInfo.promoted).toEqual(['Leicester City', 'Blackburn Rovers']);
    expect(seasonRecord.seasonInfo.relegated).toEqual(['Manchester United']);
    expect(seasonRecord.tier2.promoted).toEqual(['Leicester City', 'Blackburn Rovers']);
    expect(seasonRecord.tier3.metadata).toMatchObject({
      structure: 'parallel-leagues',
      leagueLevel: 3,
      tierKey: 'tier3',
    });
    expect(seasonRecord.tier3.divisions.map((division) => division.metadata.title)).toEqual([
      'Third Division North',
      'Third Division South',
    ]);
    expect(seasonRecord.tier4).toBeUndefined();
  });

  test('applies config-driven overview outcome overrides for the 1989 Swindon disqualification case', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '1989',
      seasonYear: 1989,
      seasonSlug: '1989–90_in_English_football',
      tables: [
        {
          title: 'First Division',
          id: 'First_Division',
          tableIndex: 0,
          rows: [
            { pos: 18, team: 'Sheffield Wednesday', played: 38, points: 43, wasRelegated: true },
            { pos: 19, team: 'Charlton Athletic', played: 38, points: 30, wasRelegated: true },
            { pos: 20, team: 'Millwall', played: 38, points: 26, wasRelegated: true },
          ],
        },
        {
          title: 'Second Division',
          id: 'Second_Division',
          tableIndex: 1,
          rows: [
            { pos: 1, team: 'Leeds United', played: 46, points: 85, wasPromoted: true },
            { pos: 2, team: 'Sheffield United', played: 46, points: 85, wasPromoted: true },
            {
              pos: 4,
              team: 'Swindon Town',
              played: 46,
              points: 74,
              notes: 'Qualification for the Second Division play-offs',
              wasPromoted: true,
            },
            {
              pos: 6,
              team: 'Sunderland',
              played: 46,
              points: 74,
              notes: 'Qualification for the Second Division play-offs',
              wasPromoted: false,
            },
          ],
        },
      ],
    });

    expect(seasonRecord.seasonInfo.promoted).toEqual([
      'Leeds United',
      'Sheffield United',
      'Sunderland',
    ]);
    expect(seasonRecord.tier2.promoted).toEqual(['Leeds United', 'Sheffield United', 'Sunderland']);
    const swindon = seasonRecord.tier2.table.find((row) => row.team === 'Swindon Town');
    const sunderland = seasonRecord.tier2.table.find((row) => row.team === 'Sunderland');
    expect(swindon.wasPromoted).toBe(false);
    expect(sunderland.wasPromoted).toBe(true);
  });

  test('applies config-driven administrative outcome overrides for 2019 League Two', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '2019',
      seasonYear: 2019,
      seasonSlug: '2019–20_in_English_football',
      tables: [
        {
          title: 'Premier League',
          id: 'Premier_League',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Liverpool', played: 38, points: 99 }],
        },
        {
          title: 'Championship',
          id: 'Championship',
          tableIndex: 1,
          rows: [{ pos: 1, team: 'Leeds United', played: 46, points: 93 }],
        },
        {
          title: 'League One',
          id: 'League_One',
          tableIndex: 2,
          rows: [
            { pos: 1, team: 'Coventry City', played: 34, points: 67, wasPromoted: true },
            { pos: 24, team: 'Bury', played: 0, points: 0, wasRelegated: true },
          ],
        },
        {
          title: 'League Two',
          id: 'League_Two',
          tableIndex: 3,
          rows: [
            { pos: 23, team: 'Stevenage', played: 36, points: 35, wasRelegated: true },
            { pos: 24, team: 'Macclesfield Town', played: 37, points: 23, wasRelegated: true },
          ],
        },
      ],
    });

    expect(seasonRecord.tier4.relegated).toEqual(['Macclesfield Town']);
    expect(seasonRecord.tier4.table.find((row) => row.team === 'Stevenage')).toMatchObject({
      wasRelegated: false,
      outcomeStatus: 'reprieved',
    });
    expect(seasonRecord.tier4.table.find((row) => row.team === 'Macclesfield Town')).toMatchObject({
      wasRelegated: true,
      outcomeStatus: 'relegated-after-points-deduction',
    });
    expect(seasonRecord.seasonInfo.leagueStructureSpecialCases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'covid-curtailed-season' }),
        expect.objectContaining({ type: 'administrative-outcome' }),
      ])
    );
  });

  test('publishes canonical tier titles when overview headings are generic', () => {
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey: '2012',
      seasonYear: 2012,
      seasonSlug: '2012–13_in_English_football',
      tables: [
        {
          title: 'League tables',
          id: 'League_table',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Premier FC', played: 38, points: 89 }],
        },
        {
          title: 'League tables',
          id: 'League_table_2',
          tableIndex: 1,
          rows: [{ pos: 1, team: 'Championship FC', played: 46, points: 87 }],
        },
        {
          title: 'League tables',
          id: 'League_table_3',
          tableIndex: 2,
          rows: [{ pos: 1, team: 'League One FC', played: 46, points: 84 }],
        },
        {
          title: 'League tables',
          id: 'League_table_4',
          tableIndex: 3,
          rows: [{ pos: 1, team: 'League Two FC', played: 46, points: 83 }],
        },
        {
          title: 'League tables',
          id: 'League_table_5',
          tableIndex: 4,
          rows: [{ pos: 1, team: 'Conference FC', played: 46, points: 82 }],
        },
      ],
    });

    expect(seasonRecord.tier1.metadata).toMatchObject({
      title: 'Premier League',
      leagueId: 'League_table',
      leagueLevel: 1,
    });
    expect(seasonRecord.tier2.metadata.title).toBe('Championship');
    expect(seasonRecord.tier3.metadata.title).toBe('League One');
    expect(seasonRecord.tier4.metadata.title).toBe('League Two');
    expect(seasonRecord.tier5.metadata.title).toBe('Conference Premier');
  });

  test('builds metadata-only placeholder records for abandoned and bridge seasons', () => {
    const abandoned = buildHistoricalSeasonPlaceholderRecord('1939', '1939–40_in_English_football');
    const bridge = buildHistoricalSeasonPlaceholderRecord('1945', '1945–46_in_English_football');

    expect(abandoned.seasonInfo).toMatchObject({
      competitionStatus: 'abandoned-season',
      officialLeagueTables: false,
      officialCompetitionsAbandoned: true,
      seasonSlug: '1939–40_in_English_football',
    });
    expect(bridge.seasonInfo).toMatchObject({
      competitionStatus: 'regional-bridge-season',
      regionalBridgeSeason: true,
      promotionRelegationApplies: false,
      specialCompetitions: ['Football League North', 'Football League South'],
    });
    expect(bridge.tier1).toBeUndefined();
  });
});

describe('buildSeasonOverview', () => {
  const tmpDirs = [];

  function createTempFile(initialData = { seasons: {} }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-overview-test-'));
    tmpDirs.push(dir);
    const filePath = path.join(dir, 'overview.json');
    fs.writeFileSync(filePath, JSON.stringify(initialData));
    return filePath;
  }

  afterAll(() => {
    tmpDirs.forEach((dir) => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('skips seasons with existing tier data when updateOnly is true', async () => {
    const existingSeason = {
      seasonInfo: { seasonSlug: '1900-01', tableCount: 1 },
      tier1: { table: [{ team: 'Legacy FC' }] },
    };
    const outputFile = createTempFile({ seasons: { 1900: existingSeason } });
    const mockTablesBySlug = {
      '1901–02_in_English_football': [
        {
          title: 'Premier League',
          id: 'Premier_League',
          tableIndex: 0,
          rows: [
            { pos: 1, team: 'Update FC', played: 30, points: 60, wasPromoted: false },
            { pos: 18, team: 'Relegated Town', played: 30, points: 10, wasRelegated: true },
          ],
        },
        {
          title: 'Championship',
          id: 'Championship',
          tableIndex: 1,
          rows: [
            { pos: 1, team: 'Rising Club', played: 30, points: 70, wasPromoted: true },
            { pos: 2, team: 'Runner Up', played: 30, points: 65 },
          ],
        },
      ],
    };
    const fetchTables = jest.fn(async (slug) => {
      if (!mockTablesBySlug[slug]) {
        throw new Error(`Unexpected slug requested: ${slug}`);
      }
      return mockTablesBySlug[slug];
    });

    await buildSeasonOverview(1900, 1901, outputFile, {
      updateOnly: true,
      fetchSeasonOverviewTables: fetchTables,
    });

    expect(fetchTables).toHaveBeenCalledTimes(1);
    expect(fetchTables).toHaveBeenCalledWith('1901–02_in_English_football');

    const finalData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(finalData.seasons['1900'].tier1.table[0].team).toBe('Legacy FC');
    const season1901 = finalData.seasons['1901'];
    expect(season1901.tier1.table[0].team).toBe('Update FC');
    expect(season1901.seasonInfo.promoted).toEqual(['Rising Club']);
    expect(season1901.seasonInfo.relegated).toEqual(['Relegated Town']);
    expect(season1901.seasonInfo.table).toEqual([]);
    expect(season1901.tier1.metadata).toMatchObject({
      source: 'wikipedia-overview',
      sourceUrl: 'https://en.wikipedia.org/wiki/1901–02_in_English_football',
      title: 'Premier League',
      leagueId: 'Premier_League',
      tableIndex: 0,
      tableCount: 2,
      seasonSlug: '1901–02_in_English_football',
      tierKey: 'tier1',
    });
  });

  test('skips WWI/WWII suspension years when ignoreWarYears is true', async () => {
    const outputFile = createTempFile();
    const mockTablesBySlug = {
      '1914–15_in_English_football': [
        {
          title: 'League',
          id: 'League',
          tableIndex: 0,
          rows: [
            { pos: 1, team: 'Pre-War FC', played: 30, points: 50, wasPromoted: false },
            { pos: 20, team: 'Wartime Wanderers', played: 30, points: 5, wasRelegated: true },
          ],
        },
      ],
    };
    const fetchTables = jest.fn(async (slug) => {
      if (!mockTablesBySlug[slug]) {
        throw new Error(`Unexpected slug requested: ${slug}`);
      }
      return mockTablesBySlug[slug];
    });

    await buildSeasonOverview(1914, 1916, outputFile, {
      ignoreWarYears: true,
      fetchSeasonOverviewTables: fetchTables,
    });

    expect(fetchTables).toHaveBeenCalledTimes(1);
    expect(fetchTables).toHaveBeenCalledWith('1914–15_in_English_football');

    const finalData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(Object.keys(finalData.seasons)).toEqual(['1914']);
    expect(finalData.seasons['1914'].seasonInfo.relegated).toEqual(['Wartime Wanderers']);
  });

  test('can emit historical placeholders for wartime and bridge seasons', async () => {
    const outputFile = createTempFile({ seasons: {} });
    const fetchTables = jest.fn(async (slug) => {
      if (slug !== '1946–47_in_English_football') {
        throw new Error(`Unexpected slug requested: ${slug}`);
      }
      return [
        {
          title: 'First Division',
          id: 'First_Division',
          tableIndex: 0,
          rows: [{ pos: 1, team: 'Liverpool', played: 42, points: 57 }],
        },
      ];
    });

    await buildSeasonOverview(1939, 1946, outputFile, {
      includeWarPlaceholders: true,
      ignoreWarYears: false,
      fetchSeasonOverviewTables: fetchTables,
    });

    const finalData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(finalData.seasons['1939'].seasonInfo).toMatchObject({
      competitionStatus: 'abandoned-season',
      officialCompetitionsAbandoned: true,
    });
    expect(finalData.seasons['1940'].seasonInfo).toMatchObject({
      competitionStatus: 'wartime-special',
      officialCompetitionsSuspended: true,
    });
    expect(finalData.seasons['1945'].seasonInfo).toMatchObject({
      competitionStatus: 'regional-bridge-season',
      promotionRelegationApplies: false,
    });
    expect(finalData.seasons['1946'].tier1.table[0].team).toBe('Liverpool');
    expect(fetchTables).toHaveBeenCalledTimes(1);
  });

  test('does not write empty non-placeholder seasons when no overview tables are returned', async () => {
    const outputFile = createTempFile({ seasons: {} });
    const fetchTables = jest.fn(async () => []);

    await buildSeasonOverview(1946, 1946, outputFile, {
      fetchSeasonOverviewTables: fetchTables,
    });

    const finalData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(finalData.seasons['1946']).toBeUndefined();
  });
});
