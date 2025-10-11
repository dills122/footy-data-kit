import { parseDivisionTable } from '../parse-division-table.js';

const firstDivisionHead = `
  <div id="First_Division"></div>
  <div class="wikitable">
    <table>
      <tr>
        <th>Pos</th>
        <th>Club</th>
        <th>Pld</th>
        <th>Won</th>
        <th>Drawn</th>
        <th>Lost</th>
        <th>GF</th>
        <th>GA</th>
        <th>Pts</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td>1</td>
        <th scope="row"><a>Blackburn Rovers</a></th>
        <td>30</td>
        <td>20</td>
        <td>5</td>
        <td>5</td>
        <td>80</td>
        <td>40</td>
        <td>45</td>
        <td>Relegated to Second Division</td>
      </tr>
      <tr>
        <td>2</td>
        <th scope="row"><a>Burnley</a></th>
        <td>30</td>
        <td>10</td>
        <td>10</td>
        <td>10</td>
        <td>50</td>
        <td>50</td>
        <td>30</td>
        <td>Expansion club admitted this season</td>
      </tr>
    </table>
  </div>
`;

describe('parseDivisionTable', () => {
  test('parses standard First Division tables and derives status flags', () => {
    const rows = parseDivisionTable(firstDivisionHead, 'first');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      team: 'Blackburn Rovers',
      pos: 1,
      wasRelegated: true,
      wasPromoted: false,
      isExpansionTeam: false,
      notes: 'Relegated to Second Division',
    });

    expect(rows[1]).toMatchObject({
      team: 'Burnley',
      pos: 2,
      wasRelegated: false,
      wasPromoted: false,
      isExpansionTeam: true,
    });
  });

  test('falls back to legacy headers and carries notes via rowspan for promotions', () => {
    const legacyHtml = `
      <div>
        <span id="Final_league_table"></span>
      </div>
      <div class="wikitable">
        <table>
          <tr>
            <th>No</th>
            <th>Side</th>
            <th>P</th>
            <th>Pts</th>
            <th>Remarks</th>
          </tr>
          <tr>
            <td>1</td>
            <th scope="row"><a>Derby County</a></th>
            <td>34</td>
            <td>40</td>
            <td>Promoted to First Division</td>
          </tr>
          <tr>
            <td>2</td>
            <th scope="row"><a>Sheffield United</a></th>
            <td>34</td>
            <td>38</td>
            <td rowspan="2">Promoted to First Division</td>
          </tr>
          <tr>
            <td>3</td>
            <th scope="row"><a>Stoke</a></th>
            <td>34</td>
            <td>36</td>
          </tr>
        </table>
      </div>
    `;

    const rows = parseDivisionTable(legacyHtml, 'second');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      team: 'Derby County',
      pos: 1,
      wasPromoted: true,
      notes: 'Promoted to First Division',
    });

    expect(rows[2]).toMatchObject({
      team: 'Stoke',
      pos: 3,
      wasPromoted: true,
      notes: 'Promoted to First Division',
    });
  });

  test('returns empty array when no league table header can be found', () => {
    const html = '<div><p>No table here</p></div>';
    expect(parseDivisionTable(html, 'second')).toEqual([]);
  });
});
