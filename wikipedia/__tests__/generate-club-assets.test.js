import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateClubAssets } from '../data/generate-club-assets.js';

describe('generateClubAssets', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('uses cached crest bundles without network discovery', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'club-assets-test-'));
    tmpDirs.push(tmpDir);
    const inputFile = path.join(tmpDir, 'club-metadata.json');
    const outputFile = path.join(tmpDir, 'club-metadata-output.json');
    const reviewOutputFile = path.join(tmpDir, 'club-assets-review.json');
    const cacheFile = path.join(tmpDir, 'club-assets-cache.json');

    fs.writeFileSync(
      inputFile,
      JSON.stringify({
        clubs: {
          'example fc': {
            clubId: 'example-fc',
            canonicalName: 'Example FC',
            derived: {
              aliases: ['Example FC'],
            },
          },
        },
      })
    );
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({
        clubs: {
          'example fc': {
            crest: {
              preferred: 'wikipedia-pageimage-free:Example_FC_crest.svg',
              status: 'usable',
              candidates: [
                {
                  assetId: 'wikipedia-pageimage-free:Example_FC_crest.svg',
                  kind: 'crest',
                  status: 'usable',
                  source: 'wikipedia-pageimage-free',
                  imageUrl: 'https://upload.wikimedia.org/example.svg',
                  fileTitle: 'File:Example FC crest.svg',
                  license: {
                    shortName: 'PD',
                    usageTerms: 'Public domain',
                    copyrighted: false,
                  },
                  verification: {
                    identityMatch: 'strong',
                    licenseCheck: 'pass',
                    httpCheck: 'pass',
                    needsManualReview: false,
                  },
                },
              ],
            },
          },
        },
      })
    );

    const result = await generateClubAssets({
      input: inputFile,
      output: outputFile,
      reviewOutput: reviewOutputFile,
      cache: cacheFile,
      requestDelayMs: 0,
      cwd: process.cwd(),
    });

    const output = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    const review = JSON.parse(fs.readFileSync(reviewOutputFile, 'utf8'));

    expect(result.processedClubCount).toBe(1);
    expect(output.clubs['example fc'].assets.crest).toMatchObject({
      preferred: 'wikipedia-pageimage-free:Example_FC_crest.svg',
      status: 'usable',
    });
    expect(review.issueCount).toBe(0);
  });
});
