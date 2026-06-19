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
  clubMetadataSeed: 'club-metadata-seed',
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
  thirdDivisionStartSeason: 1920,
  regionalThirdDivisionStartSeason: 1921,
  regionalThirdDivisionFinalSeason: 1957,
  fourthDivisionStartSeason: 1958,
  footballLeagueRenumberStartSeason: 1992,
  eflRebrandStartSeason: 2004,
  nationalLeagueSystemRestructureStartSeason: 2004,
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
  2019: Object.freeze({
    tiers: Object.freeze({
      tier3: Object.freeze({
        relegated: Object.freeze(['Tranmere Rovers', 'Southend United', 'Bolton Wanderers']),
        rowFlagOverrides: Object.freeze({
          Bury: Object.freeze({
            wasRelegated: false,
            outcomeStatus: 'expelled',
          }),
        }),
      }),
      tier4: Object.freeze({
        relegated: Object.freeze(['Macclesfield Town']),
        rowFlagOverrides: Object.freeze({
          Stevenage: Object.freeze({
            wasRelegated: false,
            outcomeStatus: 'reprieved',
          }),
          'Macclesfield Town': Object.freeze({
            wasRelegated: true,
            outcomeStatus: 'relegated-after-points-deduction',
          }),
        }),
      }),
    }),
  }),
});

/**
 * @type {readonly import('./models/wikipedia.ts').WikipediaLeagueLevelRule[]}
 */
export const WIKIPEDIA_LEAGUE_LEVEL_RULES = Object.freeze([
  Object.freeze({
    level: 1,
    startSeason: 1992,
    labels: Object.freeze(['Premier League', 'FA Premier League', 'FA Premiership', 'Premiership']),
  }),
  Object.freeze({
    level: 1,
    endSeason: 1991,
    labels: Object.freeze(['First Division', 'Football League First Division']),
  }),
  Object.freeze({
    level: 2,
    startSeason: 1890,
    endSeason: 1891,
    labels: Object.freeze(['Football Alliance', 'The Football Alliance']),
  }),
  Object.freeze({
    level: 2,
    startSeason: 1892,
    endSeason: 1991,
    labels: Object.freeze(['Second Division', 'Football League Second Division']),
  }),
  Object.freeze({
    level: 2,
    startSeason: 1992,
    endSeason: 2003,
    labels: Object.freeze([
      'First Division',
      'Division One',
      'League Division One',
      'Football League First Division',
      'Football League Division One',
    ]),
  }),
  Object.freeze({
    level: 2,
    startSeason: 2004,
    labels: Object.freeze(['Championship', 'Football League Championship', 'EFL Championship']),
  }),
  Object.freeze({
    level: 3,
    startSeason: 1920,
    endSeason: 1920,
    labels: Object.freeze(['Third Division', 'Football League Third Division']),
  }),
  Object.freeze({
    level: 3,
    startSeason: 1921,
    endSeason: 1957,
    parallelGroup: 'third-division-north-south',
    labels: Object.freeze([
      'Third Division North',
      'Football League Third Division North',
      'Third Division South',
      'Football League Third Division South',
    ]),
  }),
  Object.freeze({
    level: 3,
    startSeason: 1958,
    endSeason: 1991,
    labels: Object.freeze(['Third Division', 'Football League Third Division']),
  }),
  Object.freeze({
    level: 3,
    startSeason: 1992,
    endSeason: 2003,
    labels: Object.freeze([
      'Second Division',
      'Division Two',
      'League Division Two',
      'Football League Second Division',
      'Football League Division Two',
    ]),
  }),
  Object.freeze({
    level: 3,
    startSeason: 2004,
    labels: Object.freeze(['League One', 'Football League One', 'EFL League One']),
  }),
  Object.freeze({
    level: 4,
    startSeason: 1958,
    endSeason: 1991,
    labels: Object.freeze(['Fourth Division', 'Football League Fourth Division']),
  }),
  Object.freeze({
    level: 4,
    startSeason: 1992,
    endSeason: 2003,
    labels: Object.freeze([
      'Third Division',
      'Division Three',
      'League Division Three',
      'Football League Third Division',
      'Football League Division Three',
    ]),
  }),
  Object.freeze({
    level: 4,
    startSeason: 2004,
    labels: Object.freeze(['League Two', 'Football League Two', 'EFL League Two']),
  }),
  Object.freeze({
    level: 5,
    startSeason: 1979,
    endSeason: 1985,
    labels: Object.freeze(['Alliance Premier League']),
  }),
  Object.freeze({
    level: 5,
    startSeason: 1986,
    endSeason: 2003,
    labels: Object.freeze(['Football Conference', 'Conference National']),
  }),
  Object.freeze({
    level: 5,
    startSeason: 2004,
    endSeason: 2014,
    labels: Object.freeze(['Conference Premier']),
  }),
  Object.freeze({
    level: 5,
    startSeason: 2015,
    labels: Object.freeze(['National League Top Division', 'National League']),
  }),
  Object.freeze({
    level: 6,
    startSeason: 2004,
    endSeason: 2014,
    parallelGroup: 'conference-north-south',
    labels: Object.freeze(['Conference North', 'Conference South']),
  }),
  Object.freeze({
    level: 6,
    startSeason: 2015,
    parallelGroup: 'national-league-north-south',
    labels: Object.freeze(['National League North', 'National League South']),
  }),
  Object.freeze({
    level: 6,
    startSeason: 2021,
    parallelGroup: 'national-league-north-south',
    labels: Object.freeze(['North', 'South']),
  }),
  Object.freeze({
    level: 7,
    startSeason: 2004,
    parallelGroup: 'step-three-premier-divisions',
    labels: Object.freeze([
      'Northern Premier League Premier Division',
      'Southern League Premier Division Central',
      'Southern League Premier Division South',
      'Isthmian League Premier Division',
    ]),
  }),
]);

