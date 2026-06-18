// @ts-check

import * as cheerio from 'cheerio';
import { buildWikipediaArticleUrl } from '../config.js';
import { fetchHtmlForSlug, wait, WIKIPEDIA_FETCH_DELAY_MS } from '../utils.js';

const CLUB_SUFFIX_PATTERN = /\b(?:a\.?f\.?c\.?|f\.?c\.?|football club|association football club|club)\b/gi;
const STOP_WORDS = new Set(['afc', 'fc', 'football', 'club', 'association', 'the', 'and']);
export const TRACKED_LEAGUE_LEVEL_LIMIT = 7;
export const HIGH_CONFIDENCE_LEAGUE_LEVEL_LIMIT = 4;

export const ENGLISH_FOOTBALL_LEAGUE_LEVELS = Object.freeze([
  Object.freeze({ level: 1, names: Object.freeze(['Premier League']) }),
  Object.freeze({ level: 2, names: Object.freeze(['EFL Championship', 'Football League Championship', 'Championship']) }),
  Object.freeze({ level: 3, names: Object.freeze(['EFL League One', 'Football League One', 'League One']) }),
  Object.freeze({ level: 4, names: Object.freeze(['EFL League Two', 'Football League Two', 'League Two']) }),
  Object.freeze({ level: 5, names: Object.freeze(['National League']) }),
  Object.freeze({ level: 6, names: Object.freeze(['National League North', 'National League South']) }),
  Object.freeze({
    level: 7,
    names: Object.freeze([
      'Northern Premier League Premier Division',
      'Southern League Premier Division Central',
      'Southern League Premier Division South',
      'Isthmian League Premier Division',
    ]),
  }),
  Object.freeze({
    level: 8,
    names: Object.freeze([
      'Northern Premier League Division One East',
      'Northern Premier League Division One Midlands',
      'Northern Premier League Division One West',
      'Southern League Division One Central',
      'Southern League Division One South',
      'Isthmian League North Division',
      'Isthmian League South Central Division',
      'Isthmian League South East Division',
    ]),
  }),
  Object.freeze({
    level: 9,
    names: Object.freeze([
      'Combined Counties League Premier Division',
      'Eastern Counties League Premier Division',
      'Essex Senior League',
      'Hellenic League Premier Division',
      'Midland League Premier Division',
      'Northern Counties East League Premier Division',
      'Northern League Division One',
      'North West Counties League Premier Division',
      'Southern Combination Premier Division',
      'Southern Counties East League Premier Division',
      'Spartan South Midlands League Premier Division',
      'United Counties League Premier Division',
      'Wessex League Premier Division',
      'Western League Premier Division',
    ]),
  }),
  Object.freeze({
    level: 10,
    names: Object.freeze([
      'Combined Counties League Division One',
      'Eastern Counties League Division One',
      'Hellenic League Division One',
      'Midland League Division One',
      'Northern Counties East League Division One',
      'Northern League Division Two',
      'North West Counties League Division One',
      'Southern Combination Division One',
      'Southern Counties East League Division One',
      'Spartan South Midlands League Division One',
      'United Counties League Division One',
      'Wessex League Division One',
      'Western League Division One',
    ]),
  }),
]);

function stripDiacritics(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value) {
  return stripDiacritics(value).toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
}

function titleToSlug(value) {
  return String(value || '').trim().replace(/\s+/g, '_');
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function stripClubSuffix(value) {
  return String(value || '').replace(CLUB_SUFFIX_PATTERN, '').replace(/\s+/g, ' ').trim();
}

function significantClubTokens(value) {
  return normalizeText(stripClubSuffix(value))
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token && token.length > 1 && !STOP_WORDS.has(token));
}

function decodeWikipediaSlug(slug) {
  try {
    return decodeURIComponent(String(slug || '').replace(/_/g, ' '));
  } catch {
    return String(slug || '').replace(/_/g, ' ');
  }
}

