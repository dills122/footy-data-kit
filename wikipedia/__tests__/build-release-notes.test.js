import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildReleaseNotes, renderReleaseNotes } from '../data/build-release-notes.js';

describe('build-release-notes', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('renderReleaseNotes combines curated copy with generated release facts', () => {
    const notes = renderReleaseNotes({
      tag: 'v0.8.2',
      diff: {
        summary: {
          beforeSeasonCount: 1,
          afterSeasonCount: 2,
          addedSeasonCount: 1,
          removedSeasonCount: 0,
          changedSeasonCount: 1,
        },
        addedSeasons: ['1901'],
        removedSeasons: [],
        changedSeasons: [
          {
            season: '1900',
            addedTiers: ['tier2'],
            removedTiers: [],
            changedTiers: [{ tierKey: 'tier1' }],
            seasonInfoChanges: {
              promotedChanges: { added: ['Glossop'], removed: [] },
              relegatedChanges: { added: [], removed: [] },
              metadataChangedFields: [],
            },
          },
        ],
      },
      currentDataset: {
        seasons: {
          1900: {
            seasonInfo: { season: 1900, table: [], promoted: [], relegated: [] },
            tier1: { season: 1900, table: [], promoted: [], relegated: [] },
          },
          1901: {
            seasonInfo: { season: 1901, table: [], promoted: [], relegated: [] },
            tier1: { season: 1901, table: [], promoted: [], relegated: [] },
            tier2: { season: 1901, table: [], promoted: [], relegated: [] },
          },
        },
      },
      clubMetadata: {
        clubs: {
          'active-fc': {
            status: { current: 'active' },
            history: { lifecycleEvents: [], absenceExplanations: [] },
          },
          'historical-fc': {
            status: { current: 'historical' },
            history: {
              lifecycleEvents: [{ type: 'dissolved' }],
              absenceExplanations: [{ reason: 'club-dissolved' }],
            },
          },
        },
      },
      manualMarkdown: '# v0.8.2\n\n## Highlights\n\n- Curated user-facing note.',
    });

    expect(notes).toContain('# footy-data-kit v0.8.2');
    expect(notes).toContain('## Highlights');
    expect(notes).toContain('- Curated user-facing note.');
    expect(notes).toContain('- Season coverage: 1900-1901 (2 season records)');
    expect(notes).toContain('- League table records: 3 tier tables');
    expect(notes).toContain('- Club status split: 1 active, 1 historical, 0 unknown');
    expect(notes).toContain('- Changed seasons: 1');
    expect(notes).toContain('- 1900: added tier2; 1 changed tier(s); promoted list');
    expect(notes).toContain('Table points-order validation');
    expect(notes).toContain('`release-diff.json`');
  });

  test('buildReleaseNotes writes release notes to disk', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-release-notes-'));
    tmpDirs.push(tmpDir);

    const diffPath = path.join(tmpDir, 'release-diff.json');
    const currentPath = path.join(tmpDir, 'all-seasons.json');
    const clubMetadataPath = path.join(tmpDir, 'club-metadata.json');
    const manualPath = path.join(tmpDir, 'manual.md');
    const outputPath = path.join(tmpDir, 'release-notes.md');

    fs.writeFileSync(
      diffPath,
      JSON.stringify({
        summary: {
          beforeSeasonCount: 1,
          afterSeasonCount: 1,
          addedSeasonCount: 0,
          removedSeasonCount: 0,
          changedSeasonCount: 0,
        },
        addedSeasons: [],
        removedSeasons: [],
        changedSeasons: [],
      })
    );
    fs.writeFileSync(
      currentPath,
      JSON.stringify({
        seasons: {
          1900: {
            seasonInfo: { season: 1900, table: [], promoted: [], relegated: [] },
            tier1: { season: 1900, table: [], promoted: [], relegated: [] },
          },
        },
      })
    );
    fs.writeFileSync(
      clubMetadataPath,
      JSON.stringify({
        clubs: {
          'example-fc': {
            status: { current: 'unknown' },
            history: { lifecycleEvents: [], absenceExplanations: [] },
          },
        },
      })
    );
    fs.writeFileSync(manualPath, '## Highlights\n\n- No data diff.');

    const notes = buildReleaseNotes({
      tag: 'v0.8.2',
      diffPath,
      currentPath,
      clubMetadataPath,
      manualPath,
      outputPath,
    });

    expect(fs.readFileSync(outputPath, 'utf8')).toBe(notes);
    expect(notes).toContain('No season-table changes were detected');
  });
});
