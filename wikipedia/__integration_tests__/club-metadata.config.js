// @ts-check

export const allowedExternalRelationshipTargets = Object.freeze([
  'afc rushden and diamonds',
  'bangor city 1876',
  'bromsgrove sporting',
  'east thurrock community',
  'eastwood cfc',
  'fisher',
  'hinckley afc',
  'ilkeston fc',
  'ilkeston town 2017',
  'runcorn linnets',
]);

export const clubMetadataFixtures = Object.freeze([
  Object.freeze({
    clubKey: 'hornchurch',
    coverage: Object.freeze(['rename', 'reformed', 'active-tracked-sparse']),
    expected: Object.freeze({
      canonicalName: 'Hornchurch',
      status: Object.freeze({
        current: 'active',
        reason: 'possibly-missing-from-current-data',
      }),
      aliases: Object.freeze(['AFC Hornchurch']),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Hornchurch_F.C.']),
      lifecycleEvents: Object.freeze([
        Object.freeze({
          type: 'folded',
          season: 2004,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Hornchurch_F.C.']),
        }),
        Object.freeze({
          type: 'reformed',
          season: 2005,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Hornchurch_F.C.']),
        }),
        Object.freeze({
          type: 'renamed',
          season: 2019,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Hornchurch_F.C.']),
        }),
      ]),
      observedRows: Object.freeze([
        Object.freeze({
          season: 2012,
          tier: 'tier6',
          team: 'AFC Hornchurch',
        }),
      ]),
    }),
  }),
  Object.freeze({
    clubKey: 'bangor city',
    coverage: Object.freeze(['defunct', 'withdrawn', 'supporter-phoenix', 'external-target']),
    expected: Object.freeze({
      canonicalName: 'Bangor City',
      status: Object.freeze({
        current: 'defunct',
        reason: 'dissolved',
      }),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Bangor_City_F.C.']),
      lifecycleEvents: Object.freeze([
        Object.freeze({
          type: 'withdrew',
          season: 2021,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Bangor_City_F.C.']),
        }),
        Object.freeze({
          type: 'dissolved',
          season: 2025,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Bangor_City_F.C.']),
        }),
      ]),
      relationships: Object.freeze([
        Object.freeze({
          clubKey: 'bangor city 1876',
          relationship: 'supporterPhoenix',
          direction: 'supporterFounded',
          season: 2019,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Bangor_1876_F.C.']),
        }),
      ]),
      observedRows: Object.freeze([
        Object.freeze({
          season: 1979,
          tier: 'tier5',
          team: 'Bangor City',
        }),
      ]),
    }),
  }),
  Object.freeze({
    clubKey: 'dagenham',
    coverage: Object.freeze(['merged', 'relationship-target-present']),
    expected: Object.freeze({
      canonicalName: 'Dagenham',
      status: Object.freeze({
        current: 'merged',
        reason: 'merged',
      }),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Dagenham_F.C.']),
      lifecycleEvents: Object.freeze([
        Object.freeze({
          type: 'merged',
          season: 1992,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Dagenham_F.C.']),
        }),
      ]),
      relationships: Object.freeze([
        Object.freeze({
          clubKey: 'dagenham and redbridge',
          relationship: 'merger',
          direction: 'mergedInto',
          season: 1992,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Dagenham_%26_Redbridge_F.C.']),
        }),
      ]),
      observedRows: Object.freeze([
        Object.freeze({
          season: 1981,
          tier: 'tier5',
          team: 'Dagenham',
        }),
      ]),
    }),
  }),
  Object.freeze({
    clubKey: 'merthyr tydfil',
    coverage: Object.freeze(['liquidated', 'successor', 'relationship-target-present']),
    expected: Object.freeze({
      canonicalName: 'Merthyr Tydfil',
      status: Object.freeze({
        current: 'defunct',
        reason: 'liquidated',
      }),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Merthyr_Tydfil_F.C.']),
      lifecycleEvents: Object.freeze([
        Object.freeze({
          type: 'liquidated',
          season: 2010,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Merthyr_Tydfil_F.C.']),
        }),
        Object.freeze({
          type: 'successorFormed',
          season: 2010,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Merthyr_Town_F.C.']),
        }),
      ]),
      relationships: Object.freeze([
        Object.freeze({
          clubKey: 'merthyr town',
          relationship: 'successor',
          direction: 'successor',
          season: 2010,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Merthyr_Tydfil_F.C.']),
        }),
      ]),
      observedRows: Object.freeze([
        Object.freeze({
          season: 1989,
          tier: 'tier5',
          team: 'Merthyr Tydfil',
        }),
      ]),
    }),
  }),
  Object.freeze({
    clubKey: 'nuneaton borough',
    coverage: Object.freeze(['liquidated', 'rename', 'phoenix', 'relationship-target-present']),
    expected: Object.freeze({
      canonicalName: 'Nuneaton Borough',
      status: Object.freeze({
        current: 'defunct',
        reason: 'liquidated',
      }),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Nuneaton_Town_F.C.']),
      lifecycleEvents: Object.freeze([
        Object.freeze({
          type: 'renamed',
          season: 2018,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Nuneaton_Town_F.C.']),
        }),
        Object.freeze({
          type: 'liquidated',
          season: 2024,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Nuneaton_Town_F.C.']),
        }),
      ]),
      relationships: Object.freeze([
        Object.freeze({
          clubKey: 'nuneaton town',
          relationship: 'phoenix',
          direction: 'successor',
          season: 2024,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Nuneaton_Town_F.C.']),
        }),
      ]),
      observedRows: Object.freeze([
        Object.freeze({
          season: 1979,
          tier: 'tier5',
          team: 'Nuneaton Borough',
        }),
      ]),
    }),
  }),
  Object.freeze({
    clubKey: 'leigh genesis',
    coverage: Object.freeze(['rename', 'reactivated', 'active-below-coverage']),
    expected: Object.freeze({
      canonicalName: 'Leigh Genesis',
      status: Object.freeze({
        current: 'active',
        reason: 'not-in-tracked-leagues',
      }),
      aliases: Object.freeze(['Leigh RMI']),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Leigh_Genesis_F.C.']),
      lifecycleEvents: Object.freeze([
        Object.freeze({
          type: 'renamed',
          season: 2008,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Leigh_Genesis_F.C.']),
        }),
        Object.freeze({
          type: 'folded',
          season: 2011,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Leigh_Genesis_F.C.']),
        }),
        Object.freeze({
          type: 'reactivated',
          season: 2012,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Leigh_Genesis_F.C.']),
        }),
      ]),
      observedRows: Object.freeze([
        Object.freeze({
          season: 2000,
          tier: 'tier5',
          team: 'Leigh RMI',
        }),
      ]),
    }),
  }),
  Object.freeze({
    clubKey: 'runcorn fc halton',
    coverage: Object.freeze(['rename', 'defunct', 'supporter-phoenix', 'external-target']),
    expected: Object.freeze({
      canonicalName: 'Runcorn FC Halton',
      status: Object.freeze({
        current: 'defunct',
        reason: 'dissolved',
      }),
      aliases: Object.freeze(['Runcorn', 'Runcorn FC Halton']),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Runcorn_F.C._Halton']),
      lifecycleEvents: Object.freeze([
        Object.freeze({
          type: 'renamed',
          season: 2000,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Runcorn_F.C._Halton']),
        }),
        Object.freeze({
          type: 'dissolved',
          season: 2006,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Runcorn_F.C._Halton']),
        }),
        Object.freeze({
          type: 'supporterPhoenixFormed',
          season: 2006,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Runcorn_Linnets_F.C.']),
        }),
      ]),
      relationships: Object.freeze([
        Object.freeze({
          clubKey: 'runcorn linnets',
          relationship: 'supporterPhoenix',
          direction: 'supporterFounded',
          season: 2006,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Runcorn_Linnets_F.C.']),
        }),
      ]),
      observedRows: Object.freeze([
        Object.freeze({
          season: 1981,
          tier: 'tier5',
          team: 'Runcorn',
        }),
        Object.freeze({
          season: 2004,
          tier: 'tier6',
          team: 'Runcorn FC Halton',
        }),
      ]),
    }),
  }),
  Object.freeze({
    clubKey: 'redditch united',
    coverage: Object.freeze(['active-tracked-sparse', 'multi-stint']),
    expected: Object.freeze({
      canonicalName: 'Redditch United',
      status: Object.freeze({
        current: 'active',
        reason: 'possibly-missing-from-current-data',
      }),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Redditch_United_F.C.']),
      observedRows: Object.freeze([
        Object.freeze({
          season: 1979,
          tier: 'tier5',
          team: 'Redditch United',
        }),
        Object.freeze({
          season: 2004,
          tier: 'tier6',
          team: 'Redditch United',
        }),
      ]),
    }),
  }),
  Object.freeze({
    clubKey: 'stafford rangers',
    coverage: Object.freeze(['active-below-coverage']),
    expected: Object.freeze({
      canonicalName: 'Stafford Rangers',
      status: Object.freeze({
        current: 'active',
        reason: 'not-in-tracked-leagues',
      }),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Stafford_Rangers_F.C.']),
      observedRows: Object.freeze([
        Object.freeze({
          season: 1979,
          tier: 'tier5',
          team: 'Stafford Rangers',
        }),
      ]),
    }),
  }),
  Object.freeze({
    clubKey: 'staines town',
    coverage: Object.freeze(['defunct', 'suspended-operations']),
    expected: Object.freeze({
      canonicalName: 'Staines Town',
      status: Object.freeze({
        current: 'defunct',
        reason: 'dissolved',
      }),
      sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Staines_Town_F.C.']),
      lifecycleEvents: Object.freeze([
        Object.freeze({
          type: 'suspended-operations',
          season: 2021,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Staines_Town_F.C.']),
        }),
        Object.freeze({
          type: 'dissolved',
          season: 2022,
          sourceUrls: Object.freeze(['https://en.wikipedia.org/wiki/Staines_Town_F.C.']),
        }),
      ]),
      observedRows: Object.freeze([
        Object.freeze({
          season: 2009,
          tier: 'tier6',
          team: 'Staines Town',
        }),
      ]),
    }),
  }),
]);

export default clubMetadataFixtures;
