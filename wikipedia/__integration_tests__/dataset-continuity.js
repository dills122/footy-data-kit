import { isWikipediaWarSuspensionYear } from '../config.js';

function getTierEntriesFromRecord(seasonRecord) {
  const tierEntries = [];
  for (const [tierKey, tierRecord] of Object.entries(seasonRecord || {})) {
    if (tierKey === 'seasonInfo') continue;
    if (!tierKey.match(/^tier\d+$/)) continue;
    if (!tierRecord || typeof tierRecord !== 'object') continue;
    if (!Array.isArray(tierRecord.table)) continue;
    tierEntries.push([tierKey, tierRecord]);
  }
  return tierEntries;
}

export function isPlaceholderSeasonRecord(seasonRecord) {
  const seasonInfo = seasonRecord?.seasonInfo;
  return (
    Boolean(seasonInfo?.competitionStatus) && getTierEntriesFromRecord(seasonRecord).length === 0
  );
}

export function findNextComparableSeasonRecord(dataset, season) {
  const seasonYear = Number(season);
  if (!Number.isInteger(seasonYear)) {
    return { season: null, record: null };
  }

  const availableSeasons = Object.keys(dataset?.seasons || {})
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
  const maxSeason = availableSeasons.length ? Math.max(...availableSeasons) : seasonYear;

  for (let candidate = seasonYear + 1; candidate <= maxSeason + 1; candidate += 1) {
    const candidateRecord = dataset?.seasons?.[String(candidate)] || null;

    if (!candidateRecord) {
      if (isWikipediaWarSuspensionYear(candidate)) {
        continue;
      }
      return { season: candidate, record: null };
    }

    if (isPlaceholderSeasonRecord(candidateRecord)) {
      continue;
    }

    return { season: candidate, record: candidateRecord };
  }

  return { season: null, record: null };
}

export default {
  findNextComparableSeasonRecord,
  isPlaceholderSeasonRecord,
};
