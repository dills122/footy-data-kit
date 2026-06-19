import { describe, test, expect } from '@jest/globals';
import * as cheerio from 'cheerio';
import {
  extractLegendForTable,
  extractLegendSymbols,
  parseLeagueTableRows,
  parseLegendText,
} from '../../parser-core/league-table-parser.js';

describe('league-table-parser', () => {
  test('parses promotion and relegation legend text markers', () => {
    const legend = parseLegendText('(Q) Qualified for play-off group; (P) Promoted; (R) Relegated');

    expect(legend).toEqual({
      Q: { promoted: false, relegated: false },
      P: { promoted: true, relegated: false },
      R: { promoted: false, relegated: true },
    });
  });

  test('extracts legend symbols from a team cell', () => {
    const $ = cheerio.load('<table><tr><td>Oldham (P) (Q, X)</td></tr></table>');
    const symbols = extractLegendSymbols($, $('td'));

    expect(symbols).toEqual(new Set(['P', 'Q', 'X']));
  });

  test('parses table rows with legend, notes, and rowspan carry', () => {
    const html = `
      <table class="wikitable">
        <tr>
          <th>Pos</th>
          <th>Team</th>
          <th>Pld</th>
          <th>Pts</th>
          <th>Notes</th>
        </tr>
        <tr>
          <td>1</td>
          <th scope="row"><a>Top Club</a> <span>(P)</span></th>
          <td>38</td>
          <td>90</td>
          <td>Promotion to division</td>
        </tr>
        <tr>
          <td>2</td>
          <th scope="row"><a>Relegated Club</a> (R)</th>
          <td>38</td>
          <td>30</td>
          <td rowspan="2">Relegated</td>
        </tr>
        <tr>
          <td>3</td>
          <th scope="row"><a>Carrier Club</a> <span>(P/R)</span></th>
          <td>38</td>
          <td>31</td>
          <td></td>
        </tr>
      </table>
      <div class="sports-table-notes">(P) Promoted (R) Relegated</div>
    `;
    const $ = cheerio.load(html);
    const table = $('table.wikitable').first();
    const legend = extractLegendForTable($, table);

    const rows = parseLeagueTableRows($, table, {
      suppressPromotionFlags: false,
      legendMap: legend,
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      team: 'Top Club',
      pos: 1,
      wasPromoted: true,
      wasRelegated: false,
      notes: 'Promotion to division',
    });
    expect(rows[1]).toMatchObject({
      team: 'Relegated Club',
      pos: 2,
      wasRelegated: true,
      notes: 'Relegated',
    });
    expect(rows[2]).toMatchObject({
      team: 'Carrier Club',
      pos: 3,
      wasRelegated: true,
    });
  });

  test('marks reprieved rows from re-election and relegation notes', () => {
    const html = `
      <table class="wikitable">
        <tr><th>Pos</th><th>Team</th><th>Pld</th><th>Pts</th><th>Notes</th></tr>
        <tr><td>21</td><th scope="row">Election FC</th><td>42</td><td>30</td><td>Reprieved from re-election</td></tr>
        <tr><td>22</td><th scope="row">Relegation FC</th><td>42</td><td>28</td><td>Reprieved from relegation</td></tr>
      </table>
    `;
    const $ = cheerio.load(html);

    const rows = parseLeagueTableRows($, $('table.wikitable').first());

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      team: 'Election FC',
      wasReprieved: true,
      wasReElected: false,
    });
    expect(rows[1]).toMatchObject({
      team: 'Relegation FC',
      wasReprieved: true,
      wasRelegated: true,
    });
  });
});
