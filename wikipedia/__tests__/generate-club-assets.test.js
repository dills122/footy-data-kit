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

  test('can target selected club keys from cache', async () => {
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
          },
          'other fc': {
            clubId: 'other-fc',
            canonicalName: 'Other FC',
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
              status: 'missing',
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
      clubKeys: ['example fc'],
      requestDelayMs: 0,
      cwd: process.cwd(),
    });
    const output = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    const review = JSON.parse(fs.readFileSync(reviewOutputFile, 'utf8'));

    expect(result.processedClubCount).toBe(1);
    expect(output.clubs['example fc'].assets.crest.status).toBe('missing');
    expect(output.clubs['other fc'].assets).toBeUndefined();
    expect(review.clubCount).toBe(1);
  });

  test('reclassifies cached crest bundles with current verification rules', async () => {
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
              preferred: 'wikipedia-pageimage-free:Example_FC_match.jpg',
              status: 'usable',
              candidates: [
                {
                  assetId: 'wikipedia-pageimage-free:Example_FC_match.jpg',
                  kind: 'crest',
                  status: 'usable',
                  source: 'wikipedia-pageimage-free',
                  imageUrl: 'https://upload.wikimedia.org/example.jpg',
                  fileTitle: 'File:Example FC match.jpg',
                  license: {
                    shortName: 'CC BY-SA 4.0',
                    usageTerms: 'Creative Commons Attribution-Share Alike 4.0',
                    copyrighted: true,
                  },
                  verification: {
                    identityMatch: 'possible',
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

    await generateClubAssets({
      input: inputFile,
      output: outputFile,
      reviewOutput: reviewOutputFile,
      cache: cacheFile,
      requestDelayMs: 0,
      cwd: process.cwd(),
    });

    const output = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    const review = JSON.parse(fs.readFileSync(reviewOutputFile, 'utf8'));
    const crest = output.clubs['example fc'].assets.crest;

    expect(crest).not.toHaveProperty('preferred');
    expect(crest.status).toBe('needs-review');
    expect(crest.candidates[0].verification.reviewReasons).toContain('non-crest-filename');
    expect(review.issueCounts).toMatchObject({
      'club-asset-non-crest-candidate': 1,
    });
  });
});
