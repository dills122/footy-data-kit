const TEAM_NAME_CANONICAL_FORMS = {
  arsenal: 'arsenal',
  'woolwich arsenal': 'arsenal',
  birmingham: 'birmingham city',
  'birmingham city': 'birmingham city',
  'small heath': 'birmingham city',
  'small heath alliance': 'birmingham city',
  'brighton & hove albion': 'brighton and hove albion',
  'brighton and hove albion': 'brighton and hove albion',
  'bradford (park avenue)': 'bradford park avenue',
  'bradford park avenue': 'bradford park avenue',
  'dagenham & redbridge': 'dagenham and redbridge',
  'dagenham and redbridge': 'dagenham and redbridge',
  glossop: 'glossop',
  'glossop north end': 'glossop',
  'harrogate town': 'harrogate town',
  'harrogate town afc': 'harrogate town',
  'harrogate town a f c': 'harrogate town',
  qpr: 'queens park rangers',
  'queens park rangers': 'queens park rangers',
  'west brom': 'west bromwich albion',
  'west bromwich': 'west bromwich albion',
  wolves: 'wolverhampton wanderers',
  'sheffield united': 'sheffield united',
  wba: 'west bromwich albion',
  'wrexham a f c': 'wrexham',
  'wrexham afc': 'wrexham',
  'newport county': 'newport county',
  'leicester city': 'leicester city',
  'leicester fosse': 'leicester city',
  'manchester city': 'manchester city',
  ardwick: 'manchester city',
  'manchester united': 'manchester united',
  'newton heath': 'manchester united',
  'newton heath lyr': 'manchester united',
  'newton heath lyr fc': 'manchester united',
  'sheffield wednesday': 'sheffield wednesday',
  'the wednesday': 'sheffield wednesday',
};

function normalizeKey(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.'"]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\bfc\b/g, ' ')
    .replace(/\bafc\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeTeamName(value) {
  if (typeof value !== 'string') return value;
  const normalized = normalizeKey(value);
  return TEAM_NAME_CANONICAL_FORMS[normalized] || normalized;
}

export default {
  canonicalizeTeamName,
};
