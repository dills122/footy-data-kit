// @ts-check
/**
 * @typedef {import('./config.model.ts').TestPages} TestPages
 */

//NOTE: Can only run the promotion/build parser till the 1991-92 season,

// Manual configuration describing a handful of historical Wikipedia seasons
// so that integration tests can assert we parsed key promotion/relegation data
// correctly. See `config.model.ts` for the shape of each entry.
export const testPages = /** @type {TestPages} */ ([
  {
    url: 'https://en.wikipedia.org/wiki/1898-99_Football_League',
    season: '1898',
    source: 'promotion',
    tests: {
      promoted: ['Manchester City', 'Glossop North End'],
      relegated: ['Bolton Wanderers', 'The Wednesday'],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/1905-06_Football_League',
    season: '1905',
    source: 'promotion',
    tests: {
      promoted: ['Bristol City', 'Manchester United'],
      relegated: ['Nottingham Forest', 'Wolverhampton Wanderers'],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/1925-26_Football_League',
    season: '1925',
    source: 'promotion',
    tests: {
      promoted: ['The Wednesday', 'Derby County'],
      relegated: ['Manchester City', 'Notts County'],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/1950-51_Football_League',
    season: '1950',
    source: 'promotion',
    tests: {
      promoted: ['Preston North End', 'Manchester City'],
      relegated: ['Sheffield Wednesday', 'Everton'],
      tableEntries: [
        {
          tier: 'tier2',
          data: {
            team: 'Preston North End',
            wasPromoted: true,
            points: 57,
            won: 26,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Everton',
            wasRelegated: true,
            points: 32,
          },
        },
      ],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/1967-68_Football_League',
    season: '1967',
    source: 'promotion',
    tests: {
      promoted: ['Ipswich Town', 'Queens Park Rangers'],
      relegated: ['Sheffield United', 'Fulham'],
      tableEntries: [
        {
          tier: 'tier2',
          data: {
            team: 'Ipswich Town',
            wasPromoted: true,
            won: 22,
            points: 59,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Sheffield United',
            wasRelegated: true,
            points: 32,
          },
        },
      ],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/1979-80_Football_League',
    season: '1979',
    source: 'promotion',
    tests: {
      promoted: ['Leicester City', 'Sunderland', 'Birmingham City'],
      relegated: ['Bristol City', 'Derby County', 'Bolton Wanderers'],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/1986-87_Football_League',
    season: '1986',
    source: 'promotion',
    tests: {
      promoted: ['Derby County', 'Portsmouth'],
      relegated: ['Leicester City', 'Manchester City', 'Aston Villa'],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/1993%E2%80%9394_in_English_football',
    season: '1993',
    source: 'overview',
    tests: {
      promoted: ['Leicester City', 'Crystal Palace', 'Nottingham Forest'],
      relegated: ['Swindon Town', 'Sheffield United', 'Oldham Athletic'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Leeds United',
            wasPromoted: false,
            points: 70,
            won: 18,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Oldham Athletic',
            wasPromoted: false,
            wasRelegated: true,
            points: 40,
            won: 9,
            goalDifference: -26,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Grimsby Town',
            wasPromoted: false,
            wasRelegated: false,
            points: 59,
          },
        },
      ],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/2003%E2%80%9304_in_English_football',
    season: '2003',
    source: 'overview',
    tests: {
      promoted: ['Norwich City', 'West Bromwich Albion', 'Crystal Palace'],
      relegated: ['Leicester City', 'Leeds United', 'Wolverhampton Wanderers'],
      tableEntries: [
        {
          tier: 'tier2',
          data: {
            team: 'Sunderland',
            wasPromoted: false,
            points: 79,
            goalsFor: 62,
            goalDifference: 17,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Fulham',
            wasRelegated: false,
            wasPromoted: false,
            lost: 14,
            points: 52,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Chelsea',
            wasRelegated: false,
            wasPromoted: false,
            won: 24,
            points: 79,
          },
        },
      ],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/2005%E2%80%9306_in_English_football',
    season: '2005',
    source: 'overview',
    tests: {
      promoted: ['Reading', 'Sheffield United', 'Watford'],
      relegated: ['Sunderland', 'West Bromwich Albion', 'Birmingham City'],
      tableEntries: [
        {
          tier: 'tier2',
          data: {
            team: 'Watford',
            wasPromoted: true,
            points: 81,
            won: 22,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Manchester United',
            wasRelegated: false,
            wasPromoted: false,
            points: 83,
            goalDifference: 38,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Sunderland',
            wasRelegated: true,
            wasPromoted: false,
            points: 15,
            goalDifference: -43,
          },
        },
      ],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/2010%E2%80%9311_in_English_football',
    season: '2010',
    source: 'overview',
    tests: {
      promoted: ['Queens Park Rangers', 'Norwich City', 'Swansea City'],
      relegated: ['Blackpool', 'West Ham United', 'Birmingham City'],
      tableEntries: [
        {
          tier: 'tier2',
          data: {
            team: 'Cardiff City',
            wasPromoted: false,
            points: 80,
            won: 23,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Manchester United',
            wasRelegated: false,
            wasPromoted: false,
            points: 80,
            goalDifference: 41,
          },
        },
      ],
    },
  },
  {
    url: 'https://en.wikipedia.org/wiki/2018%E2%80%9319_in_English_football',
    season: '2018',
    source: 'overview',
    tests: {
      promoted: ['Norwich City', 'Sheffield United', 'Aston Villa'],
      relegated: ['Cardiff City', 'Fulham', 'Huddersfield Town'],
    },
  },
]);

export default testPages;
