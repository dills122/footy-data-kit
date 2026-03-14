import path from 'node:path';

export const WIKIPEDIA_BASE_URL = 'https://en.wikipedia.org/wiki';
export const WIKIPEDIA_DEFAULT_USER_AGENT =
  'footy-data-kit (+https://github.com/dills122/footy-data-kit)';
export const WIKIPEDIA_FETCH_DELAY_MS = 1000;
export const WIKIPEDIA_DEFAULT_OUTPUT_DIR = './data-output';

export const WIKIPEDIA_GENERATORS = Object.freeze({
  promotion: 'wikipedia-promotion',
  overview: 'wikipedia-overview',
  combined: 'wikipedia-combined',
});

export const WIKIPEDIA_DATA_SOURCES = Object.freeze({
  promotion: {
    key: 'promotion',
    sourceId: WIKIPEDIA_GENERATORS.promotion,
    generator: WIKIPEDIA_GENERATORS.promotion,
    datasetFileName: 'wiki_promotion_relegations_by_season.json',
    liveLabel: 'Promotion flow',
  },
  overview: {
    key: 'overview',
    sourceId: WIKIPEDIA_GENERATORS.overview,
    generator: WIKIPEDIA_GENERATORS.overview,
    datasetFileName: 'wiki_overview_tables_by_season.json',
    liveLabel: 'Overview flow',
  },
});

export const WIKIPEDIA_SEASON_RANGES = Object.freeze({
  classicPromotionFinalSeason: 1990,
  footballAllianceFinalSeason: 1891,
  premierLeagueStartSeason: 1992,
});

export const WIKIPEDIA_WAR_SUSPENSION_RANGES = Object.freeze([
  Object.freeze({ label: 'ww1', start: 1915, end: 1918 }),
  Object.freeze({ label: 'ww2', start: 1940, end: 1945 }),
]);

export const WIKIPEDIA_MINIMUM_TIER_OVERRIDES = Object.freeze({
  1888: 1,
  1889: 1,
});

export const WIKIPEDIA_HISTORICAL_PLACEHOLDER_SEASONS = Object.freeze({
  1915: Object.freeze({
    competitionStatus: 'wartime-special',
    warSuspensionLabel: 'ww1',
    notes:
      'Official Football League competition was suspended and replaced by wartime regional competitions.',
  }),
  1916: Object.freeze({
    competitionStatus: 'wartime-special',
    warSuspensionLabel: 'ww1',
    notes:
      'Official Football League competition was suspended and replaced by wartime regional competitions.',
  }),
  1917: Object.freeze({
    competitionStatus: 'wartime-special',
    warSuspensionLabel: 'ww1',
    notes:
      'Official Football League competition was suspended and replaced by wartime regional competitions.',
  }),
  1918: Object.freeze({
    competitionStatus: 'wartime-special',
    warSuspensionLabel: 'ww1',
    notes:
      'Official Football League competition was suspended and replaced by wartime regional competitions.',
  }),
  1939: Object.freeze({
    competitionStatus: 'abandoned-season',
    notes:
      'Official Football League season abandoned after the outbreak of war; wartime regional competitions followed.',
  }),
  1940: Object.freeze({
    competitionStatus: 'wartime-special',
    warSuspensionLabel: 'ww2',
    notes:
      'Official Football League competition was suspended and replaced by wartime regional competitions.',
  }),
  1941: Object.freeze({
    competitionStatus: 'wartime-special',
    warSuspensionLabel: 'ww2',
    notes:
      'Official Football League competition was suspended and replaced by wartime regional competitions.',
  }),
  1942: Object.freeze({
    competitionStatus: 'wartime-special',
    warSuspensionLabel: 'ww2',
    notes:
      'Official Football League competition was suspended and replaced by wartime regional competitions.',
  }),
  1943: Object.freeze({
    competitionStatus: 'wartime-special',
    warSuspensionLabel: 'ww2',
    notes:
      'Official Football League competition was suspended and replaced by wartime regional competitions.',
  }),
  1944: Object.freeze({
    competitionStatus: 'wartime-special',
    warSuspensionLabel: 'ww2',
    notes:
      'Official Football League competition was suspended and replaced by wartime regional competitions.',
  }),
  1945: Object.freeze({
    competitionStatus: 'regional-bridge-season',
    warSuspensionLabel: 'ww2',
    promotionRelegationApplies: false,
    regionalBridgeSeason: true,
    specialCompetitions: Object.freeze(['Football League North', 'Football League South']),
    notes:
      'Regional Football League North and South competitions were played without normal promotion or relegation.',
  }),
});

export const WIKIPEDIA_OVERVIEW_SEASON_OUTCOME_OVERRIDES = Object.freeze({
  1989: Object.freeze({
    seasonInfo: Object.freeze({
      promoted: Object.freeze(['Leeds United', 'Sheffield United', 'Sunderland']),
    }),
    tiers: Object.freeze({
      tier2: Object.freeze({
        promoted: Object.freeze(['Leeds United', 'Sheffield United', 'Sunderland']),
        rowFlagOverrides: Object.freeze({
          'Swindon Town': Object.freeze({
            wasPromoted: false,
          }),
          Sunderland: Object.freeze({
            wasPromoted: true,
          }),
        }),
      }),
    }),
  }),
});

