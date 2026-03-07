import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeFile, expandTargets } from '../verify-football-data.js';

describe('verify-football-data', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('expandTargets recursively finds nested json files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-footy-data-'));
    tmpDirs.push(tmpDir);

    const nestedDir = path.join(tmpDir, 'rsssf');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'root.json'), JSON.stringify({ seasons: {} }));
    fs.writeFileSync(path.join(nestedDir, 'nested.json'), JSON.stringify({ seasons: {} }));
    fs.writeFileSync(path.join(nestedDir, 'notes.txt'), 'ignore me');

    const files = expandTargets([tmpDir]);

    expect(files).toEqual([path.join(tmpDir, 'root.json'), path.join(nestedDir, 'nested.json')]);
  });

  test('analyzeFile reports duplicate rows in nested-compatible football data exports', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-footy-data-'));
    tmpDirs.push(tmpDir);

    const filePath = path.join(tmpDir, 'data.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          seasons: {
            2001: {
              tier1: {
                season: 2001,
                table: [
                  {
                    pos: 1,
                    team: 'Alpha FC',
                    played: 10,
                    won: 7,
                    drawn: 2,
                    lost: 1,
                    goalsFor: 20,
                    goalsAgainst: 9,
                    goalDifference: 11,
                    goalAverage: null,
                    points: 23,
                  },
                  {
                    pos: 1,
                    team: 'Alpha FC',
                    played: 10,
                    won: 6,
                    drawn: 3,
                    lost: 1,
                    goalsFor: 18,
                    goalsAgainst: 8,
                    goalDifference: 10,
                    goalAverage: null,
                    points: 21,
                  },
                ],
                promoted: [],
                relegated: [],
              },
            },
          },
        },
        null,
        2
      )
    );

    const report = analyzeFile(filePath);
    const issueTypes = report.issues.map((issue) => issue.type);

    expect(issueTypes).toContain('duplicate-teams');
    expect(issueTypes).toContain('duplicate-positions');
  });
});
