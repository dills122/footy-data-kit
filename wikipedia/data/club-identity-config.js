export const CLUB_IDENTITY_RULES = Object.freeze([
  Object.freeze({
    clubKey: 'afc bournemouth',
    canonicalName: 'AFC Bournemouth',
    aliases: Object.freeze(['AFC Bournemouth', 'Bournemouth', 'Bournemouth & Boscombe Athletic']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/AFC_Bournemouth',
        notes:
          'Club history records Bournemouth & Boscombe Athletic and later AFC Bournemouth names.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'arsenal',
    canonicalName: 'Arsenal',
    aliases: Object.freeze(['Arsenal', 'Woolwich Arsenal']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Arsenal_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'birmingham city',
    canonicalName: 'Birmingham City',
    aliases: Object.freeze(['Birmingham City', 'Birmingham', 'Small Heath', 'Small Heath Alliance']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Birmingham_City_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'glossop',
    canonicalName: 'Glossop',
    aliases: Object.freeze(['Glossop', 'Glossop North End']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'hartlepool united',
    canonicalName: 'Hartlepool United',
    aliases: Object.freeze(['Hartlepool United', 'Hartlepool', 'Hartlepools United']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Hartlepool_United_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'leicester city',
    canonicalName: 'Leicester City',
    aliases: Object.freeze(['Leicester City', 'Leicester Fosse']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Leicester_City_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'leyton orient',
    canonicalName: 'Leyton Orient',
    aliases: Object.freeze(['Leyton Orient', 'Orient', 'Clapton Orient']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Leyton_Orient_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'manchester city',
    canonicalName: 'Manchester City',
    aliases: Object.freeze(['Manchester City', 'Ardwick']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Manchester_City_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'manchester united',
    canonicalName: 'Manchester United',
    aliases: Object.freeze(['Manchester United', 'Newton Heath', 'Newton Heath LYR', 'Newton Heath LYR FC']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'football-club-history-database',
        sourceUrl: 'https://www.fchd.info/MANCHESU.HTM',
        notes: 'FCHD records Manchester United as Newton Heath changed name in 1902.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'port vale',
    canonicalName: 'Port Vale',
    aliases: Object.freeze(['Port Vale', 'Burslem Port Vale']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Port_Vale_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'scunthorpe united',
    canonicalName: 'Scunthorpe United',
    aliases: Object.freeze(['Scunthorpe United', 'Scunthorpe & Lindsey United']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Scunthorpe_United_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'sheffield wednesday',
    canonicalName: 'Sheffield Wednesday',
    aliases: Object.freeze(['Sheffield Wednesday', 'The Wednesday']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Sheffield_Wednesday_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'stoke city',
    canonicalName: 'Stoke City',
    aliases: Object.freeze(['Stoke City', 'Stoke']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Stoke_City_F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'swansea city',
    canonicalName: 'Swansea City',
    aliases: Object.freeze(['Swansea City', 'Swansea Town']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Swansea_City_A.F.C.',
      }),
    ]),
  }),
  Object.freeze({
    clubKey: 'walsall',
    canonicalName: 'Walsall',
    aliases: Object.freeze(['Walsall', 'Walsall Town Swifts']),
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'football-club-history-database',
        sourceUrl: 'https://www.fchd.info/WALSALL.HTM',
        notes: 'FCHD records Walsall as Walsall Town Swifts changed name in 1895-96.',
      }),
    ]),
  }),
]);

export const TEMPORAL_CLUB_IDENTITY_RULES = Object.freeze([
  Object.freeze({
    name: 'Accrington Stanley',
    endSeason: 1961,
    clubKey: 'accrington stanley 1891',
    relationship: 'phoenix',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes:
          'Former EFL list distinguishes Accrington Stanley (1891) from the new Accrington Stanley formed in 1968.',
      }),
    ]),
  }),
  Object.freeze({
    name: 'Chester',
    endSeason: 1982,
    clubKey: 'chester city',
    relationship: 'rename',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes: 'Earlier Football League Chester records belong to the Chester City identity; modern Chester is a successor club.',
      }),
    ]),
  }),
  Object.freeze({
    name: 'Darlington',
    endSeason: 2009,
    clubKey: 'darlington 1883',
    relationship: 'phoenix',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes:
          'Former EFL list describes Darlington as defunct with a revived version later playing.',
      }),
    ]),
  }),
  Object.freeze({
    name: 'Gateshead',
    endSeason: 1959,
    clubKey: 'gateshead 1899',
    relationship: 'successor',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes:
          'Former EFL list describes the older Gateshead club as defunct with new Gateshead and South Shields clubs formed.',
      }),
    ]),
  }),
  Object.freeze({
    name: 'Maidstone United',
    endSeason: 1992,
    clubKey: 'maidstone united 1897',
    relationship: 'phoenix',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes:
          'Former EFL list describes Maidstone United as liquidated with a revived version later playing.',
      }),
    ]),
  }),
  Object.freeze({
    name: 'Newport County',
    endSeason: 1987,
    clubKey: 'newport county 1912',
    relationship: 'phoenix',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes:
          'Former EFL list describes Newport County as defunct with a revived version later playing.',
      }),
    ]),
  }),
  Object.freeze({
    name: 'South Shields',
    endSeason: 1929,
    clubKey: 'gateshead 1899',
    relationship: 'relocation',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Gateshead_A.F.C.',
        notes:
          'The original South Shields club relocated to Gateshead in 1930 and adopted the Gateshead name.',
      }),
    ]),
  }),
]);

