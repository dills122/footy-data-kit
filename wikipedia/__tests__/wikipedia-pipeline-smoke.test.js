import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { Blob } from 'node:buffer';
import { buildPromotionRelegation } from '../parse-season-pages.js';
import { buildSeasonOverview } from '../parse-ext-season-overview-pages.js';
import { combineFootballDataFiles } from '../combine-output-files.js';
import { analyzeFile } from '../verify-football-data.js';

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

let wikipediaModule = await import('wikipedia');
let wikipedia = wikipediaModule.default ?? wikipediaModule;

if (typeof wikipedia.page === 'undefined' && typeof wikipedia.html === 'function') {
  try {
    if (wikipediaModule.default && typeof wikipediaModule.default === 'object') {
      wikipediaModule.default.page = async (title, opts) => ({
        html: async () => wikipediaModule.default.html(title, opts),
      });
      wikipedia = wikipediaModule.default;
    } else if (typeof wikipediaModule === 'object') {
      wikipediaModule.page = async (title, opts) => ({
        html: async () => wikipediaModule.html(title, opts),
      });
      wikipedia = wikipediaModule;
    }
  } catch (error) {
    // best-effort compatibility shim for test environments
  }
}

describe('wikipedia pipeline smoke test', () => {
  const tmpDirs = [];

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('builds promotion and overview data, combines outputs, and verifies the merged file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-pipeline-smoke-'));
    tmpDirs.push(tmpDir);

    const outputDir = path.join(tmpDir, 'data-output');
    const promoOutput = path.join(outputDir, 'wiki_promotion_relegations_by_season.json');
    const overviewOutput = path.join(outputDir, 'wiki_overview_tables_by_season.json');
    const combinedOutput = path.join(outputDir, 'all-seasons.json');

    const promotionHtml = `
      <div>
        <div><span id="First_Division"></span></div>
        <div class="wikitable">
          <table>
            <tr><th>Pos</th><th>Club</th><th>Pld</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th><th>Notes</th></tr>
            <tr><td>1</td><th scope="row"><a>Club A</a></th><td>30</td><td>20</td><td>5</td><td>5</td><td>60</td><td>30</td><td>45</td><td></td></tr>
            <tr><td>2</td><th scope="row"><a>Club B</a></th><td>30</td><td>18</td><td>4</td><td>8</td><td>55</td><td>34</td><td>40</td><td>Relegated</td></tr>
          </table>
        </div>
        <div><span id="Second_Division"></span></div>
        <div class="wikitable">
          <table>
            <tr><th>Pos</th><th>Club</th><th>Pld</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th><th>Notes</th></tr>
            <tr><td>1</td><th scope="row"><a>Club C</a></th><td>30</td><td>21</td><td>4</td><td>5</td><td>58</td><td>28</td><td>46</td><td>Promoted</td></tr>
            <tr><td>2</td><th scope="row"><a>Club D</a></th><td>30</td><td>19</td><td>3</td><td>8</td><td>50</td><td>30</td><td>41</td><td></td></tr>
          </table>
        </div>
      </div>
    `;

    jest.spyOn(wikipedia, 'page').mockResolvedValue({
      html: jest.fn().mockResolvedValue(promotionHtml),
    });

    jest.useFakeTimers();
    const buildPromise = buildPromotionRelegation(1897, 1897, promoOutput);
    await jest.runAllTimersAsync();
    await buildPromise;

    await buildSeasonOverview(1993, 1993, overviewOutput, {
      fetchSeasonOverviewTables: async () => [
        {
          title: 'Premier League',
          id: 'Premier_League',
          tableIndex: 0,
          rows: [
            {
              pos: 1,
              team: 'Top Club',
              played: 42,
              won: 28,
              drawn: 8,
              lost: 6,
              goalsFor: 79,
              goalsAgainst: 35,
              goalDifference: 44,
              goalAverage: null,
              points: 92,
              notes: null,
              wasRelegated: false,
              wasPromoted: false,
              isExpansionTeam: false,
              wasReElected: false,
              wasReprieved: false,
            },
            {
              pos: 2,
              team: 'Bottom Club',
              played: 42,
              won: 6,
              drawn: 10,
              lost: 26,
              goalsFor: 30,
              goalsAgainst: 70,
              goalDifference: -40,
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
        },
        {
          title: 'First Division',
          id: 'First_Division',
          tableIndex: 1,
          rows: [
            {
              pos: 1,
              team: 'Rising Club',
              played: 46,
              won: 28,
              drawn: 10,
              lost: 8,
              goalsFor: 80,
              goalsAgainst: 40,
              goalDifference: 40,
              goalAverage: null,
              points: 94,
              notes: null,
              wasRelegated: false,
              wasPromoted: true,
              isExpansionTeam: false,
              wasReElected: false,
              wasReprieved: false,
            },
            {
              pos: 2,
              team: 'Runner Up',
              played: 46,
              won: 25,
              drawn: 12,
              lost: 9,
              goalsFor: 72,
              goalsAgainst: 44,
              goalDifference: 28,
              goalAverage: null,
              points: 87,
              notes: null,
              wasRelegated: false,
              wasPromoted: false,
              isExpansionTeam: false,
              wasReElected: false,
              wasReprieved: false,
            },
          ],
        },
      ],
    });

    expect(fs.existsSync(promoOutput)).toBe(true);
    expect(fs.existsSync(overviewOutput)).toBe(true);

    combineFootballDataFiles({
      inputs: [overviewOutput, promoOutput],
      output: combinedOutput,
      cwd: process.cwd(),
    });

    expect(fs.existsSync(combinedOutput)).toBe(true);

    const combined = JSON.parse(fs.readFileSync(combinedOutput, 'utf8'));
    expect(Object.keys(combined.seasons)).toEqual(['1897', '1993']);
    expect(combined.seasons['1897'].seasonInfo.promoted).toEqual(['Club C']);
    expect(combined.seasons['1993'].seasonInfo.relegated).toEqual(['Bottom Club']);
    expect(combined.seasons['1897'].tier1.metadata).toMatchObject({
      source: 'wikipedia-promotion',
      tierKey: 'tier1',
    });
    expect(combined.seasons['1993'].tier1.metadata).toMatchObject({
      source: 'wikipedia-overview',
      title: 'Premier League',
      tierKey: 'tier1',
    });

    const report = analyzeFile(combinedOutput);
    expect(report.issues).toEqual([]);
  });
});
