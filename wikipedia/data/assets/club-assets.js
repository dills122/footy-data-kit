// @ts-check

import https from 'node:https';

export const CLUB_ASSET_SOURCE_IDS = Object.freeze({
  generatedPlaceholder: 'generated-placeholder',
  theSportsDbBadge: 'thesportsdb-badge',
  theSportsDbLogo: 'thesportsdb-logo',
  wikidataLogo: 'wikidata-logo',
  wikidataCoatOfArms: 'wikidata-coat-of-arms',
  wikidataImage: 'wikidata-image',
  wikipediaPageImageFree: 'wikipedia-pageimage-free',
  wikipediaPageImageAny: 'wikipedia-pageimage-any',
});

const USER_AGENT = 'footy-data-kit/club-assets (https://github.com/dills122/footy-data-kit)';
const THESPORTSDB_API_BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3';
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
const WIKIDATA_MEDIA_PROPERTIES = Object.freeze([
  { property: 'P154', source: CLUB_ASSET_SOURCE_IDS.wikidataLogo },
  { property: 'P94', source: CLUB_ASSET_SOURCE_IDS.wikidataCoatOfArms },
  { property: 'P18', source: CLUB_ASSET_SOURCE_IDS.wikidataImage },
]);
const TRUSTED_WIKIDATA_CREST_SOURCES = Object.freeze([CLUB_ASSET_SOURCE_IDS.wikidataCoatOfArms]);
const QUALITY_REVIEW_NOTES =
  'Manual audit flagged this crest candidate for poor readability, image quality, or transparent-background visibility.';
