import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allowedExternalRelationshipTargets,
  clubMetadataFixtures,
} from './club-metadata.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const dataset = readJson(path.join(repoRoot, 'data-output', 'all-seasons.json'));
const clubMetadata = readJson(path.join(repoRoot, 'data', 'club-metadata.json'));
const clubMetadataReview = readJson(path.join(repoRoot, 'data', 'club-metadata-review.json'));
const clubHistoricalAudit = readJson(
  path.join(repoRoot, 'data', 'club-historical-reason-audit.json')
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectSeasonRows(datasetValue) {
  const rows = [];
  for (const [seasonKey, seasonRecord] of Object.entries(datasetValue?.seasons || {})) {
    for (const [tierKey, tierRecord] of Object.entries(seasonRecord || {})) {
      if (!tierKey.match(/^tier\d+$/)) continue;
      for (const row of getTableRows(tierRecord)) {
        rows.push({
          season: Number(seasonKey),
          tier: tierKey,
          team: row.team,
        });
      }
    }
  }
  return rows;
}

function getTableRows(tierRecord) {
  if (Array.isArray(tierRecord?.table) && tierRecord.table.length) return tierRecord.table;
  if (Array.isArray(tierRecord?.divisions)) {
    return tierRecord.divisions.flatMap((division) => getTableRows(division));
  }
  return [];
}

const seasonRows = collectSeasonRows(dataset);

function findClub(clubKey) {
  return clubMetadata.clubs?.[clubKey] || null;
}

function expectSourceUrl(sourceRefs, sourceUrl, context) {
  expect(Array.isArray(sourceRefs)).toBe(true);
  expect(sourceRefs.some((sourceRef) => sourceRef.sourceUrl === sourceUrl)).toBe(true);
  for (const sourceRef of sourceRefs) {
    expect(sourceRef).toEqual(
      expect.objectContaining({
        type: expect.any(String),
        sourceUrl: expect.stringMatching(/^https?:\/\//),
      })
    );
  }
  if (!sourceRefs.some((sourceRef) => sourceRef.sourceUrl === sourceUrl)) {
    throw new Error(`${context} missing source URL ${sourceUrl}`);
  }
}

function expectLifecycleEvent(club, expectedEvent) {
  const lifecycleEvents = club.history?.lifecycleEvents || [];
  const matchingEvent = lifecycleEvents.find((event) => {
    return Object.entries(expectedEvent).every(([key, expectedValue]) => {
      if (key === 'sourceUrls') return true;
      return event[key] === expectedValue;
    });
  });
  expect(matchingEvent).toBeDefined();
  for (const sourceUrl of expectedEvent.sourceUrls || []) {
    expectSourceUrl(
      matchingEvent.sourceRefs,
      sourceUrl,
      `${club.canonicalName} lifecycle ${expectedEvent.type}:${expectedEvent.season}`
    );
  }
}

function expectRelationship(club, expectedRelationship) {
  const relationships = club.derived?.relationships || [];
  const matchingRelationship = relationships.find((relationship) => {
    return Object.entries(expectedRelationship).every(([key, expectedValue]) => {
      if (key === 'sourceUrls') return true;
      return relationship[key] === expectedValue;
    });
  });
  expect(matchingRelationship).toBeDefined();
  for (const sourceUrl of expectedRelationship.sourceUrls || []) {
    expectSourceUrl(
      matchingRelationship.sourceRefs,
      sourceUrl,
      `${club.canonicalName} relationship ${expectedRelationship.relationship}:${expectedRelationship.clubKey}`
    );
  }
}

function expectObservedRow(expectedRow) {
  expect(
    seasonRows.some(
      (row) =>
        row.season === expectedRow.season &&
        row.tier === expectedRow.tier &&
        row.team === expectedRow.team
    )
  ).toBe(true);
}

describe('Club metadata integration', () => {
  test('generated review artifact tracks unresolved lower-tier clubs and historical audit stays clean', () => {
    expect(clubMetadataReview.issueCount).toBe(clubMetadataReview.issues.length);
    expect(clubMetadataReview.issueCounts).toEqual({
      'manual-status-review': 89,
    });
    expect(clubMetadataReview.issues.every((issue) => issue.type === 'manual-status-review')).toBe(
      true
    );
    expect(clubHistoricalAudit.issueCount).toBe(0);
    expect(clubHistoricalAudit.issues).toEqual([]);
  });

  test('fixture clubs match source-backed metadata expectations', () => {
    for (const fixture of clubMetadataFixtures) {
      const club = findClub(fixture.clubKey);
      expect(club).toBeDefined();
      expect(club.canonicalName).toBe(fixture.expected.canonicalName);

      expect(club.status).toMatchObject(fixture.expected.status);
      for (const sourceUrl of fixture.expected.sourceUrls || []) {
        expectSourceUrl(club.status.sourceRefs, sourceUrl, `${fixture.clubKey} status`);
      }

      for (const alias of fixture.expected.aliases || []) {
        expect(club.derived?.aliases || []).toContain(alias);
      }

      for (const event of fixture.expected.lifecycleEvents || []) {
        expectLifecycleEvent(club, event);
      }

      for (const relationship of fixture.expected.relationships || []) {
        expectRelationship(club, relationship);
      }

      for (const row of fixture.expected.observedRows || []) {
        expectObservedRow(row);
        expect(club.derived?.seasonsSeen || []).toContain(row.season);
        expect(club.derived?.tiersSeen || []).toContain(row.tier);
      }
    }
  });

  test('metadata artifact keeps cross-club invariants intact', () => {
    const clubIds = new Set();
    const duplicateClubIds = [];
    const unresolvedStatuses = [];
    const missingStatusSources = [];
    const missingLifecycleSources = [];
    const missingRelationshipSources = [];
    const missingRelationshipTargets = [];
    const allowedExternalTargets = new Set(allowedExternalRelationshipTargets);
    const reviewIssueClubKeys = new Set(
      (clubMetadataReview.issues || []).map((issue) => issue.clubKey)
    );

    for (const [clubKey, club] of Object.entries(clubMetadata.clubs || {})) {
      if (clubIds.has(club.clubId)) duplicateClubIds.push(club.clubId);
      clubIds.add(club.clubId);

      if (
        club.status?.reason === 'manual-review-required' ||
        club.status?.reason === 'below-tracked-coverage'
      ) {
        unresolvedStatuses.push(clubKey);
      }
      if (
        club.status?.reason &&
        !reviewIssueClubKeys.has(clubKey) &&
        !club.status?.sourceRefs?.length
      ) {
        missingStatusSources.push(clubKey);
      }

      for (const event of club.history?.lifecycleEvents || []) {
        expect(event.type).toEqual(expect.any(String));
        expect(event.season).toEqual(expect.any(Number));
        if (!event.sourceRefs?.length) {
          missingLifecycleSources.push(`${clubKey}:${event.type}:${event.season}`);
        }
      }

      for (const relationship of club.derived?.relationships || []) {
        expect(relationship.clubKey).toEqual(expect.any(String));
        expect(relationship.relationship).toEqual(expect.any(String));
        expect(relationship.direction).toEqual(expect.any(String));
        if (!relationship.sourceRefs?.length) {
          missingRelationshipSources.push(
            `${clubKey}:${relationship.relationship}:${relationship.clubKey}`
          );
        }
        if (
          !clubMetadata.clubs?.[relationship.clubKey] &&
          !allowedExternalTargets.has(relationship.clubKey)
        ) {
          missingRelationshipTargets.push(
            `${clubKey}:${relationship.relationship}:${relationship.clubKey}`
          );
        }
      }
    }

    expect(duplicateClubIds).toEqual([]);
    expect(unresolvedStatuses.sort((a, b) => a.localeCompare(b))).toEqual(
      [...reviewIssueClubKeys].sort((a, b) => a.localeCompare(b))
    );
    expect(missingStatusSources).toEqual([]);
    expect(missingLifecycleSources).toEqual([]);
    expect(missingRelationshipSources).toEqual([]);
    expect(missingRelationshipTargets).toEqual([]);
  });

  test('observed names in metadata map back to saved season rows', () => {
    const missingObservedRows = [];

    for (const [clubKey, club] of Object.entries(clubMetadata.clubs || {})) {
      for (const observedName of club.derived?.observedNames || []) {
        for (const season of observedName.seasonsSeen || []) {
          const rowExists = seasonRows.some((row) => {
            return (
              row.season === season &&
              row.team === observedName.rawName &&
              observedName.tiersSeen.includes(row.tier)
            );
          });
          if (!rowExists) {
            missingObservedRows.push(`${clubKey}:${observedName.rawName}:${season}`);
          }
        }
      }
    }

    expect(missingObservedRows).toEqual([]);
  });
});
