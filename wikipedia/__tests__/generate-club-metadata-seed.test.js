import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jest } from '@jest/globals';
import {
  buildClubMetadataSeed,
  buildClubMetadataReviewReport,
  writeClubMetadataSeedFile,
} from '../data/generate-club-metadata-seed.js';
import {
  analyzeClubContinuity,
  analyzeClubContinuityFiles,
  analyzeClubLineageWatchlist,
  analyzeHistoricalStatusReasons,
  runCli as runClubContinuityCli,
} from '../data/verify-club-continuity.js';
import {
  buildWikipediaClubPageCandidates,
  inferEnglishLeagueLevel,
  suggestClubStatusReasonFromWikipedia,
  suggestClubStatusReasonFromWikipediaHtml,
} from '../data/suggest-club-status-reasons.js';

describe('buildClubMetadataSeed', () => {
  test('derives canonical club metadata from observed league table rows', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1893: {
          tier2: {
            table: [{ team: 'Woolwich Arsenal' }, { team: 'Small Heath' }],
          },
        },
        1894: {
          tier2: {
            table: [{ team: 'Woolwich Arsenal' }],
          },
        },
        1904: {
          tier1: {
            table: [{ team: 'Small Heath' }],
          },
        },
        1905: {
          tier1: {
            table: [{ team: 'Birmingham' }],
          },
        },
        1914: {
          tier1: {
            table: [{ team: 'Arsenal' }],
          },
        },
      },
    });

    expect(Object.keys(seed)).toEqual(['arsenal', 'birmingham city']);
    expect(seed.arsenal).toMatchObject({
      clubId: 'arsenal',
      canonicalName: 'Arsenal',
      status: {
        current: 'active',
        trackedFromSeason: 1893,
        trackedToSeason: null,
        hasUnexplainedGaps: false,
      },
      history: {
        nameHistory: [],
        lifecycleEvents: [],
        trackedMembership: [
          {
            fromSeason: 1893,
            toSeason: 1894,
            tiers: ['tier2'],
            basis: 'observed',
          },
          {
            fromSeason: 1914,
            toSeason: null,
            tiers: ['tier1'],
            basis: 'observed',
          },
        ],
        absenceExplanations: [],
      },
      derived: {
        source: 'football-data-output',
        aliases: ['Arsenal', 'Woolwich Arsenal'],
        identitySources: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Arsenal_F.C.',
          },
        ],
        observedNames: [
          {
            rawName: 'Woolwich Arsenal',
            normalizedName: 'woolwich arsenal',
            firstSeenSeason: 1893,
            lastSeenSeason: 1894,
            seasonsSeen: [1893, 1894],
            tiersSeen: ['tier2'],
          },
          {
            rawName: 'Arsenal',
            normalizedName: 'arsenal',
            firstSeenSeason: 1914,
            lastSeenSeason: 1914,
            seasonsSeen: [1914],
            tiersSeen: ['tier1'],
          },
        ],
        observedNamePeriods: [
          { name: 'Woolwich Arsenal', startSeason: 1893, endSeason: 1894 },
          { name: 'Arsenal', startSeason: 1914, endSeason: 1914 },
        ],
        firstSeenSeason: 1893,
        lastSeenSeason: 1914,
        seasonsSeen: [1893, 1894, 1914],
        totalSeasonsSeen: 3,
        tiersSeen: ['tier1', 'tier2'],
        tierSeasons: [
          { tierKey: 'tier1', seasons: [1914] },
          { tierKey: 'tier2', seasons: [1893, 1894] },
        ],
        coverageGaps: [{ startSeason: 1895, endSeason: 1913, length: 19 }],
      },
    });
    expect(seed.arsenal.clubId).toBe('arsenal');
    expect(seed['birmingham city'].canonicalName).toBe('Birmingham City');
    expect(seed['birmingham city'].clubId).toBe('birmingham-city');
    expect(seed['birmingham city'].derived.aliases).toEqual(['Birmingham', 'Small Heath']);
    expect(seed['birmingham city'].derived.coverageGaps).toEqual([
      { startSeason: 1894, endSeason: 1903, length: 10 },
    ]);
  });

  test('marks unresolved clubs missing from the latest season for manual review', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        2000: {
          tier4: {
            table: [{ team: 'Example Historical' }],
          },
        },
        2001: {
          tier4: {
            table: [{ team: 'Example Active' }],
          },
        },
      },
    });

    expect(seed['example historical'].status).toMatchObject({
      current: 'unknown',
      trackedFromSeason: 2000,
      trackedToSeason: 2000,
      hasUnexplainedGaps: false,
      reason: 'manual-review-required',
    });
    expect(seed['example active'].status).toMatchObject({
      current: 'active',
      trackedFromSeason: 2001,
      trackedToSeason: null,
      hasUnexplainedGaps: false,
    });
  });

  test('keeps successor clubs separate and applies season-aware identity rules', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1982: {
          tier4: {
            table: [{ team: 'Chester' }],
          },
        },
        1983: {
          tier4: {
            table: [{ team: 'Chester City' }],
          },
        },
        2003: {
          tier2: {
            table: [{ team: 'Wimbledon' }],
          },
        },
        2011: {
          tier4: {
            table: [{ team: 'AFC Wimbledon' }],
          },
        },
        2013: {
          tier5: {
            table: [{ team: 'Halifax Town' }, { team: 'FC Halifax Town' }],
          },
        },
        2024: {
          tier6: {
            table: [{ team: 'Chester' }],
          },
        },
      },
    });

    expect(Object.keys(seed).sort()).toEqual([
      'afc wimbledon',
      'chester',
      'chester city',
      'fc halifax town',
      'halifax town',
      'wimbledon',
    ]);
    expect(seed['chester city'].derived.aliases).toEqual(['Chester', 'Chester City']);
    expect(seed['chester city'].derived.identitySources).toEqual([
      {
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes:
          'Earlier Football League Chester records belong to the Chester City identity; modern Chester is a successor club.',
      },
      {
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Chester_City_F.C.',
        notes: 'Used for expulsion, winding-up, and Chester phoenix context.',
      },
    ]);
    expect(seed.chester.derived.aliases).toEqual(['Chester']);
    expect(seed['chester city'].derived.relationships).toEqual([
      {
        clubKey: 'chester',
        relationship: 'phoenix',
        direction: 'successor',
        season: 2010,
        label: 'Chester was formed after Chester City was wound up.',
        sourceRefs: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Chester_F.C.',
            notes: 'Used for Chester reformation after Chester City liquidation.',
          },
        ],
      },
    ]);
    expect(seed.chester.derived.relationships).toEqual([
      {
        clubKey: 'chester city',
        relationship: 'phoenix',
        direction: 'predecessor',
        season: 2010,
        label: 'Chester was formed after Chester City was wound up.',
        sourceRefs: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Chester_F.C.',
            notes: 'Used for Chester reformation after Chester City liquidation.',
          },
        ],
      },
    ]);
    expect(seed['halifax town'].derived.relationships).toEqual([
      {
        clubKey: 'fc halifax town',
        relationship: 'phoenix',
        direction: 'successor',
        label: 'FC Halifax Town is tracked separately as a phoenix identity after Halifax Town.',
        sourceRefs: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Halifax_Town_A.F.C.',
            notes: 'Used for Halifax Town closure and FC Halifax Town phoenix context.',
          },
        ],
      },
    ]);
    expect(seed['afc wimbledon'].canonicalName).toBe('AFC Wimbledon');
    expect(seed.wimbledon.canonicalName).toBe('Wimbledon');
  });

  test('splits same-name historical and modern club identities when sources distinguish them', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1929: {
          tier3: {
            table: [{ team: 'South Shields' }],
          },
        },
        1930: {
          tier3: {
            table: [{ team: 'Gateshead' }],
          },
        },
        1961: {
          tier4: {
            table: [{ team: 'Accrington Stanley' }],
          },
        },
        2006: {
          tier4: {
            table: [{ team: 'Accrington Stanley' }],
          },
        },
        2024: {
          tier6: {
            table: [{ team: 'South Shields' }],
          },
        },
      },
    });

    expect(Object.keys(seed).sort()).toEqual([
      'accrington stanley',
      'accrington stanley 1891',
      'gateshead 1899',
      'south shields',
    ]);
    expect(seed['accrington stanley 1891'].canonicalName).toBe('Accrington Stanley (1891)');
    expect(seed['accrington stanley 1891'].clubId).toBe('accrington-stanley-1891');
    expect(seed['accrington stanley 1891'].derived.seasonsSeen).toEqual([1961]);
    expect(seed['accrington stanley'].canonicalName).toBe('Accrington Stanley');
    expect(seed['accrington stanley'].clubId).toBe('accrington-stanley');
    expect(seed['accrington stanley'].derived.seasonsSeen).toEqual([2006]);
    expect(seed['accrington stanley 1891'].derived.relationships).toEqual([
      {
        clubKey: 'accrington stanley',
        relationship: 'phoenix',
        direction: 'successor',
        season: 1968,
        label: 'The modern Accrington Stanley was formed after the 1891 club folded.',
        sourceRefs: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Accrington_Stanley_F.C._(1891)',
            notes:
              'Used for Football League resignation, liquidation, and separate identity context.',
          },
        ],
      },
    ]);
    expect(seed['gateshead 1899'].canonicalName).toBe('Gateshead (1899)');
    expect(seed['gateshead 1899'].derived.aliases).toEqual(['Gateshead', 'South Shields']);
    expect(seed['gateshead 1899'].derived.seasonsSeen).toEqual([1929, 1930]);
    expect(seed['gateshead 1899'].derived.identitySources).toEqual([
      {
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes:
          'Former EFL list describes the older Gateshead club as defunct with new Gateshead and South Shields clubs formed.',
      },
      {
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Gateshead_A.F.C.',
        notes:
          'The original South Shields club relocated to Gateshead in 1930 and adopted the Gateshead name.',
      },
      {
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Gateshead_F.C.',
        notes: 'Used for modern Gateshead successor context.',
      },
    ]);
    expect(seed['south shields'].canonicalName).toBe('South Shields');
    expect(seed['south shields'].derived.seasonsSeen).toEqual([2024]);
  });

  test('merges curated lifecycle metadata and relationship labels for historical clubs', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1892: {
          tier1: {
            table: [{ team: 'Accrington' }],
          },
        },
        2003: {
          tier2: {
            table: [{ team: 'Wimbledon' }],
          },
        },
        2005: {
          tier4: {
            table: [{ team: 'Rushden & Diamonds' }],
          },
        },
        2025: {
          tier4: {
            table: [{ team: 'Milton Keynes Dons' }],
          },
        },
      },
    });

    expect(seed.accrington.status).toMatchObject({
      current: 'defunct',
      reason: 'folded',
      reasonLabel: 'Folded after leaving the Football League.',
      trackedFromSeason: 1892,
      trackedToSeason: 1892,
    });
    expect(seed.accrington.history.lifecycleEvents).toEqual([
      {
        type: 'resigned',
        season: 1892,
        label: 'Resigned from the Football League rather than play in the Second Division.',
        sourceRefs: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Accrington_F.C.',
            notes: 'Used for Football League resignation and folding context.',
          },
        ],
      },
      {
        type: 'folded',
        season: 1895,
        date: '1896-01-14',
        label: 'Folded after financial problems outside the Football League.',
        sourceRefs: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Accrington_F.C.',
            notes: 'Used for Football League resignation and folding context.',
          },
        ],
      },
    ]);
    expect(seed.wimbledon.status).toMatchObject({
      current: 'relocated',
      reason: 'relocated',
      reasonLabel:
        'Relocated to Milton Keynes and became Milton Keynes Dons; supporters founded AFC Wimbledon.',
    });
    expect(seed.wimbledon.derived.relationships).toEqual([
      {
        clubKey: 'afc wimbledon',
        relationship: 'supporterPhoenix',
        direction: 'supporterFounded',
        season: 2002,
        label:
          'AFC Wimbledon was founded by supporters after Wimbledon F.C. was allowed to relocate.',
        sourceRefs: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/AFC_Wimbledon',
            notes: 'Used for supporter-founded phoenix club context.',
          },
        ],
      },
      {
        clubKey: 'milton keynes dons',
        relationship: 'relocation',
        direction: 'relocatedTo',
        season: 2004,
        label: 'Wimbledon F.C. relocated to Milton Keynes and became Milton Keynes Dons.',
        sourceRefs: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Milton_Keynes_Dons_F.C.',
            notes: 'Used for Wimbledon relocation and Milton Keynes Dons formation context.',
          },
        ],
      },
    ]);
    expect(seed['rushden and diamonds'].derived.relationships).toEqual([
      {
        clubKey: 'afc rushden and diamonds',
        relationship: 'supporterPhoenix',
        direction: 'supporterFounded',
        season: 2011,
        label:
          'AFC Rushden & Diamonds was formed by supporters after Rushden & Diamonds was expelled and dissolved.',
        sourceRefs: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/AFC_Rushden_%26_Diamonds',
            notes: 'Used for supporter phoenix formation context.',
          },
        ],
      },
    ]);
  });

  test('applies reviewed historical reason decisions from the Wikipedia audit', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1890: {
          tier2: {
            table: [{ team: 'Sunderland Albion' }, { team: "Birmingham St George's" }],
          },
        },
        1892: {
          tier2: {
            table: [{ team: 'Bootle' }],
          },
        },
        1895: {
          tier2: {
            table: [{ team: 'Rotherham Town' }, { team: 'Burton Wanderers' }],
          },
        },
        1900: {
          tier2: {
            table: [{ team: 'New Brighton Tower' }],
          },
        },
        1906: {
          tier2: {
            table: [{ team: 'Burton United' }],
          },
        },
        1908: {
          tier2: {
            table: [{ team: 'Chesterfield Town' }],
          },
        },
        2025: {
          tier4: {
            table: [{ team: 'Chesterfield' }],
          },
        },
      },
    });

    expect(seed['sunderland albion'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
      reasonLabel: 'Dissolved in 1892 after leaving the Football Alliance/Northern League record.',
    });
    expect(seed['birmingham st georges'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
      reasonLabel: 'Dissolved in 1892 after its Football Alliance period.',
    });
    expect(seed.bootle.status).toMatchObject({
      current: 'defunct',
      reason: 'liquidated',
      reasonLabel:
        'The original Bootle club resigned from the Football League and went into liquidation in 1893; the modern Bootle is a separate later club.',
    });
    expect(seed['rotherham town'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
      reasonLabel:
        'The original 1878 Rotherham Town club failed to apply for re-election and folded in 1896.',
    });
    expect(seed['rotherham town'].derived.relationships || []).not.toContainEqual(
      expect.objectContaining({
        clubKey: 'rotherham united',
      })
    );
    expect(seed['burton wanderers'].status).toMatchObject({
      current: 'merged',
      reason: 'merged',
      reasonLabel: 'Merged with Burton Swifts in 1901 to form Burton United.',
    });
    expect(seed['burton wanderers'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'burton united',
        relationship: 'merger',
        direction: 'mergedInto',
        season: 1901,
      }),
    ]);
    expect(seed['new brighton tower'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
      reasonLabel: 'Disbanded in 1901 after three Football League seasons.',
    });
    expect(seed['burton united'].status).toMatchObject({
      current: 'merged',
      reason: 'merged',
      reasonLabel:
        'Formed from Burton Swifts and Burton Wanderers, played its last competitive season in 1910, and legally ended in a 1924 merger with Burton All Saints.',
    });
    expect(seed['burton united'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'burton albion',
        relationship: 'successor',
        direction: 'successor',
        season: 1950,
      }),
      expect.objectContaining({
        clubKey: 'burton swifts',
        relationship: 'merger',
        direction: 'formedFrom',
        season: 1901,
      }),
      expect.objectContaining({
        clubKey: 'burton wanderers',
        relationship: 'merger',
        direction: 'formedFrom',
        season: 1901,
      }),
    ]);
    expect(seed['chesterfield town'].status).toMatchObject({
      current: 'defunct',
      reason: 'liquidated',
      reasonLabel:
        'Failed to gain re-election to the Football League in 1909 and entered liquidation in 1915; Chesterfield was reformed in 1919.',
    });
    expect(seed.chesterfield.history.lifecycleEvents).toEqual([]);
  });

  test('applies final reviewed lower-tier continuity decisions from the Wikipedia audit', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1914: {
          tier2: {
            table: [{ team: 'Glossop' }],
          },
        },
        1922: {
          tier3: {
            table: [{ team: 'Stalybridge Celtic' }],
          },
        },
        1929: {
          tier3: {
            table: [
              {
                team: 'Merthyr Town',
                notes: 'Failed re-election and demoted to the Southern League',
              },
            ],
          },
        },
        1950: {
          tier3: {
            table: [{ team: 'New Brighton' }],
          },
        },
        2009: {
          tier4: {
            table: [{ team: 'Darlington' }],
          },
        },
        2022: {
          tier6: {
            table: [{ team: 'Cheshunt' }],
          },
        },
        2024: {
          tier6: {
            table: [{ team: 'Farsley Celtic' }, { team: 'Rushall Olympic' }, { team: 'Weymouth' }],
          },
        },
        2025: {
          tier6: {
            table: [{ team: 'Darlington' }, { team: 'Merthyr Town' }],
          },
        },
      },
    });

    expect(seed.glossop.status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
      reasonLabel:
        'Wikipedia lists Glossop North End in the North West Counties League Premier Division, below current tracked coverage.',
    });
    expect(seed['stalybridge celtic'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
      reasonLabel:
        'Wikipedia lists the club in the Northern Premier League Division One West, below current tracked coverage.',
    });
    expect(seed['new brighton'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
      reasonLabel:
        'The original Football League club disbanded in 1983; a later same-name club formed in 1993 and folded in 2012.',
    });
    expect(seed['new brighton'].history.lifecycleEvents).toEqual([
      expect.objectContaining({
        type: 'dissolved',
        season: 1983,
      }),
      expect.objectContaining({
        type: 'phoenix',
        season: 1993,
      }),
      expect.objectContaining({
        type: 'dissolved',
        season: 2012,
      }),
    ]);
    expect(seed['darlington 1883'].status).toMatchObject({
      current: 'historical',
      reason: 'successor-active',
      reasonLabel:
        'The older Darlington Football League identity is historical; modern Darlington is tracked separately as an active successor identity.',
    });
    expect(seed['darlington 1883'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'darlington',
        relationship: 'phoenix',
        direction: 'successor',
      }),
    ]);
    expect(seed['farsley celtic'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
      reasonLabel:
        'Folded in 2010, reformed as Farsley AFC, returned to the Farsley Celtic name in 2015, and dissolved in December 2025.',
    });
    expect(seed['farsley celtic'].history.lifecycleEvents).toEqual([
      expect.objectContaining({
        type: 'dissolved',
        season: 2010,
      }),
      expect.objectContaining({
        type: 'reformed',
        season: 2010,
      }),
      expect.objectContaining({
        type: 'renamed',
        season: 2015,
      }),
      expect.objectContaining({
        type: 'dissolved',
        season: 2025,
      }),
      expect.objectContaining({
        type: 'withdrew',
        season: 2025,
      }),
    ]);
    expect(seed['merthyr town'].status).toMatchObject({
      current: 'active',
      reason: 'successor-active',
      reasonLabel:
        'Metadata spans the Football League-era Merthyr Town, Merthyr Tydfil, and the reformed Merthyr Town successor lineage.',
    });
    expect(seed['merthyr town'].history.lifecycleEvents).toEqual([
      expect.objectContaining({
        type: 'not-re-elected',
        season: 1929,
      }),
      expect.objectContaining({
        type: 'dissolved',
        season: 1934,
      }),
      expect.objectContaining({
        type: 'reformed',
        season: 1945,
      }),
      expect.objectContaining({
        type: 'liquidated',
        season: 2010,
      }),
      expect.objectContaining({
        type: 'reformed',
        season: 2010,
      }),
    ]);
    expect(seed.cheshunt.status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
      reasonLabel:
        'Wikipedia lists the club in the Isthmian League Premier Division, a level 7 league inside tracked but sparse coverage.',
    });
    expect(seed['rushall olympic'].status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
      reasonLabel:
        'Wikipedia lists the club in the Southern League Premier Division Central, a level 7 league inside tracked but sparse coverage.',
    });
    expect(seed.weymouth.status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
      reasonLabel:
        'Wikipedia lists the club in the Southern League Division One South, below current tracked coverage.',
    });
  });

  test('applies reviewed manual lower-tier lifecycle corrections', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1979: {
          tier5: {
            table: [{ team: 'Gravesend & Northfleet' }, { team: 'Telford United' }],
          },
        },
        1987: {
          tier5: {
            table: [{ team: 'Fisher Athletic' }],
          },
        },
        1989: {
          tier5: {
            table: [{ team: 'Farnborough Town' }],
          },
        },
        1991: {
          tier5: {
            table: [{ team: 'Redbridge Forest' }],
          },
        },
        1994: {
          tier5: {
            table: [{ team: 'Stevenage Borough' }],
          },
        },
        1996: {
          tier5: {
            table: [{ team: 'Hayes' }],
          },
        },
        2004: {
          tier5: {
            table: [{ team: 'Canvey Island' }],
          },
          tier6: {
            table: [{ team: 'Moor Green' }, { team: 'Vauxhall Motors' }],
          },
        },
        2005: {
          tier6: {
            table: [{ team: 'Hyde United' }, { team: 'Yeading' }],
          },
        },
        2008: {
          tier6: {
            table: [{ team: 'Team Bath' }],
          },
        },
        2009: {
          tier6: {
            table: [{ team: 'Ilkeston Town' }],
          },
        },
        2010: {
          tier6: {
            table: [{ team: 'Farnborough' }, { team: 'Hyde' }, { team: 'Stevenage' }],
          },
        },
        2013: {
          tier6: {
            table: [{ team: 'Vauxhall Motors' }],
          },
        },
        2016: {
          tier6: {
            table: [{ team: 'Worcester City' }],
          },
        },
        2025: {
          tier5: {
            table: [
              { team: 'AFC Telford United' },
              { team: 'Dagenham & Redbridge' },
              { team: 'Ebbsfleet United' },
              { team: 'Farnborough' },
              { team: 'Solihull Moors' },
              { team: 'Stevenage' },
            ],
          },
          tier6: {
            table: [{ team: 'Hayes & Yeading United' }],
          },
        },
      },
    });

    const review = buildClubMetadataReviewReport({ clubs: seed });
    expect(review.issues.filter((issue) => issue.type === 'manual-status-review')).toEqual([]);

    expect(seed['ebbsfleet united'].derived.aliases).toEqual([
      'Ebbsfleet United',
      'Gravesend & Northfleet',
    ]);
    expect(seed['ebbsfleet united'].history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'renamed', season: 2007 }),
    ]);
    expect(seed.stevenage.derived.aliases).toEqual(['Stevenage', 'Stevenage Borough']);
    expect(seed['hyde united'].derived.aliases).toEqual(['Hyde', 'Hyde United']);
    expect(seed['hyde united'].history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'renamed', season: 2010 }),
      expect.objectContaining({ type: 'renamed', season: 2015 }),
    ]);

    expect(seed['canvey island'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['farnborough town'].status).toMatchObject({
      current: 'historical',
      reason: 'successor-active',
    });
    expect(seed['fisher athletic'].status).toMatchObject({
      current: 'defunct',
      reason: 'folded',
    });
    expect(seed.hayes.status).toMatchObject({ current: 'merged', reason: 'merged' });
    expect(seed.yeading.status).toMatchObject({ current: 'merged', reason: 'merged' });
    expect(seed['ilkeston town'].status).toMatchObject({
      current: 'defunct',
      reason: 'liquidated',
    });
    expect(seed['moor green'].status).toMatchObject({ current: 'merged', reason: 'merged' });
    expect(seed['redbridge forest'].status).toMatchObject({
      current: 'merged',
      reason: 'merged',
    });
    expect(seed['team bath'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
    });
    expect(seed['telford united'].status).toMatchObject({
      current: 'defunct',
      reason: 'folded',
    });
    expect(seed['vauxhall motors'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['worcester city'].status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
    });

    expect(seed['farnborough town'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'farnborough',
        relationship: 'successor',
        direction: 'successor',
        season: 2007,
      }),
    ]);
    expect(seed.hayes.derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'hayes and yeading united',
        relationship: 'merger',
        direction: 'mergedInto',
        season: 2007,
      }),
    ]);
    expect(seed['moor green'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'solihull moors',
        relationship: 'merger',
        direction: 'mergedInto',
        season: 2007,
      }),
    ]);
    expect(seed['redbridge forest'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'dagenham and redbridge',
        relationship: 'merger',
        direction: 'mergedInto',
        season: 1992,
      }),
    ]);
    expect(seed['telford united'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'afc telford united',
        relationship: 'phoenix',
        direction: 'successor',
        season: 2004,
      }),
    ]);
  });

  test('applies reviewed lower-tier coverage batch decisions', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1979: {
          tier5: {
            table: [{ team: 'AP Leamington' }, { team: 'Bangor City' }],
          },
        },
        1988: {
          tier5: {
            table: [{ team: 'Aylesbury United' }],
          },
        },
        1992: {
          tier5: {
            table: [{ team: 'Bromsgrove Rovers' }],
          },
        },
        2004: {
          tier6: {
            table: [
              { team: 'Ashton United' },
              { team: 'Basingstoke Town' },
              { team: 'Bognor Regis Town' },
              { team: 'Cambridge City' },
            ],
          },
        },
        2007: {
          tier6: {
            table: [{ team: 'Burscough' }],
          },
        },
        2012: {
          tier6: {
            table: [{ team: 'AFC Hornchurch' }],
          },
        },
        2025: {
          tier5: {
            table: [{ team: 'Current Example' }],
          },
        },
      },
    });

    const review = buildClubMetadataReviewReport({ clubs: seed });
    const reviewedClubKeys = new Set([
      'hornchurch',
      'leamington',
      'ashton united',
      'aylesbury united',
      'bangor city',
      'basingstoke town',
      'bognor regis town',
      'bromsgrove rovers',
      'burscough',
      'cambridge city',
    ]);
    expect(
      review.issues.filter(
        (issue) => reviewedClubKeys.has(issue.clubKey) && issue.type.endsWith('-review')
      )
    ).toEqual([]);

    expect(seed.hornchurch.derived.aliases).toEqual(['AFC Hornchurch']);
    expect(seed.hornchurch.status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
    });
    expect(seed.hornchurch.history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'folded', season: 2004 }),
      expect.objectContaining({ type: 'reformed', season: 2005 }),
      expect.objectContaining({ type: 'renamed', season: 2019 }),
    ]);

    expect(seed.leamington.derived.aliases).toEqual(['AP Leamington']);
    expect(seed.leamington.status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
    });
    expect(seed.leamington.history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'renamed', season: 1984 }),
      expect.objectContaining({ type: 'abeyance', season: 1987 }),
      expect.objectContaining({ type: 'reactivated', season: 2000 }),
    ]);

    expect(seed['ashton united'].status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
    });
    expect(seed['aylesbury united'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['basingstoke town'].status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
    });
    expect(seed['bognor regis town'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed.burscough.status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['cambridge city'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });

    expect(seed['bangor city'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
    });
    expect(seed['bangor city'].history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'withdrew', season: 2021 }),
      expect.objectContaining({ type: 'dissolved', season: 2025 }),
    ]);
    expect(seed['bangor city'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'bangor city 1876',
        relationship: 'supporterPhoenix',
        direction: 'supporterFounded',
        season: 2019,
      }),
    ]);

    expect(seed['bromsgrove rovers'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
    });
    expect(seed['bromsgrove rovers'].history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'administration', season: 2009 }),
      expect.objectContaining({ type: 'expelled', season: 2010 }),
      expect.objectContaining({ type: 'dissolved', season: 2010 }),
    ]);
    expect(seed['bromsgrove rovers'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'bromsgrove sporting',
        relationship: 'phoenix',
        direction: 'successor',
        season: 2009,
      }),
    ]);
  });

  test('applies reviewed lower-tier coverage batch two decisions', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1981: {
          tier5: {
            table: [{ team: 'Dagenham' }, { team: 'Enfield' }],
          },
        },
        2004: {
          tier6: {
            table: [
              { team: 'Carshalton Athletic' },
              { team: 'Dorchester Town' },
              { team: 'Droylsden' },
            ],
          },
        },
        2009: {
          tier6: {
            table: [{ team: 'Corby Town' }, { team: 'Eastwood Town' }],
          },
        },
        2011: {
          tier6: {
            table: [{ team: 'Colwyn Bay' }],
          },
        },
        2015: {
          tier6: {
            table: [{ team: 'FC United of Manchester' }],
          },
        },
        2016: {
          tier6: {
            table: [{ team: 'East Thurrock United' }],
          },
        },
        2024: {
          tier6: {
            table: [{ team: 'Enfield Town' }],
          },
        },
        2025: {
          tier5: {
            table: [{ team: 'Dagenham & Redbridge' }],
          },
        },
      },
    });

    const review = buildClubMetadataReviewReport({ clubs: seed });
    const reviewedClubKeys = new Set([
      'carshalton athletic',
      'colwyn bay',
      'corby town',
      'dagenham',
      'dorchester town',
      'droylsden',
      'east thurrock united',
      'eastwood town',
      'enfield',
      'fc united of manchester',
    ]);
    expect(
      review.issues.filter(
        (issue) => reviewedClubKeys.has(issue.clubKey) && issue.type.endsWith('-review')
      )
    ).toEqual([]);

    expect(seed['carshalton athletic'].status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
    });
    expect(seed['colwyn bay'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['corby town'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['dorchester town'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed.droylsden.status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed.droylsden.history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'withdrew', season: 2020 }),
      expect.objectContaining({ type: 'inactive', season: 2021 }),
      expect.objectContaining({ type: 'reactivated', season: 2023 }),
    ]);
    expect(seed['fc united of manchester'].status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
    });

    expect(seed.dagenham.status).toMatchObject({ current: 'merged', reason: 'merged' });
    expect(seed.dagenham.history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'merged', season: 1992 }),
    ]);
    expect(seed.dagenham.derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'dagenham and redbridge',
        relationship: 'merger',
        direction: 'mergedInto',
        season: 1992,
      }),
    ]);

    expect(seed['east thurrock united'].status).toMatchObject({
      current: 'defunct',
      reason: 'liquidated',
    });
    expect(seed['east thurrock united'].history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'liquidated', season: 2023 }),
      expect.objectContaining({ type: 'phoenixFormed', season: 2023 }),
    ]);
    expect(seed['east thurrock united'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'east thurrock community',
        relationship: 'phoenix',
        direction: 'successor',
        season: 2023,
      }),
    ]);

    expect(seed['eastwood town'].status).toMatchObject({
      current: 'defunct',
      reason: 'dissolved',
    });
    expect(seed['eastwood town'].history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'resigned', season: 2013 }),
      expect.objectContaining({ type: 'dissolved', season: 2014 }),
      expect.objectContaining({ type: 'successorFormed', season: 2014 }),
    ]);
    expect(seed['eastwood town'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'eastwood cfc',
        relationship: 'successor',
        direction: 'successor',
        season: 2014,
      }),
    ]);

    expect(seed.enfield.status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed.enfield.history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'supporterPhoenixFormed', season: 2001 }),
      expect.objectContaining({ type: 'liquidated', season: 2007 }),
      expect.objectContaining({ type: 'reformed', season: 2007 }),
      expect.objectContaining({ type: 'renamed', season: 2019 }),
    ]);
    expect(seed.enfield.derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'enfield town',
        relationship: 'supporterPhoenix',
        direction: 'supporterFounded',
        season: 2001,
      }),
    ]);
  });

  test('applies reviewed lower-tier coverage batch three decisions', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1980: {
          tier5: {
            table: [{ team: 'Frickley Athletic' }],
          },
        },
        1995: {
          tier5: {
            table: [{ team: 'Hednesford Town' }],
          },
        },
        1998: {
          tier5: {
            table: [{ team: 'Kingstonian' }],
          },
        },
        2004: {
          tier5: {
            table: [{ team: 'Grays Athletic' }],
          },
          tier6: {
            table: [{ team: 'Hucknall Town' }, { team: 'Hinckley United' }],
          },
        },
        2005: {
          tier6: {
            table: [{ team: 'Histon' }],
          },
        },
        2007: {
          tier5: {
            table: [{ team: 'Hayes & Yeading United' }],
          },
        },
        2008: {
          tier6: {
            table: [{ team: "King's Lynn" }],
          },
        },
        2013: {
          tier6: {
            table: [{ team: 'Gosport Borough' }],
          },
        },
        2025: {
          tier5: {
            table: [{ team: "King's Lynn Town" }],
          },
        },
      },
    });

    const review = buildClubMetadataReviewReport({ clubs: seed });
    const reviewedClubKeys = new Set([
      'frickley athletic',
      'gosport borough',
      'grays athletic',
      'hayes and yeading united',
      'hednesford town',
      'hinckley united',
      'histon',
      'hucknall town',
      'kings lynn',
      'kingstonian',
    ]);
    expect(
      review.issues.filter(
        (issue) => reviewedClubKeys.has(issue.clubKey) && issue.type.endsWith('-review')
      )
    ).toEqual([]);

    expect(seed['frickley athletic'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['gosport borough'].status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
    });
    expect(seed['grays athletic'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['hayes and yeading united'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['hednesford town'].status).toMatchObject({
      current: 'active',
      reason: 'possibly-missing-from-current-data',
    });
    expect(seed.histon.status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed['hucknall town'].status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });
    expect(seed.kingstonian.status).toMatchObject({
      current: 'active',
      reason: 'not-in-tracked-leagues',
    });

    expect(seed['hinckley united'].status).toMatchObject({
      current: 'defunct',
      reason: 'folded',
    });
    expect(seed['hinckley united'].history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'folded', season: 2013 }),
      expect.objectContaining({ type: 'supporterPhoenixFormed', season: 2014 }),
    ]);
    expect(seed['hinckley united'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'hinckley afc',
        relationship: 'supporterPhoenix',
        direction: 'supporterFounded',
        season: 2014,
      }),
    ]);

    expect(seed['kings lynn'].status).toMatchObject({
      current: 'defunct',
      reason: 'folded',
    });
    expect(seed['kings lynn'].history.lifecycleEvents).toEqual([
      expect.objectContaining({ type: 'folded', season: 2009 }),
      expect.objectContaining({ type: 'phoenixFormed', season: 2010 }),
    ]);
    expect(seed['kings lynn'].derived.relationships).toEqual([
      expect.objectContaining({
        clubKey: 'kings lynn town',
        relationship: 'phoenix',
        direction: 'successor',
        season: 2010,
      }),
    ]);
  });

  test('adds official pause explanations for wartime observed coverage gaps', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1938: {
          tier3: {
            table: [{ team: 'Accrington Stanley' }],
          },
        },
        1939: {
          seasonInfo: {
            season: 1939,
            competitionStatus: 'abandoned-season',
            officialLeagueTables: false,
          },
        },
        1940: {
          seasonInfo: {
            season: 1940,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1941: {
          seasonInfo: {
            season: 1941,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1942: {
          seasonInfo: {
            season: 1942,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1943: {
          seasonInfo: {
            season: 1943,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1944: {
          seasonInfo: {
            season: 1944,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1945: {
          seasonInfo: {
            season: 1945,
            competitionStatus: 'regional-bridge-season',
            officialLeagueTables: false,
          },
        },
        1946: {
          tier3: {
            table: [{ team: 'Accrington Stanley' }],
          },
        },
      },
    });

    expect(seed['accrington stanley 1891'].derived.coverageGaps).toEqual([
      { startSeason: 1939, endSeason: 1945, length: 7 },
    ]);
    expect(seed['accrington stanley 1891'].history.absenceExplanations).toEqual([
      {
        fromSeason: 1939,
        toSeason: 1945,
        reason: 'official-competition-paused',
        basis: 'season-metadata',
      },
    ]);
    expect(seed['accrington stanley 1891'].status.hasUnexplainedGaps).toBe(false);
  });

  test('derives gap explanations from table notes when clubs leave tracked coverage', () => {
    const dataset = {
      seasons: {
        2007: {
          tier4: {
            metadata: {
              sourceUrl: 'https://example.test/2007-08',
              seasonSlug: '2007-08-example-season',
              title: 'League Two',
            },
            table: [
              {
                team: 'Example Town',
                notes: 'Relegation to 2008–09 Conference National',
              },
            ],
          },
        },
        2008: { tier4: { table: [] } },
        2009: { tier4: { table: [] } },
        2010: { tier4: { table: [] } },
        2011: { tier4: { table: [] } },
        2012: {
          tier5: {
            table: [{ team: 'Example Town' }],
          },
        },
      },
    };

    const seed = buildClubMetadataSeed(dataset);

    expect(seed['example town'].history.lifecycleEvents).toEqual([
      {
        type: 'relegated-outside-tracked-coverage',
        season: 2007,
        description: 'Relegation to 2008–09 Conference National',
        sourceRefs: [
          {
            type: 'wikipedia-season-page',
            sourceUrl: 'https://example.test/2007-08',
            notes: 'League Two table in 2007-08-example-season',
          },
        ],
      },
    ]);
    expect(seed['example town'].history.absenceExplanations).toEqual([
      {
        fromSeason: 2008,
        toSeason: 2011,
        reason: 'outside-tracked-coverage',
        linkedEventType: 'relegated-outside-tracked-coverage',
        basis: 'table-note',
        notes: 'Relegation to 2008–09 Conference National',
        sourceRefs: [
          {
            type: 'wikipedia-season-page',
            sourceUrl: 'https://example.test/2007-08',
            notes: 'League Two table in 2007-08-example-season',
          },
        ],
      },
    ]);
    expect(seed['example town'].status.hasUnexplainedGaps).toBe(false);
    expect(analyzeClubContinuity(dataset, { clubs: seed })).toEqual([]);
  });

  test('represents lower-tier clubs as observed stints and active below tracked coverage when notes support it', () => {
    const dataset = {
      seasons: {
        2006: {
          tier6: {
            metadata: {
              sourceUrl: 'https://example.test/2006-07',
              seasonSlug: '2006-07-example-season',
              title: 'Conference North',
            },
            table: [
              {
                team: 'Example Town',
                notes: 'Relegation to Northern Premier League Premier Division',
              },
            ],
          },
        },
        2012: {
          tier6: {
            metadata: {
              sourceUrl: 'https://example.test/2012-13',
              seasonSlug: '2012-13-example-season',
              title: 'Conference North',
            },
            table: [
              {
                team: 'Example Town',
                notes: 'Relegation to Southern League Premier Division',
              },
            ],
          },
        },
        2025: {
          tier6: {
            table: [{ team: 'Current Example' }],
          },
        },
      },
    };

    const seed = buildClubMetadataSeed(dataset);

    expect(seed['example town'].history.trackedMembership).toEqual([
      {
        fromSeason: 2006,
        toSeason: 2006,
        tiers: ['tier6'],
        basis: 'observed',
      },
      {
        fromSeason: 2012,
        toSeason: 2012,
        tiers: ['tier6'],
        basis: 'observed',
      },
    ]);
    expect(seed['example town'].history.absenceExplanations).toEqual([
      expect.objectContaining({
        fromSeason: 2007,
        toSeason: 2011,
        reason: 'outside-tracked-coverage',
        linkedEventType: 'relegated-outside-tracked-coverage',
      }),
    ]);
    expect(seed['example town'].status).toMatchObject({
      current: 'active',
      reason: 'below-tracked-coverage',
      trackedFromSeason: 2006,
      trackedToSeason: 2012,
      hasUnexplainedGaps: false,
    });
  });

  test('builds a lower-tier metadata review report for unresolved generated status records', () => {
    const clubs = buildClubMetadataSeed({
      seasons: {
        2024: {
          tier6: {
            table: [{ team: 'Review Town' }],
          },
        },
        2025: {
          tier6: {
            table: [{ team: 'Current Example' }],
          },
        },
      },
    });

    const report = buildClubMetadataReviewReport({
      metadata: { generator: 'test' },
      clubs,
    });

    expect(report.clubCount).toBe(2);
    expect(report.issues).toEqual([
      expect.objectContaining({
        type: 'manual-status-review',
        clubKey: 'review town',
        clubId: 'review-town',
        status: 'unknown',
        reason: 'manual-review-required',
        seasonsSeen: [2024],
        tiersSeen: ['tier6'],
      }),
    ]);
  });
});

describe('verify-club-continuity CLI', () => {
  test('writes a repeatable historical reason audit JSON file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'club-continuity-'));
    const datasetPath = path.join(tmpDir, 'all-seasons.json');
    const metadataPath = path.join(tmpDir, 'club-metadata.json');
    const auditPath = path.join(tmpDir, 'club-historical-reason-audit.json');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    fs.writeFileSync(
      datasetPath,
      JSON.stringify({
        seasons: {
          2000: {
            tier4: {
              table: [{ team: 'Example Historical' }],
            },
          },
          2001: {
            tier4: {
              table: [{ team: 'Example Active' }],
            },
          },
        },
      })
    );
    fs.writeFileSync(
      metadataPath,
      JSON.stringify({
        clubs: {
          'example historical': {
            clubId: 'example-historical',
            canonicalName: 'Example Historical',
            status: {
              current: 'historical',
              trackedFromSeason: 2000,
              trackedToSeason: 2000,
            },
          },
          'example active': {
            clubId: 'example-active',
            canonicalName: 'Example Active',
            status: {
              current: 'active',
              trackedFromSeason: 2001,
              trackedToSeason: null,
            },
          },
        },
      })
    );

    const report = analyzeClubContinuityFiles({
      datasetPath: 'all-seasons.json',
      clubMetadataPath: 'club-metadata.json',
      checkHistoricalReasons: true,
      cwd: tmpDir,
    });

    expect(report.datasetPath).toBe('./all-seasons.json');
    expect(report.clubMetadataPath).toBe('./club-metadata.json');

    try {
      await runClubContinuityCli([
        'node',
        'verify-club-continuity',
        '--dataset',
        datasetPath,
        '--club-metadata',
        metadataPath,
        '--check-historical-reasons',
        '--output',
        auditPath,
      ]);
    } finally {
      consoleSpy.mockRestore();
    }

    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    expect(audit.datasetPath).toBe(datasetPath);
    expect(audit.clubMetadataPath).toBe(metadataPath);
    expect(audit.issues).toEqual([
      expect.objectContaining({
        type: 'missing-historical-status-reason',
        clubId: 'example-historical',
        canonicalName: 'Example Historical',
      }),
    ]);
  });
});

describe('analyzeClubContinuity', () => {
  test('reports missing expected seasons outside official pauses and explanations', () => {
    const dataset = {
      seasons: {
        1950: { tier2: { table: [{ team: 'Example Town' }] } },
        1951: { tier2: { table: [] } },
        1952: { tier2: { table: [] } },
        1953: { tier2: { table: [{ team: 'Example Town' }] } },
      },
    };
    const clubMetadata = {
      clubs: {
        'example town': {
          clubId: 'example-town',
          canonicalName: 'Example Town',
          derived: {
            seasonsSeen: [1950, 1953],
          },
          history: {
            trackedMembership: [
              {
                fromSeason: 1950,
                toSeason: 1953,
                tiers: ['tier2'],
                basis: 'observed',
              },
            ],
            absenceExplanations: [],
          },
        },
      },
    };

    expect(analyzeClubContinuity(dataset, clubMetadata)).toEqual([
      expect.objectContaining({
        type: 'unexplained-club-gap',
        clubId: 'example-town',
        canonicalName: 'Example Town',
        fromSeason: 1951,
        toSeason: 1952,
        missingSeasons: [1951, 1952],
      }),
    ]);
  });

  test('ignores official competition pauses and explicit absence explanations', () => {
    const dataset = {
      seasons: {
        1938: { tier3: { table: [{ team: 'Example Town' }] } },
        1939: {
          seasonInfo: {
            season: 1939,
            competitionStatus: 'abandoned-season',
            officialLeagueTables: false,
          },
        },
        1940: {
          seasonInfo: {
            season: 1940,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1941: {
          seasonInfo: {
            season: 1941,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1942: {
          tier3: { table: [{ team: 'Example Town' }] },
        },
      },
    };
    const clubMetadata = {
      clubs: {
        'example town': {
          clubId: 'example-town',
          canonicalName: 'Example Town',
          derived: {
            seasonsSeen: [1938, 1942],
          },
          history: {
            trackedMembership: [
              {
                fromSeason: 1938,
                toSeason: 1942,
                tiers: ['tier3'],
                basis: 'observed',
              },
            ],
            absenceExplanations: [{ fromSeason: 1941, toSeason: 1941, reason: 'data-gap' }],
          },
        },
      },
    };

    expect(analyzeClubContinuity(dataset, clubMetadata)).toEqual([]);
  });

  test('reports historical club records missing status reasons when requested', () => {
    const clubMetadata = {
      clubs: {
        'example historical': {
          clubId: 'example-historical',
          canonicalName: 'Example Historical',
          status: {
            current: 'historical',
            trackedFromSeason: 1900,
            trackedToSeason: 1905,
          },
        },
        'example defunct with reason': {
          clubId: 'example-defunct-with-reason',
          canonicalName: 'Example Defunct With Reason',
          status: {
            current: 'defunct',
            trackedFromSeason: 1900,
            trackedToSeason: 1905,
            reason: 'folded',
          },
        },
        'example active': {
          clubId: 'example-active',
          canonicalName: 'Example Active',
          status: {
            current: 'active',
            trackedFromSeason: 1900,
            trackedToSeason: null,
          },
        },
      },
    };

    expect(analyzeHistoricalStatusReasons(clubMetadata)).toEqual([
      expect.objectContaining({
        type: 'missing-historical-status-reason',
        clubId: 'example-historical',
        canonicalName: 'Example Historical',
        current: 'historical',
        trackedToSeason: 1905,
      }),
    ]);
  });

  test('reports source-backed lineage rows outside allowed season windows', () => {
    const dataset = {
      seasons: {
        1950: { tier3: { table: [{ team: 'New Brighton' }] } },
        1951: { tier3: { table: [{ team: 'New Brighton' }] } },
      },
    };
    const clubMetadata = {
      clubs: {
        'new brighton': {
          clubId: 'new-brighton',
          canonicalName: 'New Brighton',
          status: {
            current: 'defunct',
            reason: 'dissolved',
          },
        },
      },
    };

    expect(analyzeClubLineageWatchlist(dataset, clubMetadata)).toEqual([
      expect.objectContaining({
        type: 'club-lineage-season-range-violation',
        clubKey: 'new brighton',
        observedName: 'New Brighton',
        season: 1951,
        path: 'seasons.1951.tier3.table.0',
      }),
    ]);
  });

  test('reports source-backed lineage metadata status drift', () => {
    const dataset = {
      seasons: {
        1950: { tier3: { table: [{ team: 'New Brighton' }] } },
      },
    };
    const clubMetadata = {
      clubs: {
        'new brighton': {
          clubId: 'new-brighton',
          canonicalName: 'New Brighton',
          status: {
            current: 'active',
            reason: 'not-in-tracked-leagues',
          },
        },
      },
    };

    expect(analyzeClubLineageWatchlist(dataset, clubMetadata)).toEqual([
      expect.objectContaining({
        type: 'club-lineage-status-mismatch',
        clubKey: 'new brighton',
        field: 'current',
        expected: 'defunct',
        actual: 'active',
      }),
      expect.objectContaining({
        type: 'club-lineage-status-mismatch',
        clubKey: 'new brighton',
        field: 'reason',
        expected: 'dissolved',
        actual: 'not-in-tracked-leagues',
      }),
    ]);
  });

  test('allows documented same-name successor windows without masking metadata expectations', () => {
    const dataset = {
      seasons: {
        1969: { tier4: { table: [{ team: 'Bradford (Park Avenue)' }] } },
        2022: { tier6: { table: [{ team: 'Bradford (Park Avenue)' }] } },
      },
    };
    const clubMetadata = {
      clubs: {
        'bradford park avenue': {
          clubId: 'bradford-park-avenue',
          canonicalName: 'Bradford (Park Avenue)',
          status: {
            current: 'historical',
            reason: 'liquidated',
          },
        },
      },
    };

    expect(analyzeClubLineageWatchlist(dataset, clubMetadata)).toEqual([]);
  });
});

describe('suggestClubStatusReasonFromWikipediaHtml', () => {
  test('infers English pyramid levels from league names', () => {
    expect(inferEnglishLeagueLevel('National League')).toBe(5);
    expect(inferEnglishLeagueLevel('National League North')).toBe(6);
    expect(inferEnglishLeagueLevel('Northern Premier League Premier Division')).toBe(7);
    expect(inferEnglishLeagueLevel('Midland League Premier Division')).toBe(9);
    expect(inferEnglishLeagueLevel('Unknown Sunday League')).toBeNull();
  });

  test('builds candidate slugs from source refs and canonical names', () => {
    const candidates = buildWikipediaClubPageCandidates({
      canonicalName: 'Example Town',
      derived: {
        identitySources: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.',
          },
        ],
      },
    });

    expect(candidates).toEqual([
      'Example_Town_F.C.',
      'Example_Town',
      'Example_Town_A.F.C.',
      'Example_Town_football_club',
      'Example_Town_F.C._(football_club)',
    ]);
  });

  test('suggests defunct reasons from matching club page text', () => {
    const suggestion = suggestClubStatusReasonFromWikipediaHtml({
      club: { canonicalName: 'Example Town' },
      pageUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.',
      html: `
        <h1 id="firstHeading">Example Town F.C.</h1>
        <div id="mw-content-text">
          <div class="mw-parser-output">
            <p><b>Example Town F.C.</b> was an association football club based in Example.</p>
            <h2><span class="mw-headline" id="History">History</span></h2>
            <p>The club was wound up in the High Court after financial problems.</p>
          </div>
        </div>
      `,
    });

    expect(suggestion).toMatchObject({
      foundPage: true,
      matchedClubPage: true,
      pageTitle: 'Example Town F.C.',
      suggestedCurrent: 'defunct',
      suggestedReason: 'liquidated',
      suggestedReasonLabel: 'Wikipedia indicates the club was wound up or liquidated.',
      evidenceSourceUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.#History',
      evidenceSourceLabel: 'History',
    });
    expect(suggestion.evidenceText).toContain('wound up');
  });

  test('suggests active below tracked coverage when the matched club page is current', () => {
    const suggestion = suggestClubStatusReasonFromWikipediaHtml({
      club: { canonicalName: 'Example Town' },
      pageUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.',
      html: `
        <h1 id="firstHeading">Example Town F.C.</h1>
        <div id="mw-content-text">
          <div class="mw-parser-output">
            <p><b>Example Town F.C.</b> is a semi-professional football club based in Example.</p>
            <table class="infobox">
              <tr><th>Current league</th><td>Northern Premier League Division One</td></tr>
            </table>
          </div>
        </div>
      `,
    });

    expect(suggestion).toMatchObject({
      foundPage: true,
      matchedClubPage: true,
      suggestedCurrent: 'active',
      suggestedReason: 'not-in-tracked-leagues',
      suggestedReasonLabel:
        'Wikipedia indicates the club is active at level 8, below current tracked coverage.',
      wikipediaCurrentLeague: 'Northern Premier League Division One',
      wikipediaCurrentLeagueLevel: 8,
      wikipediaTrackingCoverageStatus: 'below-tracked-coverage',
      trackedLeagueLevelLimit: 7,
      evidenceSourceUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.',
      evidenceSourceLabel: 'infobox',
    });
  });

  test('uses page-level infobox citation when lifecycle evidence comes from an infobox row', () => {
    const suggestion = suggestClubStatusReasonFromWikipediaHtml({
      club: {
        canonicalName: 'Example Town',
        status: {
          trackedToSeason: 1892,
        },
      },
      pageUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.',
      html: `
        <h1 id="firstHeading">Example Town F.C.</h1>
        <div id="mw-content-text">
          <div class="mw-parser-output">
            <p><b>Example Town F.C.</b> was an association football club based in Example.</p>
            <table class="infobox">
              <tr><th>Dissolved</th><td>1892</td></tr>
            </table>
          </div>
        </div>
      `,
    });

    expect(suggestion).toMatchObject({
      matchedClubPage: true,
      suggestedReason: 'dissolved',
      evidenceSourceUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.',
      evidenceSourceLabel: 'infobox',
    });
  });

  test('rejects a found page when it does not look like the requested football club', () => {
    const suggestion = suggestClubStatusReasonFromWikipediaHtml({
      club: { canonicalName: 'Example Town' },
      pageUrl: 'https://en.wikipedia.org/wiki/Example_Town',
      html: `
        <h1 id="firstHeading">Example Town</h1>
        <div id="mw-content-text">
          <div class="mw-parser-output">
            <p><b>Example Town</b> is a market town and civil parish.</p>
          </div>
        </div>
      `,
    });

    expect(suggestion).toMatchObject({
      foundPage: true,
      matchedClubPage: false,
      suggestedReason: null,
    });
  });

  test('rejects same-name defunct evidence when lifecycle year does not match tracked identity', () => {
    const suggestion = suggestClubStatusReasonFromWikipediaHtml({
      club: {
        canonicalName: 'Example Town',
        status: {
          trackedToSeason: 1892,
        },
      },
      pageUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.',
      html: `
        <h1 id="firstHeading">Example Town F.C.</h1>
        <div id="mw-content-text">
          <div class="mw-parser-output">
            <p><b>Example Town F.C.</b> was an association football club based in Example.</p>
            <p>The later club folded during the 1953-54 campaign.</p>
          </div>
        </div>
      `,
    });

    expect(suggestion).toMatchObject({
      foundPage: true,
      matchedClubPage: false,
      eraMatched: false,
      suggestedReason: null,
      evidenceYears: [1953],
    });
  });

  test('keeps active lower-tier suggestions even when tracked era ended earlier', () => {
    const suggestion = suggestClubStatusReasonFromWikipediaHtml({
      club: {
        canonicalName: 'Example Town',
        status: {
          trackedToSeason: 1892,
        },
      },
      pageUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.',
      html: `
        <h1 id="firstHeading">Example Town F.C.</h1>
        <div id="mw-content-text">
          <div class="mw-parser-output">
            <p><b>Example Town F.C.</b> is a football club based in Example.</p>
            <table class="infobox">
              <tr><th>Current league</th><td>Northern League</td></tr>
            </table>
          </div>
        </div>
      `,
    });

    expect(suggestion).toMatchObject({
      matchedClubPage: true,
      eraMatched: true,
      suggestedCurrent: 'active',
      suggestedReason: 'not-in-tracked-leagues',
      wikipediaCurrentLeague: 'Northern League',
      wikipediaCurrentLeagueLevel: 9,
    });
  });

  test('uses current infobox league to reject stale lifecycle text for active lower-tier clubs', () => {
    const suggestion = suggestClubStatusReasonFromWikipediaHtml({
      club: {
        canonicalName: 'Northwich Victoria',
        status: {
          trackedToSeason: 1893,
        },
      },
      pageUrl: 'https://en.wikipedia.org/wiki/Northwich_Victoria_F.C.',
      html: `
        <h1 id="firstHeading">Northwich Victoria F.C.</h1>
        <div id="mw-content-text">
          <div class="mw-parser-output">
            <p><b>Northwich Victoria F.C.</b> is a football club based in Northwich.</p>
            <p>The original club was founded in 1874 and amalgamated with Hartford and Davenham United in 1890.</p>
            <table class="infobox vcard">
              <tr><th>League</th><td>Midland League Premier Division</td></tr>
              <tr><th>2024-25</th><td>Midland League Premier Division, 2nd of 18</td></tr>
            </table>
          </div>
        </div>
      `,
    });

    expect(suggestion).toMatchObject({
      foundPage: true,
      matchedClubPage: true,
      eraMatched: true,
      suggestedCurrent: 'active',
      suggestedReason: 'not-in-tracked-leagues',
      wikipediaCurrentLeague: 'Midland League Premier Division',
      wikipediaCurrentLeagueLevel: 9,
      wikipediaTrackingCoverageStatus: 'below-tracked-coverage',
      wikipediaLatestSeason: '2024-25',
      rejectedLifecycleSuggestion: {
        suggestedReason: 'merged',
        evidenceYears: expect.arrayContaining([1890]),
        evidenceSourceUrl: 'https://en.wikipedia.org/wiki/Northwich_Victoria_F.C.',
        evidenceSourceLabel: 'lead',
      },
    });
  });

  test('flags active clubs in tracked league levels as possible current data misses', () => {
    const suggestion = suggestClubStatusReasonFromWikipediaHtml({
      club: {
        canonicalName: 'Example Town',
        status: {
          trackedToSeason: 2021,
        },
      },
      pageUrl: 'https://en.wikipedia.org/wiki/Example_Town_F.C.',
      html: `
        <h1 id="firstHeading">Example Town F.C.</h1>
        <div id="mw-content-text">
          <div class="mw-parser-output">
            <p><b>Example Town F.C.</b> is a football club based in Example.</p>
            <table class="infobox vcard">
              <tr><th>League</th><td>National League North</td></tr>
              <tr><th>Season</th><td>2025-26</td></tr>
            </table>
          </div>
        </div>
      `,
    });

    expect(suggestion).toMatchObject({
      matchedClubPage: true,
      suggestedCurrent: 'active',
      suggestedReason: 'possibly-missing-from-current-data',
      wikipediaCurrentLeague: 'National League North',
      wikipediaCurrentLeagueLevel: 6,
      wikipediaTrackingCoverageStatus: 'tracked-sparse',
      wikipediaLatestSeason: '2025-26',
    });
  });

  test('falls back to Wikipedia search results when generated slugs do not match', async () => {
    const fetchHtml = jest.fn(async (slug) => {
      if (slug === 'Example_Town_F.C._(1890)') {
        return `
          <h1 id="firstHeading">Example Town F.C. (1890)</h1>
          <div id="mw-content-text">
            <div class="mw-parser-output">
              <p><b>Example Town F.C.</b> was an association football club based in Example.</p>
              <p>The club folded before the next season.</p>
            </div>
          </div>
        `;
      }
      throw new Error('missing page');
    });
    const fetchSearchTitles = jest.fn(async () => ['Example Town F.C. (1890)']);

    const suggestion = await suggestClubStatusReasonFromWikipedia(
      { canonicalName: 'Example Town' },
      {
        fetchHtml,
        fetchSearchTitles,
        delayMs: 0,
        maxCandidates: 8,
      }
    );

    expect(fetchSearchTitles).toHaveBeenCalledWith('Example Town football club', { limit: 5 });
    expect(suggestion).toMatchObject({
      matchedClubPage: true,
      pageTitle: 'Example Town F.C. (1890)',
      suggestedCurrent: 'defunct',
      suggestedReason: 'folded',
      searchResultTitles: ['Example Town F.C. (1890)'],
    });
  });
});

describe('writeClubMetadataSeedFile', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('writes a sidecar club metadata file from a FootballData input file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'club-metadata-seed-test-'));
    tmpDirs.push(tmpDir);

    const inputFile = path.join(tmpDir, 'all-seasons.json');
    const outputFile = path.join(tmpDir, 'club-metadata.json');

    fs.writeFileSync(
      inputFile,
      JSON.stringify({
        seasons: {
          2024: {
            tier1: {
              season: 2024,
              table: [{ team: 'Arsenal' }],
              promoted: [],
              relegated: [],
            },
          },
        },
      })
    );

    const result = writeClubMetadataSeedFile({
      input: inputFile,
      output: outputFile,
      cwd: process.cwd(),
    });

    const saved = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(result.clubCount).toBe(1);
    expect(saved.metadata.generator).toBe('club-metadata-seed');
    expect(saved.clubs.arsenal.derived.seasonsSeen).toEqual([2024]);
  });
});