export const WIKIPEDIA_LEAGUE_STRUCTURE_SPECIAL_SEASONS = Object.freeze({
  1921: Object.freeze([
    Object.freeze({
      type: 'parallel-regional-level',
      levels: Object.freeze([3]),
      tierKeys: Object.freeze(['tier3', 'tier4']),
      notes:
        'Third Division North and Third Division South begin as parallel level-3 regional divisions.',
    }),
  ]),
  1957: Object.freeze([
    Object.freeze({
      type: 'restructure-placement',
      levels: Object.freeze([3, 4]),
      tierKeys: Object.freeze(['tier3', 'tier4']),
      notes:
        'Final Third Division North/South season; bottom-half clubs moved into the new Fourth Division for 1958-59.',
    }),
  ]),
  1958: Object.freeze([
    Object.freeze({
      type: 'new-national-fourth-tier',
      levels: Object.freeze([3, 4]),
      tierKeys: Object.freeze(['tier3', 'tier4']),
      notes:
        'Regional Third Division North/South structure replaced by national Third Division and Fourth Division.',
    }),
  ]),
  1987: Object.freeze([
    Object.freeze({
      type: 'playoff-and-conference-relegation-boundary',
      levels: Object.freeze([3, 4, 5]),
      tierKeys: Object.freeze(['tier3', 'tier4']),
      notes:
        'Football League play-offs and automatic relegation from the Fourth Division to the Conference are active in this era.',
    }),
  ]),
  1991: Object.freeze([
    Object.freeze({
      type: 'reduced-fourth-tier-size',
      levels: Object.freeze([4]),
      tierKeys: Object.freeze(['tier4']),
      notes:
        'Fourth Division table size was affected by Aldershot folding during the 1991-92 season.',
    }),
  ]),
  1992: Object.freeze([
    Object.freeze({
      type: 'football-league-renumbering',
      levels: Object.freeze([3, 4]),
      tierKeys: Object.freeze(['tier3', 'tier4']),
      notes:
        'After the Premier League breakaway, level 3 became Football League Second Division and level 4 became Football League Third Division.',
    }),
  ]),
  1993: Object.freeze([
    Object.freeze({
      type: 'reduced-fourth-tier-size',
      levels: Object.freeze([4]),
      tierKeys: Object.freeze(['tier4']),
      notes:
        'Early Premier League-era fourth tier remained below the normal 24-team shape after Aldershot and Maidstone disruption.',
    }),
  ]),
  1994: Object.freeze([
    Object.freeze({
      type: 'reduced-fourth-tier-size',
      levels: Object.freeze([4]),
      tierKeys: Object.freeze(['tier4']),
      notes: 'Fourth-tier row count remains below the normal 24-team shape before settling back.',
    }),
  ]),
  2004: Object.freeze([
    Object.freeze({
      type: 'efl-rebrand',
      levels: Object.freeze([2, 3, 4]),
      tierKeys: Object.freeze(['tier2', 'tier3', 'tier4']),
      notes:
        'Football League First Division, Second Division, and Third Division were rebranded as Championship, League One, and League Two.',
    }),
    Object.freeze({
      type: 'national-league-system-restructure',
      levels: Object.freeze([5, 6]),
      tierKeys: Object.freeze(['tier5', 'tier6']),
      notes:
        'Conference North and Conference South begin as parallel level-6 divisions beneath the Conference top division.',
    }),
  ]),
  2019: Object.freeze([
    Object.freeze({
      type: 'covid-curtailed-season',
      levels: Object.freeze([3, 4]),
      tierKeys: Object.freeze(['tier3', 'tier4']),
      notes:
        'League One and League Two were curtailed and final positions were decided on points per game.',
    }),
    Object.freeze({
      type: 'administrative-outcome',
      levels: Object.freeze([3, 4]),
      tierKeys: Object.freeze(['tier3', 'tier4']),
      notes:
        'Bury was expelled from League One; Macclesfield Town was relegated from League Two after points deductions and Stevenage was reprieved.',
    }),
  ]),
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
    'Football_League',
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
    'alliance premier league',
    'football conference',
    'conference national',
    'national league top division',
    'national league',
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
    'top scorer',
    'topscorer',
    'top goal scorer',
    'goalscorer',
  ]),
});

