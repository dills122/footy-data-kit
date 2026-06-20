import {
  buildOverviewSeasonSlug,
  buildWikipediaCompetitionSeasonSlug,
  getWikipediaLowerTierCompetitionSourceForSlug,
  getWikipediaLowerTierCompetitionSourceSlugs,
} from '../config.js';

describe('wikipedia config', () => {
  test('builds overview and competition season slugs with the same season prefix', () => {
    expect(buildOverviewSeasonSlug(2012)).toBe('2012–13_in_English_football');
    expect(buildWikipediaCompetitionSeasonSlug(2012, 'Football_Conference')).toBe(
      '2012–13_Football_Conference'
    );
  });

  test('selects lower-tier competition source slugs by historical era', () => {
    expect(getWikipediaLowerTierCompetitionSourceSlugs(1979)).toEqual([
      '1979–80_Alliance_Premier_League',
    ]);
    expect(getWikipediaLowerTierCompetitionSourceSlugs(2004)).toEqual([
      '2004–05_Football_Conference',
    ]);
    expect(getWikipediaLowerTierCompetitionSourceSlugs(2012)).toEqual([
      '2012–13_Football_Conference',
    ]);
    expect(getWikipediaLowerTierCompetitionSourceSlugs(2015)).toEqual(['2015–16_National_League']);
  });

  test('returns no lower-tier source slugs before national tier five begins', () => {
    expect(getWikipediaLowerTierCompetitionSourceSlugs(1978)).toEqual([]);
  });

  test('looks up lower-tier competition source profiles by slug', () => {
    expect(
      getWikipediaLowerTierCompetitionSourceForSlug('1979–80_Alliance_Premier_League')
    ).toMatchObject({
      key: 'alliance-premier-league',
      title: 'Alliance Premier League',
    });
    expect(getWikipediaLowerTierCompetitionSourceForSlug('1900–01_in_English_football')).toBeNull();
  });
});