export const CLUB_CANONICAL_NAME_OVERRIDES = Object.freeze({
  'accrington stanley 1891': 'Accrington Stanley (1891)',
  'darlington 1883': 'Darlington (1883)',
  'gateshead 1899': 'Gateshead (1899)',
  'maidstone united 1897': 'Maidstone United (1897)',
  'newport county 1912': 'Newport County (1912)',
});

const FORMER_EFL_CLUBS_SOURCE = Object.freeze([
  Object.freeze({
    type: 'former-efl-clubs-list',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
  }),
]);

export const CLUB_RELATIONSHIP_RULES = Object.freeze([
  Object.freeze({
    fromClubKey: 'accrington stanley 1891',
    toClubKey: 'accrington stanley',
    relationship: 'phoenix',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'aldershot',
    toClubKey: 'aldershot town',
    relationship: 'phoenix',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'burton swifts',
    toClubKey: 'burton united',
    relationship: 'merger',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'burton wanderers',
    toClubKey: 'burton united',
    relationship: 'merger',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'burton united',
    toClubKey: 'burton albion',
    relationship: 'successor',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'chester city',
    toClubKey: 'chester',
    relationship: 'phoenix',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'darlington 1883',
    toClubKey: 'darlington',
    relationship: 'phoenix',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'gateshead 1899',
    toClubKey: 'gateshead',
    relationship: 'successor',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'halifax town',
    toClubKey: 'fc halifax town',
    relationship: 'phoenix',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'hereford united',
    toClubKey: 'hereford',
    relationship: 'phoenix',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'leeds city',
    toClubKey: 'leeds united',
    relationship: 'successor',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'maidstone united 1897',
    toClubKey: 'maidstone united',
    relationship: 'phoenix',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'newport county 1912',
    toClubKey: 'newport county',
    relationship: 'phoenix',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'rotherham county',
    toClubKey: 'rotherham united',
    relationship: 'merger',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'rotherham town',
    toClubKey: 'rotherham united',
    relationship: 'merger',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'scarborough',
    toClubKey: 'scarborough athletic',
    relationship: 'phoenix',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'wigan borough',
    toClubKey: 'wigan athletic',
    relationship: 'successor',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'wimbledon',
    toClubKey: 'milton keynes dons',
    relationship: 'relocation',
    sourceRefs: FORMER_EFL_CLUBS_SOURCE,
  }),
  Object.freeze({
    fromClubKey: 'wimbledon',
    toClubKey: 'afc wimbledon',
    relationship: 'supporterPhoenix',
    sourceRefs: Object.freeze([
      Object.freeze({
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/AFC_Wimbledon',
        notes:
          'AFC Wimbledon was founded by former Wimbledon supporters after the FA allowed Wimbledon F.C. to relocate to Milton Keynes.',
      }),
    ]),
  }),
]);

const CLUB_IDENTITY_RULES_BY_KEY = new Map(CLUB_IDENTITY_RULES.map((rule) => [rule.clubKey, rule]));

export function getCanonicalClubName(clubKey, fallbackName) {
  return CLUB_IDENTITY_RULES_BY_KEY.get(clubKey)?.canonicalName || CLUB_CANONICAL_NAME_OVERRIDES[clubKey] || fallbackName;
}

export function getClubIdentitySourceRefs(clubKey) {
  return CLUB_IDENTITY_RULES_BY_KEY.get(clubKey)?.sourceRefs || Object.freeze([]);
}

export default {
  CLUB_IDENTITY_RULES,
  CLUB_RELATIONSHIP_RULES,
  TEMPORAL_CLUB_IDENTITY_RULES,
  getCanonicalClubName,
  getClubIdentitySourceRefs,
};
