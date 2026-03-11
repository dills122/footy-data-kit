import { diffFootballData, renderMarkdownSummary } from '../data/compare-football-data.js';
import { canonicalizeTeamName } from '../data/data-quality-config.js';

describe('compare-football-data', () => {
  test('diffFootballData reports added, removed, and changed seasons with tier details', () => {
    const diff = diffFootballData(
      {
        seasons: {
          1900: {
            seasonInfo: {
              season: 1900,
              promoted: ['The Wednesday'],
              relegated: ['Burnley'],
              sourceUrl: 'https://before.example/1900',
            },
            tier1: {
              season: 1900,
              table: [
                {
                  pos: 1,
                  team: 'The Wednesday',
                  played: 34,
                  won: 20,
                  drawn: 8,
                  lost: 6,
                  goalsFor: 50,
                  goalsAgainst: 30,
                  goalDifference: 20,
                  goalAverage: null,
                  points: 48,
                  notes: null,
                  wasRelegated: false,
                  wasPromoted: false,
                  isExpansionTeam: false,
                  wasReElected: false,
                  wasReprieved: false,
                },
              ],
              promoted: ['The Wednesday'],
              relegated: [],
              metadata: {
                source: 'wikipedia-promotion',
                seasonSlug: '1899-00',
                tierKey: 'tier1',
              },
            },
          },
          1901: {
            seasonInfo: {
              season: 1901,
              promoted: ['Small Heath'],
              relegated: [],
            },
            tier1: {
              season: 1901,
              table: [],
              promoted: [],
              relegated: [],
              metadata: {
                source: 'wikipedia-promotion',
                seasonSlug: '1900-01',
                tierKey: 'tier1',
              },
            },
          },
        },
      },
      {
        seasons: {
          1900: {
            seasonInfo: {
              season: 1900,
              promoted: ['Sheffield Wednesday'],
              relegated: ['Glossop'],
              sourceUrl: 'https://after.example/1900',
            },
            tier1: {
              season: 1900,
              table: [
                {
                  pos: 2,
                  team: 'Sheffield Wednesday',
                  played: 34,
                  won: 19,
                  drawn: 8,
                  lost: 7,
                  goalsFor: 49,
                  goalsAgainst: 31,
                  goalDifference: 18,
                  goalAverage: null,
                  points: 46,
                  notes: 'Updated row',
                  wasRelegated: false,
                  wasPromoted: false,
                  isExpansionTeam: false,
                  wasReElected: false,
                  wasReprieved: false,
                },
                {
                  pos: 3,
                  team: 'Glossop North End',
                  played: 34,
                  won: 18,
                  drawn: 7,
                  lost: 9,
                  goalsFor: 40,
                  goalsAgainst: 33,
                  goalDifference: 7,
                  goalAverage: null,
                  points: 43,
                  notes: null,
                  wasRelegated: false,
                  wasPromoted: false,
                  isExpansionTeam: false,
                  wasReElected: false,
                  wasReprieved: false,
                },
              ],
              promoted: ['Sheffield Wednesday'],
              relegated: ['Glossop'],
              metadata: {
                source: 'wikipedia-overview',
                seasonSlug: '1899-00',
                tierKey: 'tier1',
                tableCount: 1,
              },
            },
            tier2: {
              season: 1900,
              table: [],
              promoted: ['Glossop'],
              relegated: [],
              metadata: {
                source: 'wikipedia-overview',
                seasonSlug: '1899-00',
                tierKey: 'tier2',
              },
            },
          },
          1902: {
            seasonInfo: {
              season: 1902,
              promoted: ['Ardwick'],
              relegated: [],
            },
            tier1: {
              season: 1902,
              table: [],
              promoted: ['Ardwick'],
              relegated: [],
              metadata: {
                source: 'wikipedia-overview',
                seasonSlug: '1901-02',
                tierKey: 'tier1',
              },
            },
          },
        },
      }
    );

    expect(diff.addedSeasons).toEqual(['1902']);
    expect(diff.removedSeasons).toEqual(['1901']);
    expect(diff.summary.changedSeasonCount).toBe(1);

    const season1900 = diff.changedSeasons[0];
    expect(season1900.season).toBe('1900');
    expect(season1900.addedTiers).toEqual(['tier2']);
    expect(season1900.removedTiers).toEqual([]);
    expect(season1900.seasonInfoChanges.promotedChanges).toEqual({
      added: [],
      removed: [],
    });
    expect(season1900.seasonInfoChanges.relegatedChanges).toEqual({
      added: ['Glossop'],
      removed: ['Burnley'],
    });

    const tier1 = season1900.changedTiers.find((entry) => entry.tierKey === 'tier1');
    expect(tier1.beforeRowCount).toBe(1);
    expect(tier1.afterRowCount).toBe(2);
    expect(tier1.addedTeams).toEqual(['Glossop North End']);
    expect(tier1.positionChanges).toEqual([
      {
        team: 'Sheffield Wednesday',
        before: 1,
        after: 2,
      },
    ]);
    expect(tier1.statChanges).toEqual([
      {
        team: 'Sheffield Wednesday',
        fields: [
          'pos',
          'won',
          'lost',
          'goalsFor',
          'goalsAgainst',
          'goalDifference',
          'points',
          'notes',
        ],
      },
    ]);
    expect(tier1.promotedChanges).toEqual({
      added: [],
      removed: [],
    });
    expect(tier1.relegatedChanges).toEqual({
      added: ['Glossop'],
      removed: [],
    });
    expect(tier1.metadataChangedFields).toEqual(['source', 'tableCount']);
  });

  test('canonicalizeTeamName collapses historical aliases and punctuation variants', () => {
    expect(canonicalizeTeamName('The Wednesday')).toBe('sheffield wednesday');
    expect(canonicalizeTeamName('Glossop North End')).toBe('glossop');
    expect(canonicalizeTeamName('Harrogate Town A.F.C.')).toBe('harrogate town');
    expect(canonicalizeTeamName('Dagenham & Redbridge')).toBe('dagenham and redbridge');
    expect(canonicalizeTeamName('Bradford (Park Avenue)')).toBe('bradford park avenue');
    expect(canonicalizeTeamName('Woolwich Arsenal')).toBe('arsenal');
    expect(canonicalizeTeamName('Ardwick')).toBe('manchester city');
    expect(canonicalizeTeamName('Small Heath')).toBe('birmingham city');
    expect(canonicalizeTeamName('QPR')).toBe('queens park rangers');
    expect(canonicalizeTeamName('Wolves')).toBe('wolverhampton wanderers');
    expect(canonicalizeTeamName('West Brom')).toBe('west bromwich albion');
    expect(canonicalizeTeamName('WBA')).toBe('west bromwich albion');
    expect(canonicalizeTeamName('Wrexham AFC')).toBe('wrexham');
  });

  test('renderMarkdownSummary produces a compact release-friendly summary', () => {
    const beforeDataset = {
      metadata: {
        generator: 'wikipedia-combined',
        generatedAt: '2026-03-01T00:00:00.000Z',
        gitSha: 'abc1234',
      },
      seasons: {
        1900: {
          seasonInfo: { season: 1900, table: [], promoted: [], relegated: [] },
          tier1: {
            season: 1900,
            table: [],
            promoted: [],
            relegated: [],
            metadata: { source: 'wikipedia-promotion', seasonSlug: '1899-00', tierKey: 'tier1' },
          },
        },
      },
    };
    const afterDataset = {
      metadata: {
        generator: 'wikipedia-combined',
        generatedAt: '2026-03-08T00:00:00.000Z',
        gitSha: 'def5678',
      },
      seasons: {
        1900: {
          seasonInfo: { season: 1900, table: [], promoted: ['Glossop'], relegated: [] },
          tier1: {
            season: 1900,
            table: [],
            promoted: [],
            relegated: [],
            metadata: { source: 'wikipedia-overview', seasonSlug: '1899-00', tierKey: 'tier1' },
          },
        },
        1901: {
          seasonInfo: { season: 1901, table: [], promoted: [], relegated: [] },
          tier1: {
            season: 1901,
            table: [],
            promoted: [],
            relegated: [],
            metadata: { source: 'wikipedia-overview', seasonSlug: '1900-01', tierKey: 'tier1' },
          },
        },
      },
    };

    const diff = diffFootballData(beforeDataset, afterDataset);
    const markdown = renderMarkdownSummary(diff, beforeDataset, afterDataset);

    expect(markdown).toContain('# Release Diff Summary');
    expect(markdown).toContain('- Previous gitSha: abc1234');
    expect(markdown).toContain('- Current gitSha: def5678');
    expect(markdown).toContain('- Added seasons: 1');
    expect(markdown).toContain('- 1900: changed tiers: 1 | season info: promoted list');
  });
});
