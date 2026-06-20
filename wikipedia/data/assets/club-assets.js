// @ts-check

import https from 'node:https';

export const CLUB_ASSET_SOURCE_IDS = Object.freeze({
  wikidataLogo: 'wikidata-logo',
  wikipediaPageImageFree: 'wikipedia-pageimage-free',
  wikipediaPageImageAny: 'wikipedia-pageimage-any',
});

const USER_AGENT = 'footy-data-kit/club-assets (https://github.com/dills122/footy-data-kit)';
const CREST_FILE_TOKENS = Object.freeze(['badge', 'crest', 'logo', 'emblem', 'seal']);
const FREE_LICENSE_TOKENS = Object.freeze([
  'cc by',
  'cc-by',
  'cc0',
  'creative commons attribution',
  'creative commons zero',
  'public domain',
  'pd',
]);
const RESTRICTED_LICENSE_TOKENS = Object.freeze([
  'fair use',
  'non-free',
  'copyrighted',
  'trademark',
  'logo rationale',
]);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry == null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === 'object') return Object.keys(entry).length > 0;
      return true;
    })
  );
}

function toText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function stripHtml(value) {
  const text = toText(value);
  if (!text) return null;
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTokenText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/f\.?c\.?/g, ' ')
    .replace(/football club/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function significantTokens(value) {
  return normalizeTokenText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !['the', 'and', 'club', 'football'].includes(token));
}

function fileNameFromTitle(fileTitle) {
  return String(fileTitle || '')
    .replace(/^File:/i, '')
    .replace(/[_-]+/g, ' ');
}

function normalizedFileTitleKey(fileTitle) {
  const title = String(fileTitle || '').startsWith('File:')
    ? String(fileTitle || '')
    : `File:${fileTitle || ''}`;
  return title.replace(/_/g, ' ').trim().toLowerCase();
}

function hasCrestFileToken(fileTitle) {
  const normalized = normalizeTokenText(fileNameFromTitle(fileTitle));
  return CREST_FILE_TOKENS.some((token) => normalized.includes(token));
}

function normalizedCompactText(value) {
  return normalizeTokenText(value).replace(/\s+/g, '');
}