const REJECTED_ASSET_IDS = Object.freeze(
  new Set([
    'wikidata-image:Andover-2008-Squad.jpg',
    'wikidata-image:Bishop Auckland Town Hall.jpg',
    'wikidata-image:Bromsgrove Rovers 2003-04 1.jpg',
    'wikidata-image:Dagenham village.jpg',
    'wikidata-image:DovervStaines.jpg',
    'wikidata-image:Hounslow High Street.1.JPG',
    'wikidata-image:Loughborough Town Hall - geograph.org.uk - 3932.jpg',
    'wikidata-image:Man united vs derby.jpg',
    'wikidata-image:Marine F.C..jpg',
    'wikidata-image:New Brighton Tower RHE.jpg',
    'wikidata-image:PPS-EastStand01.JPG',
    'wikidata-image:River thames oxford.jpg',
    'wikidata-image:Shepshed Ground 001 Small.jpg',
    'wikidata-image:St Paul, Addlestone - geograph.org.uk - 1517212.jpg',
    'wikidata-image:Swansea City AFC Championship Play Off Winners 2011.jpg',
    'wikidata-image:Town Hall. - geograph.org.uk - 525051.jpg',
    'wikidata-image:Trowbridge Town F.C..jpg',
    'wikipedia-pageimage-any:Beam_valley_park_and_turbine_1.jpg',
    'wikipedia-pageimage-any:Crown_Ground_sign-geograph-1761360.jpg',
    'wikipedia-pageimage-any:Epsom_and_Ewell_UK_locator_map.svg',
    'wikipedia-pageimage-any:Folkestone_Harbour_with_Viaduct_and_Swing_Bridge.png',
    'wikipedia-pageimage-any:London_Thames_Sunset_panorama_-_Feb_2008.jpg',
    'wikipedia-pageimage-any:New_Brighton_Tower.jpg',
    'wikipedia-pageimage-any:Town_Hall_-_Market_Place_(geograph_2938168).jpg',
    'wikipedia-pageimage-free:Altrincham_Town_Square_-_2024.jpg',
    'wikipedia-pageimage-free:Angel_of_the_North,_Gateshead,_United_Kingdom.jpg',
    'wikipedia-pageimage-free:Atherstone_Town_FC_2009.jpg',
    'wikipedia-pageimage-free:Beam_valley_park_and_turbine_1.jpg',
    'wikipedia-pageimage-free:Bishop_Auckland_Town_Hall.jpg',
    'wikipedia-pageimage-free:Bootle_Town_Hall_2020-1.jpg',
    'wikipedia-pageimage-free:BroadLaneWivenhoeTown21Jan2017.jpg',
    'wikipedia-pageimage-free:Bromley_-_geograph.org.uk_-_4623007.jpg',
    'wikipedia-pageimage-free:Bromley_FC_League_Performance.svg',
    'wikipedia-pageimage-free:Centre_of_Hereford_-_geograph.org.uk_-_4306743.jpg',
    'wikipedia-pageimage-free:Chester_-_Shops_in_city_centre_-_2005-10-09.jpg',
    'wikipedia-pageimage-free:Citadel-1.jpg',
    'wikipedia-pageimage-free:Clevedon_Town_2007.jpg',
    'wikipedia-pageimage-free:Crown_Ground_sign-geograph-1761360.jpg',
    'wikipedia-pageimage-free:Darlington_clock_tower_and_market_hall_(geograph_6299652).jpg',
    'wikipedia-pageimage-free:DrippingPan.jpg',
    'wikipedia-pageimage-free:Exeter_City_match.JPG',
    'wikipedia-pageimage-free:Glossop_-_geograph.org.uk_-_7292918.jpg',
    'wikipedia-pageimage-free:Hendon_Town_Hall_in_December_2011.JPG',
    'wikipedia-pageimage-free:Hereford_United_League_Performance.svg',
    'wikipedia-pageimage-free:High_Street_Dunstable_-_geograph.org.uk_-_6524692.jpg',
    'wikipedia-pageimage-free:Hounslow_High_Street.1.JPG',
    'wikipedia-pageimage-free:H\u00F4tel_ville_South_Shields_South_Tyneside_28.jpg',
    'wikipedia-pageimage-free:Lewes-udsigt.jpg',
    'wikipedia-pageimage-free:LeytonCentre.JPG',
    'wikipedia-pageimage-free:London_Thames_Sunset_panorama_-_Feb_2008.jpg',
    'wikipedia-pageimage-free:Maidenhead_v_Barnet_022.jpg',
    'wikipedia-pageimage-free:Middlesborough_Town_Hall_image_by_Robert_Eva.jpg',
    'wikipedia-pageimage-free:New_Brighton_Tower.jpg',
    'wikipedia-pageimage-free:New_North_Bank.jpg',
    'wikipedia-pageimage-free:Old_Town_Hall_Eastleigh.JPG',
    'wikipedia-pageimage-free:Peterborough_Sports_vs_Guiseley_FC_-_FA_Cup_3rd_qualifying_round_2019.jpg',
    'wikipedia-pageimage-free:Ryan_Valentine_scores.jpg',
    'wikipedia-pageimage-free:Silver_Jubilee_Bridge,_Runcorn,_night,_2024.jpg',
    'wikipedia-pageimage-free:St_Paul,_Addlestone_-_geograph.org.uk_-_1517212.jpg',
    'wikipedia-pageimage-free:The_Main_Stand_at_Court_Place_Farm_-_geograph.org.uk_-_1245335.jpg',
    'wikipedia-pageimage-free:Town_Hall_-_Market_Place_(geograph_2938168).jpg',
  ])
);
const CURATED_ASSET_DECISIONS = Object.freeze({
  'wikipedia-pageimage-free:Leeds_old_arms.png': {
    clubIds: ['leeds-city'],
    status: 'usable',
    identityMatch: 'curated',
    notes: 'Curated as an acceptable Leeds City historical crest/arms candidate.',
  },
});
const QUALITY_REVIEW_ASSET_DECISIONS = Object.freeze({
  'wikipedia-pageimage-any:AFC_Telford_United_logo.svg': {
    clubIds: ['afc-telford-united', 'telford-united'],
    reviewReasons: ['image-quality-review'],
    notes: QUALITY_REVIEW_NOTES,
  },
  'wikipedia-pageimage-any:Bridgendtown.png': {
    clubIds: ['bridgend-town'],
    reviewReasons: ['image-quality-review'],
    notes: QUALITY_REVIEW_NOTES,
  },
  'wikipedia-pageimage-any:Bromsgrove_Rovers_Badge.jpg': {
    clubIds: ['bromsgrove-rovers'],
    reviewReasons: ['image-quality-review'],
    notes: QUALITY_REVIEW_NOTES,
  },
  'wikipedia-pageimage-any:Derby_County_crest.svg': {
    clubIds: ['derby-county'],
    reviewReasons: ['image-quality-review'],
    notes: QUALITY_REVIEW_NOTES,
  },
  'wikipedia-pageimage-any:Marine_AFC_crest.svg': {
    clubIds: ['marine'],
    reviewReasons: ['image-quality-review'],
    notes: QUALITY_REVIEW_NOTES,
  },
  'wikipedia-pageimage-any:Solihullboroughafc.jpg': {
    clubIds: ['solihull-borough'],
    reviewReasons: ['image-quality-review'],
    notes: QUALITY_REVIEW_NOTES,
  },
  'wikipedia-pageimage-any:Swansea_City_AFC_logo.svg': {
    clubIds: ['swansea-city'],
    reviewReasons: ['image-quality-review'],
    notes: QUALITY_REVIEW_NOTES,
  },
  'wikipedia-pageimage-any:Tottenham_Hotspur.svg': {
    clubIds: ['tottenham-hotspur'],
    reviewReasons: ['image-quality-review'],
    notes: QUALITY_REVIEW_NOTES,
  },
  'wikipedia-pageimage-any:Wittonalbionfc.png': {
    clubIds: ['witton-albion'],
    reviewReasons: ['image-quality-review'],
    notes: QUALITY_REVIEW_NOTES,
  },
});
const GENERATED_PLACEHOLDER_LICENSE = Object.freeze({
  shortName: 'CC0-1.0',
  usageTerms: 'Creative Commons Zero v1.0 Universal',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  copyrighted: false,
  attribution: 'footy-data-kit generated placeholder',
});
const THESPORTSDB_ARTWORK_LICENSE = Object.freeze({
  shortName: 'TheSportsDB API artwork',
  usageTerms:
    'Artwork URL returned by TheSportsDB API; club marks may be trademarked or copyright restricted.',
  licenseUrl: 'https://www.thesportsdb.com/docs_terms_of_use.php',
  copyrighted: true,
  attribution: 'TheSportsDB',
});
const HISTORICAL_PLACEHOLDER_CRESTS = Object.freeze({
  'birmingham-st-georges': {
    colors: [
      { role: 'primary', hex: '#FFFFFF' },
      { role: 'secondary', hex: '#000000' },
    ],
  },
  'burton-swifts': {
    colors: [
      { role: 'primary', hex: '#FF0000' },
      { role: 'secondary', hex: '#FFFFFF' },
      { role: 'accent', hex: '#000099' },
    ],
  },
  'burton-united': {
    colors: [
      { role: 'primary', hex: '#663300' },
      { role: 'secondary', hex: '#87CEEB' },
      { role: 'accent', hex: '#FFFFFF' },
    ],
  },
  'burton-wanderers': {
    colors: [
      { role: 'primary', hex: '#FFFFFF' },
      { role: 'secondary', hex: '#0057B8' },
      { role: 'accent', hex: '#333333' },
    ],
  },
  'middlesbrough-ironopolis': {
    colors: [
      { role: 'primary', hex: '#CC0033' },
      { role: 'secondary', hex: '#000000' },
      { role: 'accent', hex: '#FFFFFF' },
    ],
  },
  'oswestry-town': {
    colors: [
      { role: 'primary', hex: '#0000FF' },
      { role: 'secondary', hex: '#FFFFFF' },
    ],
  },
  'rotherham-town': {
    colors: [
      { role: 'primary', hex: '#FF0000' },
      { role: 'secondary', hex: '#1C1271' },
    ],
  },
  'sunderland-albion': {
    colors: [
      { role: 'primary', hex: '#000066' },
      { role: 'secondary', hex: '#FFFFFF' },
    ],
  },
});

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

