// Tuples record the division key, row count, champion, points and bottom club
// from the competition tables. "national" identifies the single tier-five table.
export const lowerTierFixtures = [
  {
    year: 1979,
    tables: [
      ['national', 20, 'Altrincham', 56, 'Redditch United'],
      ['northern-premier', 22, 'Mossley', 65, 'Tamworth'],
      ['southern-midland', 22, 'Bridgend Town', 62, 'Corby Town'],
      ['southern-southern', 24, 'Dorchester Town', 62, 'Tonbridge Angels'],
      ['isthmian-premier', 22, 'Enfield', 84, 'Tilbury'],
    ],
    promoted: { 'southern-midland': [], 'southern-southern': [] },
  },
  {
    year: 1980,
    tables: [
      ['national', 20, 'Altrincham', 54, 'Bangor City'],
      ['northern-premier', 22, 'Runcorn', 71, 'Tamworth'],
      ['southern-midland', 22, 'Alvechurch', 61, 'Milton Keynes City'],
      ['southern-southern', 24, 'Dartford', 66, 'Andover'],
      ['isthmian-premier', 22, 'Slough Town', 82, 'Woking'],
    ],
    promoted: { 'southern-midland': ['Trowbridge Town'], 'southern-southern': ['Dartford'] },
  },
  {
    year: 1981,
    tables: [
      ['national', 22, 'Runcorn', 93, 'AP Leamington'],
      ['northern-premier', 22, 'Bangor City', 62, 'Netherfield'],
      ['southern-midland', 22, 'Nuneaton Borough', 65, 'Redditch United'],
      ['southern-southern', 24, 'Wealdstone', 72, 'Thanet United'],
      ['isthmian-premier', 22, 'Leytonstone & Ilford', 83, 'Boreham Wood'],
    ],
    promoted: { 'southern-midland': ['Nuneaton Borough'], 'southern-southern': ['Wealdstone'] },
    rows: [
      ['southern-midland', { team: 'Bedford Town', outcomeStatus: 'folded' }],
      ['southern-southern', { team: 'Thanet United', wasRelegated: true }],
    ],
  },
  {
    year: 1982,
    tables: [
      ['national', 22, 'Enfield', 84, 'Stafford Rangers'],
      ['northern-premier', 22, 'Gateshead', 100, 'Netherfield'],
      ['southern-premier', 20, 'AP Leamington', 79, 'Addlestone & Weybridge Town'],
      ['isthmian-premier', 22, 'Wycombe Wanderers', 85, 'Leatherhead'],
    ],
    promoted: { 'southern-premier': ['Kidderminster Harriers'] },
    rows: [['southern-premier', { team: 'AP Leamington', wasPromoted: false }]],
  },
  {
    year: 2003,
    compareConferenceIntake: true,
    tables: [
      ['national', 22, 'Chester City', 92, 'Northwich Victoria'],
      ['northern-premier', 23, 'Hucknall Town', 95, 'Wakefield & Emley'],
      ['southern-premier', 22, 'Crawley Town', 84, 'Grantham Town'],
      ['isthmian-premier', 24, 'Canvey Island', 104, 'Aylesbury United'],
    ],
    promoted: {
      national: ['Chester City', 'Shrewsbury Town'],
      'northern-premier': [],
      'southern-premier': ['Crawley Town'],
      'isthmian-premier': ['Canvey Island'],
    },
    rows: [
      ['national', { team: 'Northwich Victoria', wasReprieved: true, outcomeStatus: 'reprieved' }],
      ['northern-premier', { team: 'Hucknall Town', notes: 'Promotion to Conference North' }],
      ['southern-premier', { team: 'Weymouth', notes: 'Qualified for the Conference South' }],
      ['isthmian-premier', { team: 'Hendon', wasPromoted: false, outcomeStatus: null }],
    ],
  },
  {
    year: 2004,
    tables: [
      ['national', 22, 'Barnet', 86, 'Leigh RMI'],
      ['north', 22, 'Southport', 84, 'Bradford (Park Avenue)'],
      ['south', 22, 'Grays Athletic', 98, 'Redbridge'],
    ],
    promoted: {
      national: ['Barnet', 'Carlisle United'],
      north: ['Southport', 'Altrincham'],
      south: ['Grays Athletic'],
    },
    rows: [
      ['national', { team: 'Crawley Town' }],
      ['national', { team: 'Canvey Island' }],
      ['national', { team: 'Forest Green Rovers', wasReprieved: true, outcomeStatus: 'reprieved' }],
      ['north', { team: 'Hucknall Town' }],
      ['south', { team: 'Weymouth' }],
      ['south', { team: 'Eastbourne Borough', wasPromoted: false }],
      ['south', { team: 'Maidenhead United', wasReprieved: true, outcomeStatus: 'reprieved' }],
    ],
  },
  {
    year: 2014,
    sourceSlug: '2014–15_Football_Conference',
    titles: ['Conference Premier', 'Conference North', 'Conference South'],
    tables: [
      ['national', 24, 'Barnet', 92, 'Nuneaton Town'],
      ['north', 22, 'Barrow', 87, 'Hyde'],
      ['south', 21, 'Bromley', 77, 'Staines Town'],
    ],
    promoted: {
      national: ['Barnet', 'Bristol Rovers'],
      north: ['Barrow', 'Guiseley'],
      south: ['Bromley', 'Boreham Wood'],
    },
    relegated: {
      national: ['Alfreton Town', 'Dartford', 'AFC Telford United', 'Nuneaton Town'],
      north: ['Colwyn Bay', 'Leamington', 'Hyde'],
      south: ['Farnborough', 'Staines Town'],
    },
    rows: [
      ['south', { team: 'Boreham Wood', pos: 2, points: 75, wasPromoted: true }],
      ['south', { team: 'Hayes & Yeading United', pos: 19, wasRelegated: false }],
      ['south', { team: 'Staines Town', pos: 21, points: 25, wasRelegated: true }],
    ],
    southSchedule: { played: 40, absentClub: 'Salisbury City' },
  },
  {
    year: 2015,
    sourceSlug: '2015–16_National_League',
    titles: ['National League', 'National League North', 'National League South'],
    tables: [
      ['national', 24, 'Cheltenham Town', 101, 'Welling United'],
      ['north', 22, 'Solihull Moors', 85, 'Corby Town'],
      ['south', 22, 'Sutton United', 90, 'Basingstoke Town'],
    ],
    promoted: {
      national: ['Cheltenham Town', 'Grimsby Town'],
      north: ['Solihull Moors', 'North Ferriby United'],
      south: ['Sutton United', 'Maidstone United'],
    },
    relegated: {
      national: ['FC Halifax Town', 'Altrincham', 'Kidderminster Harriers', 'Welling United'],
      north: ['Lowestoft Town', 'Hednesford Town', 'Corby Town'],
      south: ['Havant & Waterlooville', 'Hayes & Yeading United', 'Basingstoke Town'],
    },
    rows: [
      ['national', { team: 'Bromley' }],
      ['national', { team: 'Boreham Wood' }],
      ['south', { team: 'Basingstoke Town', pos: 22, points: 38, wasRelegated: true }],
    ],
    southSchedule: { played: 42 },
  },
  {
    year: 2025,
    tables: [
      ['national', 24, 'York City', 108, 'Truro City'],
      ['north', 24, 'AFC Fylde', 100, 'Leamington'],
      ['south', 24, 'Worthing', 84, 'Eastbourne Borough'],
    ],
    promoted: {
      national: ['York City', 'Rochdale'],
      north: ['AFC Fylde', 'Kidderminster Harriers'],
      south: ['Worthing', 'Hornchurch'],
    },
    relegated: {
      national: ['Brackley Town', 'Morecambe', 'Braintree Town', 'Truro City'],
      north: ['Curzon Ashton', 'Alfreton Town', 'Peterborough Sports', 'Leamington'],
      south: ['Bath City', 'Chippenham Town', 'Enfield Town', 'Eastbourne Borough'],
    },
  },
];