function fileExtension(fileTitle) {
  const match = String(fileTitle || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function buildAssetId(source, fileTitle, fallbackUrl) {
  const idPart = toText(fileTitle) || toText(fallbackUrl) || 'unknown';
  return `${source}:${idPart.replace(/^File:/i, '')}`;
}

function normalizeUrl(value) {
  const text = toText(value);
  if (!text) return null;
  if (text.startsWith('//')) return `https:${text}`;
  return text;
}

function imagePageUrl(fileTitle) {
  const title = toText(fileTitle);
  if (!title) return null;
  const normalizedTitle = title.startsWith('File:') ? title : `File:${title}`;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(normalizedTitle).replace(/%20/g, '_')}`;
}

export function classifyAssetLicense(license = {}) {
  const shortName = normalizeTokenText(license.shortName);
  const usageTerms = normalizeTokenText(license.usageTerms);
  const joined = `${shortName} ${usageTerms}`;

  if (license.copyrighted === false) return 'pass';
  if (RESTRICTED_LICENSE_TOKENS.some((token) => joined.includes(token))) return 'restricted';
  if (FREE_LICENSE_TOKENS.some((token) => joined.includes(token))) return 'pass';
  if (license.copyrighted === true) return 'restricted';
  return 'unknown';
}

export function classifyAssetIdentity(candidate, club) {
  const fileTokens = significantTokens(candidate.fileTitle || candidate.imageUrl || '');
  const clubTokens = significantTokens(club?.canonicalName || club?.clubId || '');
  const aliasTokens = (club?.derived?.aliases || []).flatMap(significantTokens);
  const expectedTokens = new Set([...clubTokens, ...aliasTokens]);
  const compactFile = normalizedCompactText(candidate.fileTitle || candidate.imageUrl || '');
  const compactNames = [club?.canonicalName, club?.clubId, ...(club?.derived?.aliases || [])]
    .map(normalizedCompactText)
    .filter(Boolean);

  if (compactNames.some((name) => name.length > 2 && compactFile.includes(name))) {
    return hasCrestFileToken(candidate.fileTitle) ? 'strong' : 'possible';
  }

  if (!fileTokens.length || !expectedTokens.size) return 'weak';

  const matches = fileTokens.filter((token) => expectedTokens.has(token));
  if (matches.length >= Math.min(2, clubTokens.length || 2) && hasCrestFileToken(candidate.fileTitle)) {
    return 'strong';
  }
  if (matches.length >= Math.min(2, clubTokens.length || 2)) return 'possible';
  if (matches.length > 0 && hasCrestFileToken(candidate.fileTitle)) return 'possible';
  if (matches.length > 0) return 'weak';
  return 'none';
}

function isLikelyCrestCandidate(candidate, identityMatch) {
  if (hasCrestFileToken(candidate.fileTitle)) return true;
  const extension = fileExtension(candidate.fileTitle || candidate.imageUrl);
  return (
    candidate.source === CLUB_ASSET_SOURCE_IDS.wikipediaPageImageAny &&
    ['possible', 'strong'].includes(identityMatch) &&
    ['svg', 'png'].includes(extension)
  );
}

export function classifyClubAssetCandidate(candidate, club, { checkedAt = null } = {}) {
  const licenseCheck = classifyAssetLicense(candidate.license || {});
  const identityMatch = classifyAssetIdentity(candidate, club);
  const likelyCrestCandidate = isLikelyCrestCandidate(candidate, identityMatch);
  const reviewReasons = [];

  if (licenseCheck === 'restricted') reviewReasons.push('license-restricted');
  if (licenseCheck === 'unknown') reviewReasons.push('license-unknown');
  if (!['strong', 'possible'].includes(identityMatch)) reviewReasons.push('identity-uncertain');
  if (!likelyCrestCandidate) reviewReasons.push('non-crest-filename');
  if (!candidate.imageUrl) reviewReasons.push('image-url-missing');

  let status = 'needs-review';
  if (!candidate.imageUrl) {
    status = 'failed';
  } else if (licenseCheck === 'restricted') {
    status = 'restricted';
  } else if (licenseCheck === 'pass' && ['strong', 'possible'].includes(identityMatch)) {
    status = 'usable';
  }

  return {
    ...candidate,
    status,
    verification: compactObject({
      ...(candidate.verification || {}),
      identityMatch,
      licenseCheck,
      httpCheck: candidate.imageUrl ? 'pass' : 'fail',
      needsManualReview: status !== 'usable',
      reviewReasons,
      checkedAt,
    }),
  };
}

function statusRank(status) {
  if (status === 'usable') return 0;
  if (status === 'restricted') return 1;
  if (status === 'needs-review') return 2;
  if (status === 'failed') return 4;
  return 3;
}

function sourceRank(source) {
  if (source === CLUB_ASSET_SOURCE_IDS.wikidataLogo) return 0;
  if (source === CLUB_ASSET_SOURCE_IDS.wikipediaPageImageFree) return 1;
  if (source === CLUB_ASSET_SOURCE_IDS.wikipediaPageImageAny) return 2;
  return 3;
}

export function rankClubAssetCandidates(candidates, limit = 5) {
  const seen = new Set();
  const deduped = [];
  for (const candidate of candidates || []) {
    if (!candidate?.assetId) continue;
    if (seen.has(candidate.assetId)) continue;
    seen.add(candidate.assetId);
    deduped.push(candidate);
  }

  return deduped
    .sort((left, right) => {
      const statusDelta = statusRank(left.status) - statusRank(right.status);
      if (statusDelta) return statusDelta;
      const sourceDelta = sourceRank(left.source) - sourceRank(right.source);
      if (sourceDelta) return sourceDelta;
      const leftCrest = hasCrestFileToken(left.fileTitle) ? 0 : 1;
      const rightCrest = hasCrestFileToken(right.fileTitle) ? 0 : 1;
      if (leftCrest !== rightCrest) return leftCrest - rightCrest;
      return String(left.assetId).localeCompare(String(right.assetId));
    })
    .slice(0, limit)
    .map((candidate, index) => ({ ...candidate, priority: index + 1 }));
}

export function buildClubAssetBundle(candidates, { limit = 5 } = {}) {
  const rankedCandidates = rankClubAssetCandidates(candidates, limit);
  const preferredCandidate = rankedCandidates.find((candidate) => candidate.status === 'usable');
  const status = preferredCandidate
    ? 'usable'
    : rankedCandidates[0]?.status || 'missing';

  return compactObject({
    preferred: preferredCandidate?.assetId || null,
    status,
    candidates: rankedCandidates,
  });
}

export function buildClubAssetReviewIssues(clubKey, club, bundle) {
  const baseIssue = {
    clubKey,
    clubId: club?.clubId || null,
    canonicalName: club?.canonicalName || clubKey,
    assetKind: 'crest',
  };
  const candidates = bundle?.candidates || [];
  const issues = [];

  if (!candidates.length) {
    issues.push({
      type: 'club-asset-missing',
      ...baseIssue,
      message: `${baseIssue.canonicalName} has no crest asset candidates`,
    });
    return issues;
  }

  for (const candidate of candidates) {
    if (candidate.status === 'restricted') {
      issues.push({
        type: 'club-asset-license-restricted',
        ...baseIssue,
        assetId: candidate.assetId,
        source: candidate.source,
        message: `${baseIssue.canonicalName} crest candidate is license restricted`,
      });
    }
    if (candidate.status === 'failed') {
      issues.push({
        type: 'club-asset-url-failed',
        ...baseIssue,
        assetId: candidate.assetId,
        source: candidate.source,
        message: `${baseIssue.canonicalName} crest candidate failed URL verification`,
      });
    }
    if (candidate.verification?.reviewReasons?.includes('identity-uncertain')) {
      issues.push({
        type: 'club-asset-identity-uncertain',
        ...baseIssue,
        assetId: candidate.assetId,
        source: candidate.source,
        message: `${baseIssue.canonicalName} crest candidate identity is uncertain`,
      });
    }
    if (candidate.verification?.reviewReasons?.includes('non-crest-filename')) {
      issues.push({
        type: 'club-asset-non-crest-candidate',
        ...baseIssue,
        assetId: candidate.assetId,
        source: candidate.source,
        message: `${baseIssue.canonicalName} crest candidate does not look like a crest/logo filename`,
      });
    }
  }

  if (
    !bundle?.preferred &&
    candidates.length > 1 &&
    candidates.some((candidate) => candidate.status !== 'failed')
  ) {
    issues.push({
      type: 'club-asset-multiple-review-candidates',
      ...baseIssue,
      candidateCount: candidates.length,
      message: `${baseIssue.canonicalName} has crest candidates but no usable preferred asset`,
    });
  }

  return issues;
}

async function fetchJson(url, { retries = 2, retryDelayMs = 1000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await new Promise((resolve, reject) => {
        https
          .get(url, { headers: { 'user-agent': USER_AGENT } }, (response) => {
            let body = '';
            response.on('data', (chunk) => {
              body += chunk;
            });
            response.on('end', () => {
              if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
                const error = new Error(
                  `Request failed ${response.statusCode}: ${body.slice(0, 200)}`
                );
                error.statusCode = response.statusCode;
                reject(error);
                return;
              }
              try {
                resolve(JSON.parse(body));
              } catch (error) {
                reject(error);
              }
            });
          })
          .on('error', reject);
      });
    } catch (error) {
      const retryableStatus = [429, 500, 502, 503, 504].includes(Number(error.statusCode));
      if (attempt >= retries || !retryableStatus) throw error;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw new Error('Unreachable fetch retry state');
}

function wikipediaArticleTitle(club) {
  const sourceUrl =
    club?.derived?.identitySources?.find((source) =>
      String(source.sourceUrl || '').startsWith('https://en.wikipedia.org/wiki/')
    )?.sourceUrl ||
    club?.status?.sourceRefs?.find((source) =>
      String(source.sourceUrl || '').startsWith('https://en.wikipedia.org/wiki/')
    )?.sourceUrl;
  if (sourceUrl) {
    const pageTitle = decodeURIComponent(sourceUrl.split('/wiki/')[1] || '').replace(/_/g, ' ');
    if (pageTitle) return pageTitle;
  }

  const canonicalName = toText(club?.canonicalName);
  if (!canonicalName) return null;
  return /\bF\.?C\.?$/i.test(canonicalName) ? canonicalName : `${canonicalName} F.C.`;
}

function pageImagesApiUrl(articleTitle, license) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    redirects: '1',
    prop: 'pageimages|pageprops',
    piprop: 'name|original',
    pilicense: license,
    titles: articleTitle,
  });
  return `https://en.wikipedia.org/w/api.php?${params.toString()}`;
}

function imageInfoApiUrl(fileTitles) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiextmetadatafilter:
      'LicenseShortName|UsageTerms|Attribution|Copyrighted|Credit|Artist|LicenseUrl',
    titles: fileTitles.map((title) => (title.startsWith('File:') ? title : `File:${title}`)).join('|'),
  });
  return `https://en.wikipedia.org/w/api.php?${params.toString()}`;
}

