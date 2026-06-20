import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertReleaseDryRunCompleteness,
  buildLowerTierDryRunRange,
  buildReleaseDryRunCompletenessSummary,
} from '../../scripts/release-dry-run-data.js';

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('release-dry-run-data completeness checks', () => {
  test('reports generated season and club counts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-dry-run-test-'));
    const allSeasonsFile = path.join(tmpDir, 'all-seasons.json');
    const clubMetadataFile = path.join(tmpDir, 'club-metadata.json');

    writeJson(allSeasonsFile, {
      seasons: {
        2024: { seasonInfo: { season: '2024' } },
        2025: { seasonInfo: { season: '2025' } },
      },
    });
    writeJson(clubMetadataFile, {
      clubs: {
        arsenal: { clubId: 'arsenal' },
      },
    });

    expect(
      buildReleaseDryRunCompletenessSummary({
        allSeasonsFile,
        clubMetadataFile,
        minSeasonCount: 2,
        minClubCount: 1,
      })
    ).toEqual({
      seasonCount: 2,
      clubCount: 1,
      minSeasonCount: 2,
      minClubCount: 1,
      issues: [],
    });
  });

  test('fails closed when dry-run output is incomplete', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-dry-run-test-'));
    const allSeasonsFile = path.join(tmpDir, 'all-seasons.json');
    const clubMetadataFile = path.join(tmpDir, 'club-metadata.json');

    writeJson(allSeasonsFile, {
      seasons: {
        1915: { seasonInfo: { season: '1915', competitionStatus: 'wartime-special' } },
      },
    });
    writeJson(clubMetadataFile, { clubs: {} });

    expect(() =>
      assertReleaseDryRunCompleteness({
        allSeasonsFile,
        clubMetadataFile,
        minSeasonCount: 138,
        minClubCount: 1,
      })
    ).toThrow(
      'Release dry-run output is incomplete: expected at least 138 season record(s), generated 1; expected at least 1 club metadata record(s), generated 0'
    );
  });

  test('rejects invalid completeness thresholds', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-dry-run-test-'));
    const allSeasonsFile = path.join(tmpDir, 'all-seasons.json');
    const clubMetadataFile = path.join(tmpDir, 'club-metadata.json');

    writeJson(allSeasonsFile, { seasons: {} });
    writeJson(clubMetadataFile, { clubs: {} });

    expect(() =>
      assertReleaseDryRunCompleteness({
        allSeasonsFile,
        clubMetadataFile,
        minSeasonCount: 'many',
        minClubCount: 1,
      })
    ).toThrow('Expected a non-negative integer, got many');
  });

  test('builds lower-tier dry-run range only for supported release seasons', () => {
    expect(buildLowerTierDryRunRange('1888', '1978')).toBeNull();
    expect(buildLowerTierDryRunRange('1888', '2025')).toEqual({ start: 1979, end: 2025 });
    expect(buildLowerTierDryRunRange('2004', '2014')).toEqual({ start: 2004, end: 2014 });
  });
});