export const WIKIPEDIA_LOWER_TIER_COMPETITION_SOURCES = Object.freeze([
  Object.freeze({
    key: 'alliance-premier-league',
    title: 'Alliance Premier League',
    startSeason: 1979,
    endSeason: 1985,
    competitionSlug: 'Alliance_Premier_League',
    levels: Object.freeze([5]),
  }),
  Object.freeze({
    key: 'football-conference',
    title: 'Football Conference',
    startSeason: 1986,
    endSeason: 2014,
    competitionSlug: 'Football_Conference',
    levels: Object.freeze([5, 6]),
  }),
  Object.freeze({
    key: 'national-league',
    title: 'National League',
    startSeason: 2015,
    competitionSlug: 'National_League',
    levels: Object.freeze([5, 6]),
  }),
]);

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
  return `${buildWikipediaSeasonRangePrefix(year)}_in_English_football`;
}

export function buildWikipediaSeasonRangePrefix(year) {
  const nextYear = year + 1;
  const nextYearPart =
    nextYear % 100 === 0 ? String(nextYear) : String(nextYear).slice(-2).padStart(2, '0');
  return `${year}\u2013${nextYearPart}`;
}

export function buildWikipediaCompetitionSeasonSlug(year, competitionSlug) {
  return `${buildWikipediaSeasonRangePrefix(year)}_${competitionSlug}`;
}

function sourceIsInSeasonRange(source, seasonNumber) {
  if (!Number.isFinite(seasonNumber)) return false;
  if (Number.isFinite(source.startSeason) && seasonNumber < source.startSeason) return false;
  if (Number.isFinite(source.endSeason) && seasonNumber > source.endSeason) return false;
  return true;
}

export function getWikipediaLowerTierCompetitionSourceSlugs(year) {
  const seasonNumber = Number.parseInt(String(year), 10);
  if (!Number.isFinite(seasonNumber)) return [];

  return WIKIPEDIA_LOWER_TIER_COMPETITION_SOURCES.filter((source) =>
    sourceIsInSeasonRange(source, seasonNumber)
  ).map((source) => buildWikipediaCompetitionSeasonSlug(seasonNumber, source.competitionSlug));
}

export function getWikipediaLowerTierCompetitionSourceForSlug(slug) {
  const text = String(slug || '');
  return (
    WIKIPEDIA_LOWER_TIER_COMPETITION_SOURCES.find((source) =>
      text.endsWith(`_${source.competitionSlug}`)
    ) || null
  );
}

function normalizeLeagueLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function seasonIsInRuleRange(rule, seasonNumber) {
  if (!Number.isFinite(seasonNumber)) return true;
  if (Number.isFinite(rule.startSeason) && seasonNumber < rule.startSeason) return false;
  if (Number.isFinite(rule.endSeason) && seasonNumber > rule.endSeason) return false;
  return true;
}

export function getWikipediaLeagueLevelRule(label, seasonNumber) {
  const text = normalizeLeagueLabel(label);
  if (!text) return null;

  const matches = [];
  for (const rule of WIKIPEDIA_LEAGUE_LEVEL_RULES) {
    if (!seasonIsInRuleRange(rule, seasonNumber)) continue;
    for (const leagueLabel of rule.labels) {
      const normalizedLabel = normalizeLeagueLabel(leagueLabel);
      if (normalizedLabel && text.includes(normalizedLabel)) {
        matches.push({ rule, matchLength: normalizedLabel.length });
      }
    }
  }

  matches.sort((a, b) => b.matchLength - a.matchLength);
  return matches[0]?.rule || null;
}

export function getWikipediaCanonicalLeagueLabel(seasonNumber, level) {
  if (!Number.isFinite(seasonNumber) || !Number.isFinite(level)) return null;

  const rule = WIKIPEDIA_LEAGUE_LEVEL_RULES.find(
    (entry) =>
      entry.level === level && !entry.parallelGroup && seasonIsInRuleRange(entry, seasonNumber)
  );

  return rule?.labels?.[0] || null;
}

export function getWikipediaLeagueStructureSpecialCases(seasonNumber) {
  if (!Number.isFinite(seasonNumber)) return [];
  const specialCases = WIKIPEDIA_LEAGUE_STRUCTURE_SPECIAL_SEASONS[seasonNumber];
  return specialCases ? [...specialCases] : [];
}

export function inferEnglishLeagueTier(label, seasonNumber) {
  const text = String(label || '').toLowerCase();
  if (!text.trim()) return null;

  const configuredRule = getWikipediaLeagueLevelRule(label, seasonNumber);
  if (configuredRule) return configuredRule.level;

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