function wikidataEntitiesApiUrl(ids) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    props: 'claims|labels',
    languages: 'en',
    ids: ids.join('|'),
  });
  return `https://www.wikidata.org/w/api.php?${params.toString()}`;
}

function candidateFromPageImage(page, source) {
  if (!page?.pageimage && !page?.original?.source) return null;
  const fileTitle = page.pageimage ? `File:${page.pageimage}` : null;
  return compactObject({
    assetId: buildAssetId(source, fileTitle, page.original?.source),
    kind: 'crest',
    status: 'needs-review',
    source,
    sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title || '').replace(/%20/g, '_')}`,
    imageUrl: normalizeUrl(page.original?.source),
    pageUrl: imagePageUrl(fileTitle),
    fileTitle,
  });
}

function licenseFromExtMetadata(extmetadata = {}) {
  const valueFor = (key) => stripHtml(extmetadata[key]?.value);
  const copyrighted = valueFor('Copyrighted');
  return compactObject({
    shortName: valueFor('LicenseShortName'),
    usageTerms: valueFor('UsageTerms'),
    licenseUrl: normalizeUrl(valueFor('LicenseUrl')),
    copyrighted:
      copyrighted == null
        ? null
        : String(copyrighted).toLowerCase() === 'true'
          ? true
          : String(copyrighted).toLowerCase() === 'false'
            ? false
            : null,
    attribution: valueFor('Attribution'),
    credit: valueFor('Credit'),
    artist: valueFor('Artist'),
  });
}

function mergeImageInfo(candidate, imageInfoPage) {
  const imageInfo = imageInfoPage?.imageinfo?.[0] || {};
  return compactObject({
    ...candidate,
    imageUrl: normalizeUrl(imageInfo.url) || candidate.imageUrl,
    pageUrl: normalizeUrl(imageInfo.descriptionurl) || candidate.pageUrl,
    fileTitle: imageInfoPage?.title || candidate.fileTitle,
    mimeType: toText(imageInfo.mime),
    width: Number.isInteger(imageInfo.width) ? imageInfo.width : null,
    height: Number.isInteger(imageInfo.height) ? imageInfo.height : null,
    license: licenseFromExtMetadata(imageInfo.extmetadata),
  });
}

async function enrichCandidatesWithImageInfo(candidates) {
  const fileTitles = candidates.map((candidate) => candidate.fileTitle).filter(Boolean);
  if (!fileTitles.length) return candidates;
  const response = await fetchJson(imageInfoApiUrl(fileTitles));
  const pages = Object.values(response?.query?.pages || {});
  const byTitle = new Map(pages.map((page) => [normalizedFileTitleKey(page.title), page]));

  return candidates.map((candidate) => {
    return mergeImageInfo(candidate, byTitle.get(normalizedFileTitleKey(candidate.fileTitle)));
  });
}

async function discoverWikipediaPageImageCandidate(articleTitle, license) {
  const response = await fetchJson(pageImagesApiUrl(articleTitle, license));
  const page = Object.values(response?.query?.pages || {})[0];
  const source =
    license === 'free'
      ? CLUB_ASSET_SOURCE_IDS.wikipediaPageImageFree
      : CLUB_ASSET_SOURCE_IDS.wikipediaPageImageAny;
  const candidate = candidateFromPageImage(page, source);
  return candidate ? [candidate] : [];
}

async function discoverWikidataLogoCandidates(articleTitle) {
  const pageResponse = await fetchJson(pageImagesApiUrl(articleTitle, 'any'));
  const page = Object.values(pageResponse?.query?.pages || {})[0];
  const wikibaseItem = page?.pageprops?.wikibase_item;
  if (!wikibaseItem) return [];

  const entityResponse = await fetchJson(wikidataEntitiesApiUrl([wikibaseItem]));
  const entity = entityResponse?.entities?.[wikibaseItem];
  const logos = entity?.claims?.P154 || [];
  return logos
    .map((claim) => claim?.mainsnak?.datavalue?.value)
    .filter(Boolean)
    .map((fileName) =>
      compactObject({
        assetId: buildAssetId(CLUB_ASSET_SOURCE_IDS.wikidataLogo, `File:${fileName}`, null),
        kind: 'crest',
        status: 'needs-review',
        source: CLUB_ASSET_SOURCE_IDS.wikidataLogo,
        sourceUrl: `https://www.wikidata.org/wiki/${wikibaseItem}`,
        pageUrl: imagePageUrl(`File:${fileName}`),
        fileTitle: `File:${fileName}`,
      })
    );
}

export async function discoverClubCrestBundle(club, options = {}) {
  const articleTitle = wikipediaArticleTitle(club);
  if (!articleTitle) return buildClubAssetBundle([]);

  const checkedAt = options.checkedAt || new Date().toISOString();
  const rawCandidates = [];
  const discoverySteps = [
    () => discoverWikipediaPageImageCandidate(articleTitle, 'free'),
    () => discoverWikidataLogoCandidates(articleTitle),
    () => discoverWikipediaPageImageCandidate(articleTitle, 'any'),
  ];

  for (const step of discoverySteps) {
    try {
      rawCandidates.push(...(await step()));
    } catch (error) {
      if (options.throwOnSourceError) throw error;
    }
  }

  let enrichedCandidates = rawCandidates;
  try {
    enrichedCandidates = await enrichCandidatesWithImageInfo(rawCandidates);
  } catch (error) {
    if (options.throwOnSourceError) throw error;
  }
  const classifiedCandidates = enrichedCandidates.map((candidate) =>
    classifyClubAssetCandidate(candidate, club, { checkedAt })
  );
  return buildClubAssetBundle(classifiedCandidates, { limit: options.limit || 5 });
}