export function wikipediaSlugFromUrl(sourceUrl) {
  const match = String(sourceUrl || '').match(/\/wiki\/([^#?]+)/);
  return match ? match[1] : null;
}

export function buildWikipediaClubPageCandidates(club) {
  const sourceSlugs = [];
  const sourceRefs = [
    ...(club?.status?.sourceRefs || []),
    ...(club?.derived?.identitySources || []),
    ...((club?.history?.lifecycleEvents || []).flatMap((event) => event.sourceRefs || [])),
  ];

  for (const sourceRef of sourceRefs) {
    if (sourceRef?.type !== 'wikipedia-club-page') continue;
    const slug = wikipediaSlugFromUrl(sourceRef.sourceUrl);
    if (slug) sourceSlugs.push(slug);
  }

  const canonicalName = club?.canonicalName || '';
  const baseTitle = stripClubSuffix(canonicalName) || canonicalName;
  const titleCandidates = [
    canonicalName,
    `${baseTitle} F.C.`,
    `${baseTitle} A.F.C.`,
    `${baseTitle} football club`,
    `${baseTitle} F.C. (football club)`,
  ];

  return uniqueValues([
    ...sourceSlugs,
    ...titleCandidates.map(titleToSlug),
  ]);
}

export async function fetchWikipediaSearchTitles(query, { limit = 5 } = {}) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srlimit', String(limit));
  url.searchParams.set('srsearch', query);
  url.searchParams.set('origin', '*');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wikipedia search failed: HTTP ${response.status}`);
  const payload = await response.json();
  return (payload?.query?.search || [])
    .map((result) => result?.title)
    .filter((title) => typeof title === 'string' && title.trim());
}

function cleanExtractedText(value) {
  return String(value || '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLeagueName(value) {
  return normalizeText(value)
    .replace(/\b(the|division|div)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferEnglishLeagueLevel(value) {
  const normalizedLeague = normalizeLeagueName(value);
  if (!normalizedLeague) return null;

  const leagueNames = ENGLISH_FOOTBALL_LEAGUE_LEVELS.flatMap((entry) =>
    entry.names.map((name) => ({
      level: entry.level,
      normalizedName: normalizeLeagueName(name),
    }))
  ).sort((left, right) => right.normalizedName.length - left.normalizedName.length);

  const exactMatch = leagueNames.find((entry) => normalizedLeague === entry.normalizedName);
  if (exactMatch) return exactMatch.level;

  for (const entry of leagueNames) {
    if (
      normalizedLeague.startsWith(`${entry.normalizedName} `) ||
      entry.normalizedName.startsWith(`${normalizedLeague} `)
    ) {
      return entry.level;
    }
  }

  return null;
}

function assessTrackingCoverageForLeagueLevel(level) {
  if (level == null) {
    return {
      status: 'unknown',
      label: 'Wikipedia does not expose a recognized English pyramid level for the current league.',
    };
  }
  if (level <= HIGH_CONFIDENCE_LEAGUE_LEVEL_LIMIT) {
    return {
      status: 'high-confidence-tracked',
      label: `Level ${level} should be covered by the core tracked league data.`,
    };
  }
  if (level <= TRACKED_LEAGUE_LEVEL_LIMIT) {
    return {
      status: 'tracked-sparse',
      label: `Level ${level} is within tracked coverage, but lower-tier coverage is more sparse.`,
    };
  }
  return {
    status: 'below-tracked-coverage',
    label: `Level ${level} is below the current tracked coverage limit of level ${TRACKED_LEAGUE_LEVEL_LIMIT}.`,
  };
}

function extractLeadSentences($) {
  const paragraphs = [];
  $('#mw-content-text .mw-parser-output > p').each((_, element) => {
    const text = cleanExtractedText($(element).text());
    if (text) paragraphs.push(text);
    return paragraphs.length < 4;
  });
  return paragraphs.join(' ');
}

function extractInfoboxText($) {
  const entries = [];
  $('table.infobox.vcard tr, table.infobox tr').each((_, row) => {
    const label = cleanExtractedText($(row).find('th').first().text());
    const value = cleanExtractedText($(row).find('td').first().text());
    if (label && value) entries.push(`${label}: ${value}`);
  });
  return uniqueValues(entries).join(' ');
}

function extractInfoboxFacts($) {
  const facts = [];
  $('table.infobox.vcard tr, table.infobox tr').each((_, row) => {
    const label = cleanExtractedText($(row).find('th').first().text());
    const value = cleanExtractedText($(row).find('td').first().text());
    if (!label || !value) return;
    facts.push({
      label,
      value,
      text: `${label}: ${value}`,
    });
  });
  return uniqueValues(facts.map((fact) => JSON.stringify(fact))).map((value) => JSON.parse(value));
}

function firstInfoboxFact(facts, labelPattern) {
  return (facts || []).find((fact) => labelPattern.test(normalizeText(fact.label))) || null;
}

function isSeasonLabel(value) {
  return /\b(?:18\d{2}|19\d{2}|20\d{2})(?:[–-]\d{2})?\b/.test(String(value || ''));
}

function parseCurrentLeagueFromInfobox(facts) {
  const fact = firstInfoboxFact(facts, /^(current )?league$/);
  if (!fact) return null;
  return {
    name: fact.value,
    level: inferEnglishLeagueLevel(fact.value),
    evidenceText: fact.text,
  };
}

function extractPageEvidence($) {
  const pageTitle = cleanExtractedText($('#firstHeading').first().text());
  const leadText = extractLeadSentences($);
  const infoboxFacts = extractInfoboxFacts($);
  const infoboxText = extractInfoboxText($);
  const currentLeague = parseCurrentLeagueFromInfobox(infoboxFacts);
  const latestSeasonFact =
    firstInfoboxFact(infoboxFacts, /^(latest|last|current )?season$/) ||
    infoboxFacts.find((fact) => isSeasonLabel(fact.label)) ||
    null;
  const combinedText = cleanExtractedText(`${pageTitle}. ${leadText} ${infoboxText}`);
  return {
    pageTitle,
    leadText,
    infoboxFacts,
    infoboxText,
    currentLeague,
    latestSeason: isSeasonLabel(latestSeasonFact?.label)
      ? latestSeasonFact.label
      : latestSeasonFact?.value || null,
    latestSeasonEvidenceText: latestSeasonFact?.text || null,
    combinedText,
  };
}

function hasEnoughClubTokenOverlap(club, evidence) {
  const tokens = significantClubTokens(club?.canonicalName);
  if (!tokens.length) return false;

  const haystack = normalizeText(`${evidence.pageTitle} ${evidence.leadText}`);
  const matches = tokens.filter((token) => haystack.includes(token));
  if (tokens.length === 1) return matches.length === 1;
  return matches.length >= Math.min(tokens.length, 2);
}

function isLikelyFootballClubPage(evidence) {
  const text = normalizeText(`${evidence.pageTitle} ${evidence.leadText} ${evidence.infoboxText}`);
  return (
    /football club|association football|association club|soccer club/.test(text) ||
    /current league|league:|founded|dissolved|ground/.test(text)
  );
}

function firstMatchingSentence(text, pattern) {
  const sentences = cleanExtractedText(text).split(/(?<=[.!?])\s+/);
  return sentences.find((sentence) => pattern.test(sentence)) || null;
}

function normalizeForContainment(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function textContainsEvidence(text, evidenceText) {
  const haystack = normalizeForContainment(text);
  const needle = normalizeForContainment(evidenceText);
  if (!haystack || !needle) return false;
  return haystack.includes(needle) || needle.includes(haystack);
}

function extractYears(text) {
  return [...String(text || '').matchAll(/\b(18\d{2}|19\d{2}|20\d{2})\b/g)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isInteger);
}

function sourceUrlForSlug(slug) {
  return buildWikipediaArticleUrl(slug);
}

function sourceUrlWithAnchor(pageUrl, anchorId) {
  if (!pageUrl || !anchorId) return pageUrl || null;
  return `${pageUrl}#${encodeURIComponent(anchorId).replace(/%20/g, '_')}`;
}

function sectionMetadataForElement($, element) {
  const heading = $(element).prevAll('h2, h3, h4, h5, h6').first();
  if (!heading.length) {
    return {
      anchorId: null,
      label: 'lead',
    };
  }

  const headline = heading.find('.mw-headline').first();
  const anchorId = headline.attr('id') || heading.attr('id') || null;
  const label = cleanExtractedText(headline.text() || heading.text()) || 'section';
  return { anchorId, label };
}

function findEvidenceSource($, evidenceText, pageUrl) {
  if (!evidenceText) {
    return {
      evidenceSourceUrl: null,
      evidenceSourceLabel: null,
    };
  }

  let matched = null;
  $('table.infobox tr').each((_, row) => {
    if (matched) return false;
    const label = cleanExtractedText($(row).find('th').first().text());
    const value = cleanExtractedText($(row).find('td').first().text());
    const rowText = label && value ? `${label}: ${value}` : cleanExtractedText($(row).text());
    if (!textContainsEvidence(rowText, evidenceText)) return undefined;
    matched = {
      evidenceSourceUrl: pageUrl || null,
      evidenceSourceLabel: 'infobox',
    };
    return false;
  });
  if (matched) return matched;

  $('#mw-content-text .mw-parser-output > p, #mw-content-text .mw-parser-output > ul > li').each(
    (_, element) => {
      if (matched) return false;
      const elementText = cleanExtractedText($(element).text());
      if (!textContainsEvidence(elementText, evidenceText)) return undefined;
      const section = sectionMetadataForElement($, element);
      matched = {
        evidenceSourceUrl: sourceUrlWithAnchor(pageUrl, section.anchorId),
        evidenceSourceLabel: section.label,
      };
      return false;
    }
  );

  return (
    matched || {
      evidenceSourceUrl: pageUrl || null,
      evidenceSourceLabel: 'page',
    }
  );
}

function classifyLifecycleFromInfobox(evidence) {
  const lifecycleFacts = (evidence.infoboxFacts || []).filter((fact) =>
    /\b(?:dissolved|folded|defunct|ceased|merged|amalgamated|wound up|liquidated)\b/.test(
      normalizeText(`${fact.label} ${fact.value}`)
    )
  );
  if (!lifecycleFacts.length) return null;

  return classifyLifecycleText(lifecycleFacts[0].text, 'wikipedia-infobox');
}

function classifyLifecycleText(rawText, basis = 'wikipedia-page-text') {
  const patterns = [
    {
      reason: 'liquidated',
      suggestedCurrent: 'defunct',
      pattern: /\b(?:liquidated|liquidation|wound up|winding-up|winding up)\b/i,
      reasonLabel: 'Wikipedia indicates the club was wound up or liquidated.',
    },
    {
      reason: 'dissolved',
      suggestedCurrent: 'defunct',
      pattern: /\b(?:dissolved|disbanded|ceased to exist|ceased operations|ceased)\b/i,
      reasonLabel: 'Wikipedia indicates the club dissolved or ceased to exist.',
    },
    {
      reason: 'folded',
      suggestedCurrent: 'defunct',
      pattern: /\b(?:folded|folding|fold)\b/i,
      reasonLabel: 'Wikipedia indicates the club folded.',
    },
    {
      reason: 'merged',
      suggestedCurrent: 'merged',
      pattern: /\b(?:merged|amalgamated|amalgamation)\b/i,
      reasonLabel: 'Wikipedia indicates the club merged into another identity.',
    },
    {
      reason: 'expelled',
      suggestedCurrent: 'historical',
      pattern: /\b(?:expelled|expulsion)\b/i,
      reasonLabel: 'Wikipedia indicates the club was expelled from a competition.',
    },
    {
      reason: 'resigned',
      suggestedCurrent: 'historical',
      pattern: /\b(?:resigned from|resignation from)\b/i,
      reasonLabel: 'Wikipedia indicates the club resigned from a competition.',
    },
    {
      reason: 'not-re-elected',
      suggestedCurrent: 'historical',
      pattern: /\b(?:failed re-?election|not re-?elected|voted out)\b/i,
      reasonLabel: 'Wikipedia indicates the club lost its league place through re-election.',
    },
  ];

  for (const entry of patterns) {
    if (!entry.pattern.test(rawText)) continue;
    const evidenceText = firstMatchingSentence(rawText, entry.pattern) || rawText;
    return {
      basis,
      suggestedCurrent: entry.suggestedCurrent,
      suggestedReason: entry.reason,
      suggestedReasonLabel: entry.reasonLabel,
      evidenceText,
      evidenceYears: extractYears(evidenceText),
    };
  }

  return null;
}

function classifyReasonFromEvidence(evidence) {
  const rawText = evidence.combinedText;

  const infoboxLifecycleClassification = classifyLifecycleFromInfobox(evidence);
  if (infoboxLifecycleClassification) return infoboxLifecycleClassification;

  const lifecycleClassification = classifyLifecycleText(rawText);
  if (lifecycleClassification) return lifecycleClassification;

  const activeClassification = classifyActiveBelowTrackedCoverage(evidence);
  if (activeClassification) return activeClassification;

  return {
    basis: 'wikipedia-page-text',
    suggestedCurrent: null,
    suggestedReason: 'unknown',
    suggestedReasonLabel: 'Wikipedia page matched, but no clear lifecycle or active-below-coverage reason was detected.',
    evidenceText: null,
    evidenceYears: [],
  };
}

function classifyActiveBelowTrackedCoverage(evidence) {
  const text = normalizeText(evidence.combinedText);
  const rawText = evidence.combinedText;
  const currentLeague = evidence.currentLeague || null;
  const activeSignal =
    Boolean(currentLeague?.name) ||
    /\bis (?:an? )?(?:semi-professional |professional |association )?football club\b/.test(text) ||
    /\b(?:currently|now) (?:competes?|plays?) in\b/.test(text) ||
    /\bcurrent league\b/.test(text) ||
    /\bmembers? of\b/.test(text);

  if (!activeSignal) return null;

  const currentLeagueLevel = currentLeague?.level ?? null;
  const trackingCoverage = assessTrackingCoverageForLeagueLevel(currentLeagueLevel);
  const isWithinTrackedLevels =
    currentLeagueLevel != null && currentLeagueLevel <= TRACKED_LEAGUE_LEVEL_LIMIT;
  const suggestedReason = isWithinTrackedLevels
    ? 'possibly-missing-from-current-data'
    : 'not-in-tracked-leagues';
  const suggestedReasonLabel = isWithinTrackedLevels
    ? `Wikipedia indicates the club is active in level ${currentLeagueLevel}, which is inside current tracked coverage.`
    : currentLeagueLevel != null
      ? `Wikipedia indicates the club is active at level ${currentLeagueLevel}, below current tracked coverage.`
      : 'Wikipedia indicates the club is active outside currently tracked coverage.';

  return {
    basis: 'wikipedia-page-text',
    suggestedCurrent: 'active',
    suggestedReason,
    suggestedReasonLabel,
    wikipediaCurrentLeague: currentLeague?.name || null,
    wikipediaCurrentLeagueLevel: currentLeagueLevel,
    wikipediaTrackingCoverageStatus: trackingCoverage.status,
    wikipediaTrackingCoverageLabel: trackingCoverage.label,
    trackedLeagueLevelLimit: TRACKED_LEAGUE_LEVEL_LIMIT,
    wikipediaLatestSeason: evidence.latestSeason || null,
    evidenceText:
      currentLeague?.evidenceText ||
      evidence.latestSeasonEvidenceText ||
      firstMatchingSentence(
        rawText,
        /\bis (?:an? )?(?:semi-professional |professional |association )?football club\b/i
      ) ||
      firstMatchingSentence(rawText, /\b(?:currently|now) (?:competes?|plays?) in\b/i) ||
      firstMatchingSentence(rawText, /\bcurrent league\b/i),
    evidenceYears: [],
  };
}

function lifecycleEvidenceAlignsWithTrackedEra(club, classification) {
  if (classification.suggestedCurrent === 'active') return true;
  const trackedToSeason = Number.parseInt(String(club?.status?.trackedToSeason ?? ''), 10);
  if (!Number.isInteger(trackedToSeason)) return true;
  if (!classification.evidenceYears?.length) return true;
  return classification.evidenceYears.some(
    (year) => year >= trackedToSeason && year <= trackedToSeason + 10
  );
}

export function suggestClubStatusReasonFromWikipediaHtml({ club, html, pageUrl }) {
  const $ = cheerio.load(html || '');
  const evidence = extractPageEvidence($);
  const isMatchedClubPage =
    hasEnoughClubTokenOverlap(club, evidence) && isLikelyFootballClubPage(evidence);

  if (!isMatchedClubPage) {
    return {
      foundPage: true,
      matchedClubPage: false,
      pageTitle: evidence.pageTitle || null,
      sourceUrl: pageUrl || null,
      suggestedReason: null,
      suggestedReasonLabel: 'Wikipedia page was found, but it did not look like the requested club.',
      evidenceText: evidence.leadText || null,
    };
  }

  const classification = classifyReasonFromEvidence(evidence);
  if (!lifecycleEvidenceAlignsWithTrackedEra(club, classification)) {
    const activeClassification = classifyActiveBelowTrackedCoverage(evidence);
    if (activeClassification) {
      const activeEvidenceSource = findEvidenceSource($, activeClassification.evidenceText, pageUrl);
      const rejectedEvidenceSource = findEvidenceSource($, classification.evidenceText, pageUrl);
      return {
        foundPage: true,
        matchedClubPage: true,
        eraMatched: true,
        pageTitle: evidence.pageTitle || null,
        sourceUrl: pageUrl || null,
        rejectedLifecycleSuggestion: {
          suggestedReason: classification.suggestedReason,
          evidenceText: classification.evidenceText,
          evidenceYears: classification.evidenceYears,
          evidenceSourceUrl: rejectedEvidenceSource.evidenceSourceUrl,
          evidenceSourceLabel: rejectedEvidenceSource.evidenceSourceLabel,
        },
        ...activeClassification,
        ...activeEvidenceSource,
      };
    }

    const evidenceSource = findEvidenceSource($, classification.evidenceText, pageUrl);
    return {
      foundPage: true,
      matchedClubPage: false,
      eraMatched: false,
      pageTitle: evidence.pageTitle || null,
      sourceUrl: pageUrl || null,
      suggestedReason: null,
      suggestedReasonLabel:
        'Wikipedia page matched the club name, but the detected lifecycle year does not align with this tracked identity.',
      evidenceText: classification.evidenceText,
      ...evidenceSource,
      evidenceYears: classification.evidenceYears,
    };
  }

  const evidenceSource = findEvidenceSource($, classification.evidenceText, pageUrl);
  return {
    foundPage: true,
    matchedClubPage: true,
    eraMatched: true,
    pageTitle: evidence.pageTitle || null,
    sourceUrl: pageUrl || null,
    ...classification,
    ...evidenceSource,
  };
}

export async function suggestClubStatusReasonFromWikipedia(club, options = {}) {
  const {
    fetchHtml = fetchHtmlForSlug,
    fetchSearchTitles = fetchWikipediaSearchTitles,
    delayMs = WIKIPEDIA_FETCH_DELAY_MS,
    maxCandidates = 8,
    maxSearchResults = 5,
    onError = () => {},
  } = options;
  const candidates = buildWikipediaClubPageCandidates(club);
  const attemptedSlugs = [];
  const searchQueries = [];
  const searchResultTitles = [];
  let firstFoundSuggestion = null;

  async function tryCandidateSlugs(slugs) {
    for (const slug of slugs) {
      if (!slug || attemptedSlugs.includes(slug)) continue;
      if (attemptedSlugs.length >= maxCandidates) break;
    attemptedSlugs.push(slug);
    try {
      const html = await fetchHtml(slug);
      const suggestion = suggestClubStatusReasonFromWikipediaHtml({
        club,
        html,
        pageUrl: sourceUrlForSlug(slug),
      });
      if (suggestion.matchedClubPage) {
        return {
          ...suggestion,
          attemptedSlugs,
            searchQueries,
            searchResultTitles,
        };
      }
        if (suggestion.foundPage && !firstFoundSuggestion) {
          firstFoundSuggestion = suggestion;
        }
    } catch (error) {
      onError({ club, slug, error });
    }
    if (delayMs) await wait(delayMs);
  }
    return null;
  }

  const generatedMatch = await tryCandidateSlugs(candidates);
  if (generatedMatch) return generatedMatch;

  const baseTitle = stripClubSuffix(club?.canonicalName) || club?.canonicalName || '';
  const queries = uniqueValues([
    `${baseTitle} football club`,
    `${baseTitle} F.C.`,
    `"${baseTitle}" "football club"`,
  ]);

  for (const query of queries) {
    if (attemptedSlugs.length >= maxCandidates) break;
    searchQueries.push(query);
    try {
      const titles = await fetchSearchTitles(query, { limit: maxSearchResults });
      searchResultTitles.push(...titles);
      const searchSlugs = titles.map(titleToSlug);
      const searchMatch = await tryCandidateSlugs(searchSlugs);
      if (searchMatch) return searchMatch;
    } catch (error) {
      onError({ club, query, error });
    }
    if (delayMs) await wait(delayMs);
  }

  if (firstFoundSuggestion) {
    return {
      ...firstFoundSuggestion,
      attemptedSlugs,
      searchQueries,
      searchResultTitles: uniqueValues(searchResultTitles),
    };
  }

  return {
    foundPage: false,
    matchedClubPage: false,
    pageTitle: null,
    sourceUrl: null,
    suggestedReason: null,
    suggestedReasonLabel: 'No matching Wikipedia club page was found from generated candidates.',
    evidenceText: null,
    attemptedSlugs,
    searchQueries,
    searchResultTitles: uniqueValues(searchResultTitles),
  };
}

export async function addWikipediaStatusReasonSuggestions(issues, clubMetadata, options = {}) {
  const clubs = clubMetadata?.clubs || {};
  const enrichedIssues = [];

  for (const issue of issues) {
    if (issue.type !== 'missing-historical-status-reason') {
      enrichedIssues.push(issue);
      continue;
    }

    const club = clubs[issue.clubKey];
    if (!club) {
      enrichedIssues.push(issue);
      continue;
    }

    const wikipediaSuggestion = await suggestClubStatusReasonFromWikipedia(club, options);
    enrichedIssues.push({
      ...issue,
      wikipediaSuggestion,
    });
  }

  return enrichedIssues;
}

export default {
  addWikipediaStatusReasonSuggestions,
  buildWikipediaClubPageCandidates,
  inferEnglishLeagueLevel,
  suggestClubStatusReasonFromWikipedia,
  suggestClubStatusReasonFromWikipediaHtml,
  wikipediaSlugFromUrl,
};
