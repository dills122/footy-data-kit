import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import * as parseSeasonPagesModule from '../parse-season-pages.js';
import { saveResults } from '../utils.js';

const { buildPromotionRelegation, constructTier1SeasonResults, fetchSeasonTeams } =
  parseSeasonPagesModule;

if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = ReadableStream;
}
if (typeof globalThis.WritableStream === 'undefined') {
  globalThis.WritableStream = WritableStream;
}
if (typeof globalThis.TransformStream === 'undefined') {
  globalThis.TransformStream = TransformStream;
}

let wikipediaModule = await import('wikipedia');
let wikipedia = wikipediaModule.default ?? wikipediaModule;

// Compatibility shim: newer `wikipedia` package exposes `html(title)` directly
// but older code/tests expect `page(title).html()`. If `page` is missing,
// add a small adapter so tests can spyOn `page` and existing code paths keep working.
if (typeof wikipedia.page === 'undefined' && typeof wikipedia.html === 'function') {
  // Attach `page` onto the real module export so other dynamic imports
  // receive the same shim (this allows `jest.spyOn(wikipedia, 'page')` to
  // work even when the code under test performs its own import).
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
  } catch (e) {
    // best-effort shim; if mutation fails, tests will fall back to original behavior
  }
}

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

    const { tier1, tier2 } = constructTier1SeasonResults(
      tier1SeasonTable,
      tier2SeasonTable,
      1897,
      '1897-98_Football_League'
    );

    expect(tier1.season).toBe(1897);
    expect(tier1.relegated).toEqual(['Oldham Athletic']);
    expect(tier1.promoted).toEqual(['Sunderland']);
    expect(tier2.promoted).toEqual(['Sunderland']);
    expect(tier1.table[0]).toMatchObject({ team: 'Oldham Athletic', wasRelegated: true });
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
              <tr><td>3</td><th scope="row"><a>Club F</a></th><td>30</td><td>38</td><td></td></tr>
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
              <tr><td>1</td><th scope="row"><a>Club A</a></th><td>30</td><td>48</td><td></td></tr>
              <tr><td>2</td><th scope="row"><a>Club C</a></th><td>30</td><td>41</td><td></td></tr>
              <tr><td>3</td><th scope="row"><a>Club F</a></th><td>30</td><td>36</td><td>Relegated</td></tr>
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
      expect(result.seasons['1897'].tier1.relegated).toEqual(['Club B']);
      expect(result.seasons['1897'].tier1.promoted).toEqual([]);
      expect(result.seasons['1897'].seasonInfo.promoted).toEqual(['Club C']);
      expect(result.seasons['1897'].seasonInfo.relegated).toEqual(['Club B']);
      expect(result.seasons['1897'].seasonInfo.table).toEqual([]);
      expect(result.seasons['1898'].tier2.metadata).toMatchObject({
        source: 'wikipedia-promotion',
        seasonSlug: '1898-99_Football_League',
        tierKey: 'tier2',
      });

      const written = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(written.seasons['1898'].tier1.promoted).toEqual([]);
      expect(written.seasons['1898'].seasonInfo.promoted).toEqual(['Club G']);
      expect(written.seasons['1898'].seasonInfo.table).toEqual([]);
      expect(written.seasons['1898'].tier1.metadata).toMatchObject({
        source: 'wikipedia-promotion',
        tierKey: 'tier1',
      });
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('reconciles promotion season summaries from next-season continuity before the Premier League split', async () => {
    const htmlBySlug = {
      '1989-90_Football_League': `
        <div>
          <div><span id="First_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Existing Club</a></th><td>38</td><td>60</td><td></td></tr>
              <tr><td>2</td><th scope="row"><a>Derby County</a></th><td>38</td><td>46</td><td></td></tr>
              <tr><td>3</td><th scope="row"><a>Sheffield Wednesday</a></th><td>38</td><td>43</td><td>Relegated</td></tr>
              <tr><td>4</td><th scope="row"><a>Charlton Athletic</a></th><td>38</td><td>30</td><td>Relegated</td></tr>
              <tr><td>5</td><th scope="row"><a>Millwall</a></th><td>38</td><td>26</td><td>Relegated</td></tr>
            </table>
          </div>
          <div><span id="Second_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Leeds United</a></th><td>46</td><td>85</td><td>Promotion to the First Division</td></tr>
              <tr><td>2</td><th scope="row"><a>Sheffield United</a></th><td>46</td><td>85</td><td>Promotion to the First Division</td></tr>
              <tr><td>4</td><th scope="row"><a>Swindon Town (Q)</a></th><td>46</td><td>74</td><td>Qualification for the Second Division play-offs</td></tr>
              <tr><td>6</td><th scope="row"><a>Sunderland (W)</a></th><td>46</td><td>74</td><td>Second Division play-off winners</td></tr>
            </table>
          </div>
          <div class="legend">(Q) Qualification for the Second Division play-offs; (W) Second Division play-off winners</div>
        </div>
      `,
      '1990-91_Football_League': `
        <div>
          <div><span id="First_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Existing Club</a></th><td>38</td><td>66</td><td></td></tr>
              <tr><td>2</td><th scope="row"><a>Leeds United</a></th><td>38</td><td>64</td><td></td></tr>
              <tr><td>3</td><th scope="row"><a>Sheffield United</a></th><td>38</td><td>55</td><td></td></tr>
              <tr><td>4</td><th scope="row"><a>Derby County</a></th><td>38</td><td>46</td><td></td></tr>
              <tr><td>5</td><th scope="row"><a>Sunderland</a></th><td>38</td><td>34</td><td>Relegated</td></tr>
            </table>
          </div>
          <div><span id="Second_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Oldham Athletic</a></th><td>46</td><td>88</td><td>Promotion to the First Division</td></tr>
            </table>
          </div>
        </div>
      `,
    };

    jest.spyOn(wikipedia, 'page').mockImplementation(async (slug) => ({
      html: jest.fn().mockResolvedValue(htmlBySlug[slug]),
    }));

    jest.useFakeTimers();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-data-kit-'));
    try {
      const outputFile = path.join(tmpDir, 'output.json');
      const resultPromise = buildPromotionRelegation(1989, 1990, outputFile);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.seasons['1989'].seasonInfo.promoted).toEqual([
        'Leeds United',
        'Sheffield United',
        'Sunderland',
      ]);
      expect(result.seasons['1989'].seasonInfo.relegated).toEqual([
        'Sheffield Wednesday',
        'Charlton Athletic',
        'Millwall',
      ]);
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('does not treat 1919-20 as a skipped WWI suspension season', async () => {
    const htmlBySlug = {
      '1914-15_Football_League': `
        <div>
          <div><span id="First_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Pre-War FC</a></th><td>38</td><td>60</td><td></td></tr>
            </table>
          </div>
          <div><span id="Second_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Second Tier FC</a></th><td>38</td><td>55</td><td>Promoted</td></tr>
            </table>
          </div>
        </div>
      `,
      '1919-20_Football_League': `
        <div>
          <div><span id="First_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Post-War FC</a></th><td>42</td><td>70</td><td></td></tr>
              <tr><td>22</td><th scope="row"><a>Relegated FC</a></th><td>42</td><td>20</td><td>Relegated</td></tr>
            </table>
          </div>
          <div><span id="Second_Division"></span></div>
          <div class="wikitable">
            <table>
              <tr><th>Pos</th><th>Club</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
              <tr><td>1</td><th scope="row"><a>Promoted FC</a></th><td>42</td><td>72</td><td>Promoted</td></tr>
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
      const resultPromise = buildPromotionRelegation(1914, 1919, outputFile, {
        ignoreWarYears: true,
      });
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(pageSpy).toHaveBeenCalledTimes(2);
      expect(pageSpy).toHaveBeenNthCalledWith(1, '1914-15_Football_League');
      expect(pageSpy).toHaveBeenNthCalledWith(2, '1919-20_Football_League');
      expect(Object.keys(result.seasons)).toEqual(['1914', '1919']);
      expect(result.seasons['1919'].seasonInfo.promoted).toEqual(['Promoted FC']);
      expect(result.seasons['1919'].seasonInfo.relegated).toEqual(['Relegated FC']);
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