function slugify(value) {
  return normalizeTokenText(value).replace(/\s+/g, '-');
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeHexColor(value, fallback) {
  const text = String(value || '').trim();
  const normalized = text.startsWith('#') ? text : `#${text}`;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback;
}

function normalizeOptionalHexColor(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.startsWith('#') ? text : `#${text}`;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : null;
}

function hexColorChannels(value) {
  const normalized = normalizeHexColor(value, '#000000').slice(1);
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function contrastTextColor(backgroundColor) {
  const { red, green, blue } = hexColorChannels(backgroundColor);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 155 ? '#111111' : '#FFFFFF';
}

function clubInitials(club) {
  const tokens = significantTokens(club?.canonicalName || club?.clubId || '');
  return tokens
    .slice(0, 3)
    .map((token) => token[0]?.toUpperCase())
    .join('');
}

function firstWikipediaClubPageUrl(club) {
  return [
    ...(club?.derived?.identitySources || []),
    ...(club?.status?.sourceRefs || []),
  ].find((source) => source.type === 'wikipedia-club-page')?.sourceUrl;
}

function svgDataUrl(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function buildPlaceholderSvg(club, colors) {
  const primary = normalizeHexColor(colors[0]?.hex, '#555555');
  const secondary = normalizeHexColor(colors[1]?.hex, '#EEEEEE');
  const accent = normalizeHexColor(colors[2]?.hex, secondary);
  const textFill = contrastTextColor(primary);
  const textStroke = textFill === '#FFFFFF' ? '#111111' : '#FFFFFF';
  const title = `${club?.canonicalName || 'Club'} generated placeholder crest`;
  const initials = clubInitials(club) || 'FC';

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img">',
    `<title>${escapeXml(title)}</title>`,
    `<path d="M128 14 220 48v68c0 58-36 103-92 126-56-23-92-68-92-126V48l92-34Z" fill="${primary}" stroke="${accent}" stroke-width="10"/>`,
    `<path d="M128 26 210 56v58c0 49-30 88-82 110V26Z" fill="${secondary}" opacity="0.92"/>`,
    `<path d="M50 84h156v30H50z" fill="${accent}" opacity="0.9"/>`,
    `<text x="128" y="154" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" fill="${textFill}" stroke="${textStroke}" stroke-width="3" paint-order="stroke">${escapeXml(initials)}</text>`,
    '</svg>',
  ].join('');
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

function isTheSportsDbSource(source) {
  return (
    source === CLUB_ASSET_SOURCE_IDS.theSportsDbBadge ||
    source === CLUB_ASSET_SOURCE_IDS.theSportsDbLogo
  );
}

function theSportsDbTeamNameFromCandidate(candidate) {
  const text = String(candidate?.fileTitle || '').replace(/^TheSportsDB:/, '');
  return text.replace(/\s+(badge|logo)$/i, '').trim();
}

function theSportsDbTeamNamesFromCandidate(candidate) {
  return [theSportsDbTeamNameFromCandidate(candidate)].map(toText).filter(Boolean);
}

function classifyTheSportsDbAssetIdentity(candidate, club) {
  const candidateNames = theSportsDbTeamNamesFromCandidate(candidate)
    .map(normalizedCompactText)
    .filter(Boolean);
  const clubNames = [club?.canonicalName, club?.clubId, ...(club?.derived?.aliases || [])]
    .map(normalizedCompactText)
    .filter(Boolean);

  if (candidateNames.some((candidateName) => clubNames.includes(candidateName))) return 'strong';
  return candidateNames.length && clubNames.length ? 'none' : 'weak';
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
  if (isTheSportsDbSource(candidate.source)) {
    return classifyTheSportsDbAssetIdentity(candidate, club);
  }

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
  if (
    TRUSTED_WIKIDATA_CREST_SOURCES.includes(candidate.source) &&
    ['possible', 'strong'].includes(identityMatch)
  ) {
    return true;
  }
  const extension = fileExtension(candidate.fileTitle || candidate.imageUrl);
  return (
    candidate.source === CLUB_ASSET_SOURCE_IDS.wikipediaPageImageAny &&
    ['possible', 'strong'].includes(identityMatch) &&
    ['svg', 'png'].includes(extension)
  );
}

function curatedAssetDecision(candidate, club) {
  const decision = CURATED_ASSET_DECISIONS[candidate.assetId];
  if (!decision) return null;
  const clubId = club?.clubId || slugify(club?.canonicalName || '');
  if (decision.clubIds && !decision.clubIds.includes(clubId)) return null;
  return decision;
}

function qualityReviewAssetDecision(candidate, club) {
  const decision = QUALITY_REVIEW_ASSET_DECISIONS[candidate.assetId];
  if (!decision) return null;
  const clubId = club?.clubId || slugify(club?.canonicalName || '');
  if (decision.clubIds && !decision.clubIds.includes(clubId)) return null;
  return decision;
}

export function isRejectedClubAssetCandidate(candidate) {
  return REJECTED_ASSET_IDS.has(candidate?.assetId);
}

export function classifyClubAssetCandidate(candidate, club, { checkedAt = null } = {}) {
  const licenseCheck = classifyAssetLicense(candidate.license || {});
  const isGeneratedPlaceholder =
    candidate.placeholder || candidate.source === CLUB_ASSET_SOURCE_IDS.generatedPlaceholder;
  if (isGeneratedPlaceholder) {
    const reviewReasons = candidate.imageUrl ? [] : ['image-url-missing'];
    const status = candidate.imageUrl ? 'placeholder' : 'failed';
    return {
      ...candidate,
      status,
      verification: compactObject({
        ...(candidate.verification || {}),
        identityMatch: 'generated-placeholder',
        licenseCheck,
        httpCheck: candidate.imageUrl ? 'pass' : 'fail',
        needsManualReview: status !== 'placeholder',
        reviewReasons,
        checkedAt,
      }),
    };
  }

  const identityMatch = classifyAssetIdentity(candidate, club);
  const likelyCrestCandidate = isLikelyCrestCandidate(candidate, identityMatch);
  const curatedDecision = curatedAssetDecision(candidate, club);
  const qualityReviewDecision = qualityReviewAssetDecision(candidate, club);
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
  } else if (
    licenseCheck === 'pass' &&
    ['strong', 'possible'].includes(identityMatch) &&
    likelyCrestCandidate
  ) {
    status = 'usable';
  }
  if (curatedDecision?.status === 'usable' && licenseCheck === 'pass' && candidate.imageUrl) {
    status = 'usable';
    reviewReasons.length = 0;
  }
  if (qualityReviewDecision) {
    reviewReasons.push(...qualityReviewDecision.reviewReasons);
  }

  return {
    ...candidate,
    status,
    notes: candidate.notes || curatedDecision?.notes || qualityReviewDecision?.notes,
    verification: compactObject({
      ...(candidate.verification || {}),
      identityMatch: curatedDecision?.identityMatch || identityMatch,
      licenseCheck,
      httpCheck: candidate.imageUrl ? 'pass' : 'fail',
      needsManualReview: status !== 'usable' || reviewReasons.length > 0,
      reviewReasons,
      checkedAt,
    }),
  };
}

function statusRank(status) {
  if (status === 'usable') return 0;
  if (status === 'placeholder') return 1;
  if (status === 'restricted') return 1;
  if (status === 'needs-review') return 2;
  if (status === 'failed') return 4;
  return 3;
}

function sourceRank(source) {
  if (source === CLUB_ASSET_SOURCE_IDS.generatedPlaceholder) return 0;
  if (source === CLUB_ASSET_SOURCE_IDS.wikidataLogo) return 0;
  if (source === CLUB_ASSET_SOURCE_IDS.wikidataCoatOfArms) return 1;
  if (source === CLUB_ASSET_SOURCE_IDS.wikipediaPageImageFree) return 2;
  if (source === CLUB_ASSET_SOURCE_IDS.theSportsDbBadge) return 3;
  if (source === CLUB_ASSET_SOURCE_IDS.theSportsDbLogo) return 4;
  if (source === CLUB_ASSET_SOURCE_IDS.wikidataImage) return 5;
  if (source === CLUB_ASSET_SOURCE_IDS.wikipediaPageImageAny) return 6;
  return 7;
}

export function rankClubAssetCandidates(candidates, limit = 5) {
  const sortedCandidates = (candidates || [])
    .filter((candidate) => candidate?.assetId)
    .sort((left, right) => {
      const statusDelta = statusRank(left.status) - statusRank(right.status);
      if (statusDelta) return statusDelta;
      const sourceDelta = sourceRank(left.source) - sourceRank(right.source);
      if (sourceDelta) return sourceDelta;
      const leftCrest = hasCrestFileToken(left.fileTitle) ? 0 : 1;
      const rightCrest = hasCrestFileToken(right.fileTitle) ? 0 : 1;
      if (leftCrest !== rightCrest) return leftCrest - rightCrest;
      return String(left.assetId).localeCompare(String(right.assetId));
    });
  const seen = new Set();
  const deduped = [];
  for (const candidate of sortedCandidates) {
    const dedupeKey =
      candidate.imageUrl || normalizedFileTitleKey(candidate.fileTitle) || candidate.assetId;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(candidate);
  }

  return deduped
    .slice(0, limit)
    .map((candidate, index) => ({ ...candidate, priority: index + 1 }));
}

export function buildClubAssetBundle(candidates, { limit = 5 } = {}) {
  const rankedCandidates = rankClubAssetCandidates(candidates, limit);
  const preferredCandidate =
    rankedCandidates.find((candidate) => candidate.status === 'usable') ||
    rankedCandidates.find((candidate) => candidate.status === 'placeholder');
  const status = preferredCandidate?.status || rankedCandidates[0]?.status || 'needs-more-research';

  return compactObject({
    preferred: preferredCandidate?.assetId || null,
    status,
    candidates: rankedCandidates,
  });
}

export function buildGeneratedPlaceholderCrestCandidate(club, { checkedAt = null } = {}) {
  const placeholderConfig = HISTORICAL_PLACEHOLDER_CRESTS[club?.clubId];
  if (!placeholderConfig) return null;

  const slug = slugify(club?.clubId || club?.canonicalName || 'club');
  const fileTitle = `Generated:${slug}-placeholder-crest.svg`;
  const colors = placeholderConfig.colors.map((color) => ({
    role: color.role,
    hex: normalizeHexColor(color.hex, '#555555'),
  }));
  const imageUrl = svgDataUrl(buildPlaceholderSvg(club, colors));

  return compactObject({
    assetId: buildAssetId(CLUB_ASSET_SOURCE_IDS.generatedPlaceholder, fileTitle, null),
    kind: 'crest',
    status: 'placeholder',
    source: CLUB_ASSET_SOURCE_IDS.generatedPlaceholder,
    placeholder: true,
    sourceUrl: firstWikipediaClubPageUrl(club) || null,
    imageUrl,
    fileTitle,
    mimeType: 'image/svg+xml',
    width: 256,
    height: 256,
    colors,
    license: GENERATED_PLACEHOLDER_LICENSE,
    verification: compactObject({
      identityMatch: 'generated-placeholder',
      licenseCheck: 'pass',
      httpCheck: 'pass',
      needsManualReview: false,
      checkedAt,
    }),
    notes:
      'Generated placeholder shield from source-backed club colours; not an official or historical club crest.',
  });
}

export function addGeneratedPlaceholderFallback(club, bundle, { checkedAt = null, limit = 5 } = {}) {
  if (bundle?.candidates?.length) return bundle;
  const placeholderCandidate = buildGeneratedPlaceholderCrestCandidate(club, { checkedAt });
  if (!placeholderCandidate) return bundle;
  return buildClubAssetBundle([placeholderCandidate], { limit });
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
      type: 'club-asset-needs-more-research',
      ...baseIssue,
      message: `${baseIssue.canonicalName} needs more crest asset research`,
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
    if (candidate.verification?.reviewReasons?.includes('image-quality-review')) {
      issues.push({
        type: 'club-asset-quality-review',
        ...baseIssue,
        assetId: candidate.assetId,
        source: candidate.source,
        message: `${baseIssue.canonicalName} crest candidate needs a better quality or more readable image`,
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

function wikipediaPageTitleFromUrl(sourceUrl) {
  const url = String(sourceUrl || '');
  if (!url.startsWith('https://en.wikipedia.org/wiki/')) return null;
  const pageTitle = decodeURIComponent(url.split('/wiki/')[1] || '').replace(/_/g, ' ');
  return toText(pageTitle);
}

function pushUniqueTitle(titles, title) {
  const normalizedTitle = toText(title);
  if (!normalizedTitle) return;
  const dedupeKey = normalizedTitle.toLowerCase();
  if (titles.some((entry) => entry.toLowerCase() === dedupeKey)) return;
  titles.push(normalizedTitle);
}

function buildTitleGuesses(name) {
  const title = toText(name);
  if (!title) return [];
  const guesses = [title];
  if (/^AFC\s+/i.test(title)) {
    guesses.push(title.replace(/^AFC\s+/i, 'A.F.C. '));
  }
  if (/^FC\s+/i.test(title)) {
    guesses.push(title.replace(/^FC\s+/i, 'F.C. '));
  }
  if (!/\b(A\.?F\.?C\.?|F\.?C\.?)$/i.test(title)) {
    guesses.push(`${title} F.C.`);
    guesses.push(`${title} A.F.C.`);
  }
  return guesses;
}

export function buildWikipediaArticleTitles(club) {
  const titles = [];
  const identitySources = [
    ...(club?.derived?.identitySources || []),
    ...(club?.status?.sourceRefs || []),
  ];
  const clubPageSources = identitySources.filter(
    (source) => source.type === 'wikipedia-club-page'
  );
  const otherWikiSources = identitySources.filter(
    (source) => source.type !== 'wikipedia-club-page'
  );

  for (const source of clubPageSources) {
    pushUniqueTitle(titles, wikipediaPageTitleFromUrl(source.sourceUrl));
  }
  for (const name of [club?.canonicalName, ...(club?.derived?.aliases || [])]) {
    for (const guess of buildTitleGuesses(name)) {
      pushUniqueTitle(titles, guess);
    }
  }
  for (const source of otherWikiSources) {
    pushUniqueTitle(titles, wikipediaPageTitleFromUrl(source.sourceUrl));
  }

  return titles.slice(0, 8);
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

function theSportsDbSearchApiUrl(teamName) {
  const params = new URLSearchParams({ t: teamName });
  return `${THESPORTSDB_API_BASE_URL}/searchteams.php?${params.toString()}`;
}

function theSportsDbLookupApiUrl(teamId) {
  const params = new URLSearchParams({ id: teamId });
  return `${THESPORTSDB_API_BASE_URL}/lookupteam.php?${params.toString()}`;
}

function theSportsDbColorHints(team) {
  return [
    { role: 'primary', hex: normalizeOptionalHexColor(team?.strColour1) },
    { role: 'secondary', hex: normalizeOptionalHexColor(team?.strColour2) },
    { role: 'accent', hex: normalizeOptionalHexColor(team?.strColour3) },
  ].filter((color) => color.hex);
}

function theSportsDbCandidateNotes(team) {
  const alternateNames = String(team?.strTeamAlternate || '')
    .split(/[;,/]/)
    .map(toText)
    .filter(Boolean);
  const notes = [`TheSportsDB team: ${team?.strTeam || 'unknown'}.`];
  if (alternateNames.length) notes.push(`Also known as ${alternateNames.join(', ')}.`);
  return notes.join(' ');
}

function theSportsDbCandidateFromTeam(team, { source, imageUrl, label }) {
  const teamId = toText(team?.idTeam);
  const teamName = toText(team?.strTeam);
  if (!teamId || !teamName || !imageUrl) return null;

  return compactObject({
    assetId: `${source}:${teamId}`,
    kind: 'crest',
    status: 'needs-review',
    source,
    sourceUrl: theSportsDbLookupApiUrl(teamId),
    imageUrl: normalizeUrl(imageUrl),
    pageUrl: `https://www.thesportsdb.com/team/${teamId}`,
    fileTitle: `TheSportsDB:${teamName} ${label}`,
    colors: theSportsDbColorHints(team),
    license: THESPORTSDB_ARTWORK_LICENSE,
    notes: theSportsDbCandidateNotes(team),
  });
}

export function buildTheSportsDbSearchNames(club) {
  const names = [];
  for (const name of [club?.canonicalName, ...(club?.derived?.aliases || [])]) {
    const normalizedName = toText(name);
    if (!normalizedName) continue;
    const dedupeKey = normalizedName.toLowerCase();
    if (!names.some((entry) => entry.toLowerCase() === dedupeKey)) names.push(normalizedName);
  }
  return names.slice(0, 6);
}

export function buildTheSportsDbAssetCandidates(team) {
  if (String(team?.strSport || '').toLowerCase() !== 'soccer') return [];
  return [
    theSportsDbCandidateFromTeam(team, {
      source: CLUB_ASSET_SOURCE_IDS.theSportsDbBadge,
      imageUrl: team?.strBadge,
      label: 'badge',
    }),
    theSportsDbCandidateFromTeam(team, {
      source: CLUB_ASSET_SOURCE_IDS.theSportsDbLogo,
      imageUrl: team?.strLogo,
      label: 'logo',
    }),
  ].filter(Boolean);
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
  const fileTitles = candidates
    .map((candidate) => candidate.fileTitle)
    .filter((fileTitle) => String(fileTitle || '').startsWith('File:'));
  if (!fileTitles.length) return candidates;
  const response = await fetchJson(imageInfoApiUrl(fileTitles));
  const pages = Object.values(response?.query?.pages || {});
  const byTitle = new Map(pages.map((page) => [normalizedFileTitleKey(page.title), page]));

  return candidates.map((candidate) => {
    if (!String(candidate.fileTitle || '').startsWith('File:')) return candidate;
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

async function discoverWikidataMediaCandidates(articleTitle) {
  const pageResponse = await fetchJson(pageImagesApiUrl(articleTitle, 'any'));
  const page = Object.values(pageResponse?.query?.pages || {})[0];
  const wikibaseItem = page?.pageprops?.wikibase_item;
  if (!wikibaseItem) return [];

  const entityResponse = await fetchJson(wikidataEntitiesApiUrl([wikibaseItem]));
  const entity = entityResponse?.entities?.[wikibaseItem];
  const candidates = [];
  for (const mediaProperty of WIKIDATA_MEDIA_PROPERTIES) {
    for (const claim of entity?.claims?.[mediaProperty.property] || []) {
      const fileName = claim?.mainsnak?.datavalue?.value;
      if (!fileName) continue;
      candidates.push(
        compactObject({
          assetId: buildAssetId(mediaProperty.source, `File:${fileName}`, null),
          kind: 'crest',
          status: 'needs-review',
          source: mediaProperty.source,
          sourceUrl: `https://www.wikidata.org/wiki/${wikibaseItem}`,
          pageUrl: imagePageUrl(`File:${fileName}`),
          fileTitle: `File:${fileName}`,
        })
      );
    }
  }
  return candidates;
}

async function discoverTheSportsDbCandidates(club) {
  const teamsById = new Map();
  for (const searchName of buildTheSportsDbSearchNames(club)) {
    const response = await fetchJson(theSportsDbSearchApiUrl(searchName));
    for (const team of response?.teams || []) {
      if (!team?.idTeam || String(team.strSport || '').toLowerCase() !== 'soccer') continue;
      if (teamsById.has(team.idTeam)) continue;
      teamsById.set(team.idTeam, team);
    }
  }

  return [...teamsById.values()].flatMap((team) => buildTheSportsDbAssetCandidates(team));
}

export async function discoverClubCrestBundle(club, options = {}) {
  const articleTitles = buildWikipediaArticleTitles(club);
  const checkedAt = options.checkedAt || new Date().toISOString();
  const rawCandidates = [];
  for (const articleTitle of articleTitles) {
    const discoverySteps = [
      () => discoverWikipediaPageImageCandidate(articleTitle, 'free'),
      () => discoverWikidataMediaCandidates(articleTitle),
      () => discoverWikipediaPageImageCandidate(articleTitle, 'any'),
    ];

    for (const step of discoverySteps) {
      try {
        rawCandidates.push(...(await step()));
      } catch (error) {
        if (options.throwOnSourceError) throw error;
      }
    }
  }
  try {
    rawCandidates.push(...(await discoverTheSportsDbCandidates(club)));
  } catch (error) {
    if (options.throwOnSourceError) throw error;
  }

  let enrichedCandidates = rawCandidates;
  try {
    enrichedCandidates = await enrichCandidatesWithImageInfo(rawCandidates);
  } catch (error) {
    if (options.throwOnSourceError) throw error;
  }
  const filteredCandidates = enrichedCandidates.filter(
    (candidate) => !isRejectedClubAssetCandidate(candidate)
  );
  const classifiedCandidates = filteredCandidates.map((candidate) =>
    classifyClubAssetCandidate(candidate, club, { checkedAt })
  );
  return buildClubAssetBundle(classifiedCandidates, { limit: options.limit || 5 });
}
