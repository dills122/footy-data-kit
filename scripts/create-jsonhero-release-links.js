#!/usr/bin/env node

import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const DEFAULT_REPO = 'dills122/footy-data-kit';
const DEFAULT_ASSET = 'all-seasons.min.json';
const DEFAULT_TIMEOUT_MS = 60_000;
const JSON_HERO_CREATE_URL = 'https://jsonhero.io/actions/createFromUrl';
const MAX_REDIRECTS = 10;

function parseArgs(argv) {
  const options = {
    allowFallback: false,
    asset: DEFAULT_ASSET,
    output: '',
    repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
    tag: '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--allow-fallback') {
      options.allowFallback = true;
    } else if (arg === '--asset') {
      options.asset = next;
      index += 1;
    } else if (arg === '--output') {
      options.output = next;
      index += 1;
    } else if (arg === '--repo') {
      options.repo = next;
      index += 1;
    } else if (arg === '--tag') {
      options.tag = next;
      index += 1;
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number.parseInt(next, 10);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.tag) {
    throw new Error('Missing required --tag value.');
  }
  if (!options.output) {
    throw new Error('Missing required --output value.');
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error(`Invalid --timeout-ms value: ${options.timeoutMs}`);
  }

  return options;
}

function buildReleaseAssetUrl({ repo, tag, asset }) {
  return `https://github.com/${repo}/releases/download/${tag}/${asset}`;
}

function buildJsonHeroCreateUrl(jsonUrl) {
  const params = new URLSearchParams({
    jsonUrl,
    utm_source: 'footy-data-kit',
  });

  return `${JSON_HERO_CREATE_URL}?${params.toString()}`;
}

function requestUrl(url, { redirects = 0, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const currentUrl = new URL(url);
    const client = currentUrl.protocol === 'http:' ? http : https;
    const request = client.request(
      currentUrl,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/json',
          'User-Agent': 'footy-data-kit-release-linker',
        },
        method: 'GET',
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        const redirectLocation = response.headers.location;

        response.resume();

        response.on('end', () => {
          if (statusCode >= 300 && statusCode < 400 && redirectLocation) {
            if (redirects >= MAX_REDIRECTS) {
              reject(
                new Error(`Too many redirects while creating JSON Hero link. Last URL: ${url}`)
              );
              return;
            }

            resolve(
              requestUrl(new URL(redirectLocation, url).toString(), {
                redirects: redirects + 1,
                timeoutMs,
              })
            );
            return;
          }

          resolve({
            statusCode,
            statusMessage: response.statusMessage || '',
            url,
          });
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out after ${timeoutMs}ms while creating JSON Hero link.`));
    });

    request.on('error', reject);
    request.end();
  });
}

async function createJsonHeroLink(createUrl, { timeoutMs }) {
  const response = await requestUrl(createUrl, { timeoutMs });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`JSON Hero returned HTTP ${response.statusCode} ${response.statusMessage}`);
  }

  if (!response.url || !response.url.startsWith('https://jsonhero.io/j/')) {
    throw new Error(`JSON Hero did not redirect to a document URL. Final URL: ${response.url}`);
  }

  return response.url;
}

async function writeJson(filepath, value) {
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const assetUrl = buildReleaseAssetUrl(options);
  const createUrl = buildJsonHeroCreateUrl(assetUrl);
  const generatedAt = new Date().toISOString();

  let jsonHeroUrl = null;
  let status = 'created';
  let error = null;

  try {
    jsonHeroUrl = await createJsonHeroLink(createUrl, { timeoutMs: options.timeoutMs });
  } catch (caught) {
    if (!options.allowFallback) {
      throw caught;
    }

    status = 'fallback';
    error = caught instanceof Error ? caught.message : String(caught);
    console.warn(`JSON Hero link creation failed; writing fallback metadata. ${error}`);
  }

  const metadata = {
    tag: options.tag,
    generatedAt,
    assets: {
      allSeasons: buildReleaseAssetUrl({ ...options, asset: 'all-seasons.json' }),
      allSeasonsMin: buildReleaseAssetUrl({ ...options, asset: 'all-seasons.min.json' }),
    },
    explorer: {
      jsonHero: {
        status,
        sourceAsset: options.asset,
        sourceUrl: assetUrl,
        createUrl,
        url: jsonHeroUrl,
        error,
      },
    },
  };

  await writeJson(options.output, metadata);

  if (jsonHeroUrl) {
    console.log(jsonHeroUrl);
  } else {
    console.log(createUrl);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
