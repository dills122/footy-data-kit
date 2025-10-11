import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jest } from '@jest/globals';
import wikipedia from 'wikipedia';
import {
  constructTier1SeasonResults,
  saveResults,
  fetchSeasonTeams,
  buildPromotionRelegation,
} from '../parse-season-pages.js';

describe('constructTier1SeasonResults', () => {
  test('captures relegated and promoted teams for a season', () => {
    const tier1SeasonTable = [
      { team: 'Oldham Athletic', wasRelegated: true },
      { team: 'Preston North End', wasRelegated: false },
    ];

    const tier2SeasonTable = [
      { team: 'Sunderland', wasPromoted: true },
      { team: 'Notts County', wasPromoted: false },
    ];

    const result = constructTier1SeasonResults(
      tier1SeasonTable,
      tier2SeasonTable,
      1897,
      '1897-98_Football_League'
    );

    expect(result.season).toBe(1897);
    expect(result.table).toBe(tier1SeasonTable);
    expect(result.relegated).toEqual(['Oldham Athletic']);
    expect(result.promoted).toEqual(['Sunderland']);
  });
});

describe('saveResults', () => {
  test('writes JSON output to the target file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-data-kit-'));
    try {
      const outputFile = path.join(tmpDir, 'results', 'data.json');
      const payload = { seasons: { 1897: { tier1: {}, tier2: [] } } };

      saveResults(payload, outputFile);

      const fileContents = fs.readFileSync(outputFile, 'utf8');
      expect(JSON.parse(fileContents)).toEqual(payload);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('fetchSeasonTeams', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('fetches HTML from wikipedia and parses first/second division tables', async () => {
    const html = `
      <div>
        <div><span id="First_Division"></span></div>
        <div class="wikitable">
          <table>
            <tr>
              <th>Pos</th>
              <th>Club</th>
              <th>Pld</th>
              <th>Pts</th>
              <th>Notes</th>
            </tr>
            <tr>
              <td>1</td>
              <th scope="row"><a>Blackburn Rovers</a></th>
              <td>30</td>
              <td>45</td>
              <td>Relegated to the Second Division</td>
            </tr>
          </table>
        </div>

        <div><span id="Second_Division"></span></div>
        <div class="wikitable">
          <table>
            <tr>
              <th>Pos</th>
              <th>Club</th>
              <th>Pld</th>
              <th>Pts</th>
              <th>Notes</th>
            </tr>
            <tr>
              <td>1</td>
              <th scope="row"><a>Sunderland</a></th>
              <td>30</td>
              <td>50</td>
              <td>Promoted to the First Division</td>
            </tr>
          </table>
        </div>
      </div>
    `;
    const pageMock = { html: jest.fn().mockResolvedValue(html) };

    jest.spyOn(wikipedia, 'page').mockResolvedValue(pageMock);
    jest.useFakeTimers();

    const resultPromise = fetchSeasonTeams('1897-98_Football_League');
    await Promise.resolve();
    await jest.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(wikipedia.page).toHaveBeenCalledWith('1897-98_Football_League');
    expect(pageMock.html).toHaveBeenCalled();
    expect(result.first[0]).toMatchObject({
      team: 'Blackburn Rovers',
      wasRelegated: true,
    });
    expect(result.second[0]).toMatchObject({
      team: 'Sunderland',
      wasPromoted: true,
    });
  });

  test('returns empty arrays when wikipedia lookup fails', async () => {
    jest.spyOn(wikipedia, 'page').mockRejectedValue(new Error('not found'));
    jest.useFakeTimers();

    const resultPromise = fetchSeasonTeams('bad-season');
    await Promise.resolve();
    await jest.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ first: [], second: [] });
  });
});

describe('buildPromotionRelegation', () => {
  test('aggregates tier data between the requested years', async () => {
    const htmlBySlug = {
      '1897-98_Football_League': `
        <div>
          <div><span id="First_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Club A</a></th><td>30</td><td>45</td><td></td></tr>
              <tr><td>2</td><th scope="row"><a>Club B</a></th><td>30</td><td>40</td><td>Relegated</td></tr>
            </table>
          </div>
          <div><span id="Second_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Club C</a></th><td>30</td><td>50</td><td>Promoted</td></tr>
              <tr><td>2</td><th scope="row"><a>Club D</a></th><td>30</td><td>42</td><td></td></tr>
            </table>
          </div>
        </div>
      `,
      '1898-99_Football_League': `
        <div>
          <div><span id="First_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Club E</a></th><td>30</td><td>48</td><td></td></tr>
              <tr><td>2</td><th scope="row"><a>Club F</a></th><td>30</td><td>41</td><td>Relegated</td></tr>
            </table>
          </div>
          <div><span id="Second_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Club G</a></th><td>30</td><td>52</td><td>Promoted</td></tr>
              <tr><td>2</td><th scope="row"><a>Club H</a></th><td>30</td><td>44</td><td></td></tr>
            </table>
          </div>
        </div>
      `,
    };

    const pageSpy = jest.spyOn(wikipedia, 'page').mockImplementation(async (slug) => ({
      html: jest.fn().mockResolvedValue(htmlBySlug[slug]),
    }));

    jest.useFakeTimers();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-data-kit-'));
    try {
      const outputFile = path.join(tmpDir, 'output.json');
      const resultPromise = buildPromotionRelegation(1897, 1898, outputFile);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(Object.keys(result.seasons)).toEqual(['1897', '1898']);
      expect(pageSpy).toHaveBeenCalledTimes(2);
      expect(result.seasons[1897].tier1.relegated).toEqual(['Club B']);
      expect(result.seasons[1897].tier1.promoted).toEqual(['Club C']);
      expect(result.seasons[1898].tier1.promoted).toEqual(['Club G']);

      const written = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(written.seasons['1898'].tier1.promoted).toEqual(['Club G']);
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
