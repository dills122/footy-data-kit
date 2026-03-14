import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { Blob } from 'node:buffer';
import { WIKIPEDIA_DATA_SOURCES } from '../config.js';
import { buildPromotionRelegation } from '../builders/parse-season-pages.js';
import { buildSeasonOverview } from '../builders/parse-ext-season-overview-pages.js';
import { combineFootballDataFiles } from '../data/combine-output-files.js';
import { analyzeFile } from '../data/verify-football-data.js';

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
    const promoOutput = path.join(outputDir, WIKIPEDIA_DATA_SOURCES.promotion.datasetFileName);
    const overviewOutput = path.join(outputDir, WIKIPEDIA_DATA_SOURCES.overview.datasetFileName);
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
        {
          title: 'Second Division',
          id: 'Second_Division',
          tableIndex: 2,
          rows: [
            {
              pos: 1,
              team: 'Steady Club',
              played: 46,
              won: 24,
              drawn: 11,
              lost: 11,
              goalsFor: 70,
              goalsAgainst: 45,
              goalDifference: 25,
              goalAverage: null,
              points: 83,
              notes: null,
              wasRelegated: false,
              wasPromoted: false,
              isExpansionTeam: false,
              wasReElected: false,
              wasReprieved: false,
            },
            {
              pos: 2,
              team: 'Midtable Club',
              played: 46,
              won: 20,
              drawn: 12,
              lost: 14,
              goalsFor: 61,
              goalsAgainst: 54,
              goalDifference: 7,
              goalAverage: null,
              points: 72,
              notes: null,
              wasRelegated: false,
              wasPromoted: false,
              isExpansionTeam: false,
              wasReElected: false,
              wasReprieved: false,
            },
          ],
        },
        {
          title: 'Third Division',
          id: 'Third_Division',
          tableIndex: 3,
          rows: [
            {
              pos: 1,
              team: 'Lower Club',
              played: 46,
              won: 22,
              drawn: 10,
              lost: 14,
              goalsFor: 63,
              goalsAgainst: 50,
              goalDifference: 13,
              goalAverage: null,
              points: 76,
              notes: null,
              wasRelegated: false,
              wasPromoted: false,
              isExpansionTeam: false,
              wasReElected: false,
              wasReprieved: false,
            },
            {
              pos: 2,
              team: 'Basement Club',
              played: 46,
              won: 18,
              drawn: 13,
              lost: 15,
              goalsFor: 57,
              goalsAgainst: 55,
              goalDifference: 2,
              goalAverage: null,
              points: 67,
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

  test('builds early overview data with Football Alliance election movement', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-overview-history-smoke-'));
    tmpDirs.push(tmpDir);

    const outputDir = path.join(tmpDir, 'data-output');
    const overviewOutput = path.join(outputDir, WIKIPEDIA_DATA_SOURCES.overview.datasetFileName);

    await buildSeasonOverview(1890, 1890, overviewOutput, {
      fetchSeasonOverviewTables: async () => [
        {
          title: 'The Football League',
          id: 'The_Football_League',
          tableIndex: 0,
          rows: [
            {
              pos: 1,
              team: 'Everton',
              played: 22,
              won: 13,
              drawn: 3,
              lost: 6,
              goalsFor: 50,
              goalsAgainst: 30,
              goalDifference: 20,
              goalAverage: null,
              points: 29,
              notes: null,
              wasRelegated: false,
              wasPromoted: false,
              isExpansionTeam: false,
              wasReElected: false,
              wasReprieved: false,
            },
            {
              pos: 12,
              team: 'Burnley',
              played: 22,
              won: 4,
              drawn: 6,
              lost: 12,
              goalsFor: 20,
              goalsAgainst: 40,
              goalDifference: -20,
              goalAverage: null,
              points: 14,
              notes: 'Not re-elected to the Football League',
              wasRelegated: false,
              wasPromoted: false,
              isExpansionTeam: false,
              wasReElected: false,
              wasReprieved: false,
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
              won: 15,
              drawn: 3,
              lost: 4,
              goalsFor: 45,
              goalsAgainst: 20,
              goalDifference: 25,
              goalAverage: null,
              points: 33,
              notes: 'Elected to the Football League',
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

    const built = JSON.parse(fs.readFileSync(overviewOutput, 'utf8'));
    expect(built.seasons['1890'].seasonInfo.promoted).toEqual(['Stoke']);
    expect(built.seasons['1890'].seasonInfo.relegated).toEqual(['Burnley']);
    expect(built.seasons['1890'].tier1.relegated).toEqual(['Burnley']);
    expect(built.seasons['1890'].tier2.promoted).toEqual(['Stoke']);
    expect(built.seasons['1890'].tier2.metadata).toMatchObject({
      title: 'The Football Alliance',
      leagueId: 'The_Football_Alliance',
      tierKey: 'tier2',
    });

    const report = analyzeFile(overviewOutput);
    expect(report.issues).toEqual([
      {
        type: 'position-gap',
        season: '1890',
        tier: 'tier1',
        message: 'Missing position values detected: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11',
      },
    ]);
  });
});
