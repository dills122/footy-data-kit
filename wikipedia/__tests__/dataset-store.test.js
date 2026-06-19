import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDatasetStore } from '../data/dataset-store.js';

describe('createDatasetStore', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('preserves full build range metadata during partial season updates', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-dataset-store-'));
    tmpDirs.push(tmpDir);
    const filePath = path.join(tmpDir, 'overview.json');

    fs.writeFileSync(
      filePath,
      JSON.stringify({
        metadata: {
          schemaVersion: 1,
          generator: 'wikipedia-overview',
          generatedAt: '2026-06-19T00:00:00.000Z',
          buildOptions: {
            startYear: 1957,
            endYear: 1957,
            forceUpdate: true,
          },
        },
        seasons: {
          1888: {
            seasonInfo: {
              season: 1888,
              table: [],
              promoted: [],
              relegated: [],
            },
          },
          2025: {
            seasonInfo: {
              season: 2025,
              table: [],
              promoted: [],
              relegated: [],
            },
          },
        },
      })
    );

    const store = createDatasetStore(filePath, {
      generator: 'wikipedia-overview',
      buildOptions: {
        startYear: 1957,
        endYear: 1957,
        forceUpdate: true,
        includeWarPlaceholders: true,
      },
    });

    store.writeSeason('1957', {
      seasonInfo: {
        season: 1957,
        table: [],
        promoted: [],
        relegated: [],
      },
    });

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    expect(saved.metadata.buildOptions).toMatchObject({
      startYear: 1888,
      endYear: 2025,
      forceUpdate: true,
      includeWarPlaceholders: true,
    });
  });
});
