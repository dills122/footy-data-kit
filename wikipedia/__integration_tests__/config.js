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
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1888%E2%80%9389_in_English_football',
    },
    season: '1888',
    source: 'overview',
    tests: {
      promoted: [],
      relegated: [],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Preston North End',
            wasPromoted: false,
            wasRelegated: false,
            points: 40,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1889%E2%80%9390_in_English_football',
    },
    season: '1889',
    source: 'overview',
    tests: {
      promoted: [],
      relegated: ['Stoke'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Preston North End',
            wasPromoted: false,
            wasRelegated: false,
            points: 33,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Stoke',
            wasPromoted: false,
            wasRelegated: true,
            points: 10,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1890%E2%80%9391_in_English_football',
    },
    season: '1890',
    source: 'overview',
    tests: {
      promoted: ['Stoke', 'Darwen'],
      relegated: [],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Everton',
            wasPromoted: false,
            wasRelegated: false,
            points: 29,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Stoke',
            wasPromoted: false,
            wasRelegated: false,
            points: 33,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Darwen',
            wasPromoted: false,
            wasRelegated: false,
            points: 23,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1891%E2%80%9392_in_English_football',
    },
    season: '1891',
    source: 'overview',
    tests: {
      promoted: ['Nottingham Forest', 'Newton Heath', 'The Wednesday'],
      relegated: ['Darwen'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Sunderland',
            wasPromoted: false,
            wasRelegated: false,
            points: 42,
          },
        },
        {
          tier: 'tier1',
          data: {
            team: 'Darwen',
            wasPromoted: false,
            wasRelegated: true,
            points: 11,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Nottingham Forest',
            wasPromoted: true,
            wasRelegated: false,
            points: 33,
          },
        },
      ],
    },
  },
  {
    urls: {
      promotion: 'https://en.wikipedia.org/wiki/1898-99_Football_League',
      overview: 'https://en.wikipedia.org/wiki/1898%E2%80%9399_in_English_football',
    },
    season: '1898',
    source: 'both',
    tests: {
      promoted: ['Manchester City', 'Glossop North End'],
      relegated: ['Bolton Wanderers', 'The Wednesday'],
    },
  },
  {
    urls: {
      promotion: 'https://en.wikipedia.org/wiki/1905-06_Football_League',
      overview: 'https://en.wikipedia.org/wiki/1905%E2%80%9306_in_English_football',
    },
    season: '1905',
    source: 'both',
    tests: {
      promoted: ['Bristol City', 'Manchester United'],
      relegated: ['Nottingham Forest', 'Wolverhampton Wanderers'],
    },
  },
  {
    urls: {
      promotion: 'https://en.wikipedia.org/wiki/1919-20_Football_League',
      overview: 'https://en.wikipedia.org/wiki/1919%E2%80%9320_in_English_football',
    },
    season: '1919',
    source: 'both',
    tests: {
      promoted: ['Tottenham Hotspur', 'Huddersfield Town'],
      relegated: ['Notts County', 'The Wednesday'],
      tableEntries: [
        {
          tier: 'tier2',
          data: {
            team: 'Tottenham Hotspur',
            wasPromoted: true,
            points: 70,
            won: 32,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Birmingham',
            wasPromoted: false,
            points: 56,
          },
        },
      ],
    },
  },
  {
    urls: {
      promotion: 'https://en.wikipedia.org/wiki/1925-26_Football_League',
      overview: 'https://en.wikipedia.org/wiki/1925%E2%80%9326_in_English_football',
    },
    season: '1925',
    source: 'both',
    tests: {
      promoted: ['The Wednesday', 'Derby County'],
      relegated: ['Manchester City', 'Notts County'],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1946%E2%80%9347_in_English_football',
    },
    season: '1946',
    source: 'overview',
    tests: {
      promoted: ['Manchester City', 'Burnley'],
      relegated: ['Brentford', 'Leeds United'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Liverpool',
            wasPromoted: false,
            wasRelegated: false,
            points: 57,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Manchester City',
            wasPromoted: true,
            points: 62,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1947%E2%80%9348_in_English_football',
    },
    season: '1947',
    source: 'overview',
    tests: {
      promoted: ['Birmingham City', 'Newcastle United'],
      relegated: ['Blackburn Rovers', 'Grimsby Town'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Arsenal',
            wasPromoted: false,
            wasRelegated: false,
            points: 59,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Birmingham City',
            wasPromoted: true,
            points: 59,
          },
        },
      ],
    },
  },
  {
    urls: {
      promotion: 'https://en.wikipedia.org/wiki/1950-51_Football_League',
      overview: 'https://en.wikipedia.org/wiki/1950%E2%80%9351_in_English_football',
    },
    season: '1950',
    source: 'both',
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
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1955%E2%80%9356_in_English_football',
    },
    season: '1955',
    source: 'overview',
    tests: {
      promoted: ['Sheffield Wednesday', 'Leeds United'],
      relegated: ['Huddersfield Town', 'Sheffield United'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Manchester United',
            wasPromoted: false,
            wasRelegated: false,
            points: 60,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Sheffield Wednesday',
            wasPromoted: true,
            points: 55,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1957%E2%80%9358_in_English_football',
    },
    season: '1957',
    source: 'overview',
    tests: {
      promoted: ['West Ham United', 'Blackburn Rovers'],
      relegated: ['Sunderland', 'Sheffield Wednesday'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Wolverhampton Wanderers',
            wasPromoted: false,
            wasRelegated: false,
            points: 64,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'West Ham United',
            wasPromoted: true,
            points: 57,
          },
        },
        {
          tier: 'tier3',
          data: {
            team: 'Scunthorpe & Lindsey United',
            wasPromoted: true,
            points: 66,
          },
        },
        {
          tier: 'tier4',
          data: {
            team: 'Brighton & Hove Albion',
            wasPromoted: true,
            points: 60,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1958%E2%80%9359_in_English_football',
    },
    season: '1958',
    source: 'overview',
    tests: {
      promoted: ['Sheffield Wednesday', 'Fulham'],
      relegated: ['Aston Villa', 'Portsmouth'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Wolverhampton Wanderers',
            wasPromoted: false,
            wasRelegated: false,
            points: 61,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Sheffield Wednesday',
            wasPromoted: true,
            points: 62,
          },
        },
      ],
    },
  },
  {
    urls: {
      promotion: 'https://en.wikipedia.org/wiki/1967-68_Football_League',
      overview: 'https://en.wikipedia.org/wiki/1967%E2%80%9368_in_English_football',
    },
    season: '1967',
    source: 'both',
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
    urls: {
      promotion: 'https://en.wikipedia.org/wiki/1979-80_Football_League',
      overview: 'https://en.wikipedia.org/wiki/1979%E2%80%9380_in_English_football',
    },
    season: '1979',
    source: 'both',
    tests: {
      promoted: ['Leicester City', 'Sunderland', 'Birmingham City'],
      relegated: ['Bristol City', 'Derby County', 'Bolton Wanderers'],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1970%E2%80%9371_in_English_football',
    },
    season: '1970',
    source: 'overview',
    tests: {
      promoted: ['Leicester City', 'Sheffield United'],
      relegated: ['Burnley', 'Blackpool'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Arsenal',
            wasPromoted: false,
            wasRelegated: false,
            points: 65,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Leicester City',
            wasPromoted: true,
            points: 59,
          },
        },
      ],
    },
  },
  {
    urls: {
      promotion: 'https://en.wikipedia.org/wiki/1986-87_Football_League',
      overview: 'https://en.wikipedia.org/wiki/1986%E2%80%9387_in_English_football',
    },
    season: '1986',
    source: 'both',
    tests: {
      promoted: ['Derby County', 'Portsmouth'],
      relegated: ['Leicester City', 'Manchester City', 'Aston Villa'],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1987%E2%80%9388_in_English_football',
    },
    season: '1987',
    source: 'overview',
    tests: {
      promoted: ['Millwall', 'Aston Villa', 'Middlesbrough'],
      relegated: ['Portsmouth', 'Watford', 'Oxford United'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Liverpool',
            wasPromoted: false,
            wasRelegated: false,
            points: 90,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Millwall',
            wasPromoted: true,
            points: 82,
          },
        },
        {
          tier: 'tier4',
          data: {
            team: 'Wolverhampton Wanderers',
            wasPromoted: true,
            points: 90,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1989%E2%80%9390_in_English_football',
    },
    season: '1989',
    source: 'overview',
    tests: {
      promoted: ['Leeds United', 'Sheffield United', 'Sunderland'],
      relegated: ['Sheffield Wednesday', 'Charlton Athletic', 'Millwall'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Liverpool',
            wasPromoted: false,
            wasRelegated: false,
            points: 79,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Leeds United',
            wasPromoted: true,
            points: 85,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Swindon Town',
            wasPromoted: false,
            points: 74,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Sunderland',
            wasPromoted: true,
            points: 74,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1992%E2%80%9393_in_English_football',
    },
    season: '1992',
    source: 'overview',
    tests: {
      promoted: ['Newcastle United', 'West Ham United', 'Swindon Town'],
      relegated: ['Crystal Palace', 'Middlesbrough', 'Nottingham Forest'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Manchester United',
            wasPromoted: false,
            wasRelegated: false,
            points: 84,
            goalDifference: 36,
          },
        },
        {
          tier: 'tier2',
          data: {
            team: 'Newcastle United',
            wasPromoted: true,
            points: 96,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/1993%E2%80%9394_in_English_football',
    },
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
          tier: 'tier2',
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
    urls: {
      overview: 'https://en.wikipedia.org/wiki/2003%E2%80%9304_in_English_football',
    },
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
    urls: {
      overview: 'https://en.wikipedia.org/wiki/2005%E2%80%9306_in_English_football',
    },
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
    urls: {
      overview: 'https://en.wikipedia.org/wiki/2010%E2%80%9311_in_English_football',
    },
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
    urls: {
      overview: 'https://en.wikipedia.org/wiki/2013%E2%80%9314_in_English_football',
    },
    season: '2013',
    source: 'overview',
    tests: {
      promoted: ['Burnley', 'Leicester City', 'Queens Park Rangers'],
      relegated: ['Cardiff City', 'Fulham', 'Norwich City'],
    },
    tableEntries: [
      {
        tier: 'tier2',
        data: {
          team: 'Derby County',
          wasPromoted: false,
          points: 85,
          won: 25,
          drawn: 10,
        },
      },
      {
        tier: 'tier2',
        data: {
          team: 'Reading',
          wasPromoted: false,
          points: 71,
          won: 19,
          drawn: 14,
        },
      },
    ],
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/2016%E2%80%9317_in_English_football',
    },
    season: '2016',
    source: 'overview',
    tests: {
      promoted: ['Newcastle United', 'Brighton & Hove Albion', 'Huddersfield Town'],
      relegated: ['Hull City', 'Middlesbrough', 'Sunderland'],
      tableEntries: [
        {
          tier: 'tier1',
          data: {
            team: 'Chelsea',
            wasPromoted: false,
            wasRelegated: false,
            points: 93,
            goalDifference: 52,
          },
        },
        {
          tier: 'tier5',
          data: {
            team: 'Lincoln City',
            wasPromoted: true,
            points: 99,
          },
        },
      ],
    },
  },
  {
    urls: {
      overview: 'https://en.wikipedia.org/wiki/2018%E2%80%9319_in_English_football',
    },
    season: '2018',
    source: 'overview',
    tests: {
      promoted: ['Norwich City', 'Sheffield United', 'Aston Villa'],
      relegated: ['Cardiff City', 'Fulham', 'Huddersfield Town'],
    },
  },
]);

export default testPages;