export const WIKIPEDIA_DIVISION_HEADER_SLUGS = Object.freeze({
  first: Object.freeze([
    '#First_Division',
    '#Football_League_First_Division',
    '#First_Division_table',
  ]),
  second: Object.freeze([
    '#Second_Division',
    '#Football_League_Second_Division',
    '#Second_Division_table',
  ]),
});

export const WIKIPEDIA_GENERIC_TABLE_FALLBACKS = Object.freeze([
  '#Final_league_table',
  '#League_table',
]);

export const WIKIPEDIA_OVERVIEW_CONFIG = Object.freeze({
  leagueKeywords: Object.freeze([
    'league',
    'division',
    'championship',
    'premier',
    'conference',
    'alliance',
    'combination',
    'section',
    'group',
  ]),
  genericLeagueHeadings: Object.freeze([
    'league table',
    'league tables',
    'final table',
    'final tables',
    'table',
    'tables',
    'league standings',
    'standings',
  ]),
  sectionHeadingIds: Object.freeze([
    'League_tables',
    'League_table',
    'League_season',
    "League_season_(Men's)",
    'League_competitions',
    "League_competitions_(Men's)",
    'League_Competitions',
    "League_Competitions_(Men's)",
    'Final_standings',
    'Final_Standings',
    "Men's_football",
    'Mens_football',
  ]),
  topFlightKeywords: Object.freeze([
    'premier league',
    'premiership',
    'football league premier division',
  ]),
  secondTierPostPremierKeywords: Object.freeze(['championship', 'division one', 'first division']),
  secondTierPreFirstDivisionKeywords: Object.freeze(['football alliance']),
  fifthTierKeywords: Object.freeze([
    'national league top division',
    'conference national',
    'conference premier',
  ]),
  excludedCompetitionKeywords: Object.freeze([
    'southern league',
    'southern football league',
    'northern league',
    'northern football league',
    'western league',
    'western football league',
    'midland league',
    'midland football league',
  ]),
});

export function buildWikipediaArticleUrl(slug) {
  return `${WIKIPEDIA_BASE_URL}/${slug}`;
}

export function getWikipediaDatasetFileName(sourceKey) {
  return WIKIPEDIA_DATA_SOURCES[sourceKey]?.datasetFileName || null;
}

export function resolveWikipediaDatasetPath(sourceKey, outputDir = WIKIPEDIA_DEFAULT_OUTPUT_DIR) {
  const fileName = getWikipediaDatasetFileName(sourceKey);
  if (!fileName) {
    throw new Error(`Unknown Wikipedia dataset source "${sourceKey}"`);
  }
  return path.join(path.resolve(outputDir), fileName);
}

export function isWikipediaWarSuspensionYear(year) {
  if (!Number.isFinite(year)) return false;
  return WIKIPEDIA_WAR_SUSPENSION_RANGES.some(({ start, end }) => year >= start && year <= end);
}

export function getWikipediaWarSuspensionLabel(year) {
  if (!Number.isFinite(year)) return null;
  const range = WIKIPEDIA_WAR_SUSPENSION_RANGES.find(
    ({ start, end }) => year >= start && year <= end
  );
  return range?.label || null;
}

export function buildPromotionSeasonSlug(year) {
  const nextYear = year + 1;
  const nextYearPart = nextYear % 100 === 0 ? String(nextYear) : String(nextYear).slice(-2);
  return `${year}-${nextYearPart}_Football_League`;
}

export function buildOverviewSeasonSlug(year) {
  const nextYear = year + 1;
  const nextYearPart =
    nextYear % 100 === 0 ? String(nextYear) : String(nextYear).slice(-2).padStart(2, '0');
  return `${year}\u2013${nextYearPart}_in_English_football`;
}

export function inferEnglishLeagueTier(label, seasonNumber) {
  const text = String(label || '').toLowerCase();
  if (!text.trim()) return null;

  if (WIKIPEDIA_OVERVIEW_CONFIG.topFlightKeywords.some((keyword) => text.includes(keyword))) {
    return 1;
  }

  if (
    seasonNumber < WIKIPEDIA_SEASON_RANGES.premierLeagueStartSeason &&
    text.includes('first division')
  ) {
    return 1;
  }
  if (
    seasonNumber <= WIKIPEDIA_SEASON_RANGES.footballAllianceFinalSeason &&
    WIKIPEDIA_OVERVIEW_CONFIG.secondTierPreFirstDivisionKeywords.some((keyword) =>
      text.includes(keyword)
    )
  ) {
    return 2;
  }
  if (
    seasonNumber >= WIKIPEDIA_SEASON_RANGES.premierLeagueStartSeason &&
    WIKIPEDIA_OVERVIEW_CONFIG.secondTierPostPremierKeywords.some((keyword) =>
      text.includes(keyword)
    )
  ) {
    return 2;
  }
  if (
    seasonNumber < WIKIPEDIA_SEASON_RANGES.premierLeagueStartSeason &&
    text.includes('second division')
  ) {
    return 2;
  }
  if (text.includes('league one')) return 3;
  if (
    seasonNumber < WIKIPEDIA_SEASON_RANGES.premierLeagueStartSeason &&
    text.includes('third division')
  ) {
    return 3;
  }
  if (text.includes('league two')) return 4;
  if (
    seasonNumber < WIKIPEDIA_SEASON_RANGES.premierLeagueStartSeason &&
    text.includes('fourth division')
  ) {
    return 4;
  }
  if (WIKIPEDIA_OVERVIEW_CONFIG.fifthTierKeywords.some((keyword) => text.includes(keyword))) {
    return 5;
  }

  return null;
}
