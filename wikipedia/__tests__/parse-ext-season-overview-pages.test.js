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

const overviewModule = await import('../parse-ext-season-overview-pages.js');
const { parseOverviewLeagueTables, buildSeasonOverview } = overviewModule;

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
          title: 'Test League',
          id: 'Test',
          tableIndex: 0,
          rows: [
            { pos: 1, team: 'Update FC', played: 30, points: 60, wasPromoted: false },
            { pos: 18, team: 'Relegated Town', played: 30, points: 10, wasRelegated: true },
          ],
        },
        {
          title: 'Second League',
          id: 'Second',
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
});
