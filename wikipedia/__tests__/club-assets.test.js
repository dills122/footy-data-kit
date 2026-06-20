import {
  buildClubAssetBundle,
  buildClubAssetReviewIssues,
  classifyAssetLicense,
  classifyClubAssetCandidate,
} from '../data/assets/club-assets.js';

const exampleClub = {
  clubId: 'example-fc',
  canonicalName: 'Example FC',
  derived: {
    aliases: ['Example FC'],
  },
};

describe('club asset helpers', () => {
  test('classifies public-domain crest candidates as usable', () => {
    const candidate = classifyClubAssetCandidate(
      {
        assetId: 'wikipedia-pageimage-free:Example_FC_crest.svg',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikipedia-pageimage-free',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/en/example.svg',
        fileTitle: 'File:Example_FC_crest.svg',
        license: {
          shortName: 'PD',
          usageTerms: 'Public domain',
          copyrighted: false,
        },
      },
      exampleClub,
      { checkedAt: '2026-06-20T00:00:00.000Z' }
    );

    expect(candidate.status).toBe('usable');
    expect(candidate.verification).toMatchObject({
      identityMatch: 'strong',
      licenseCheck: 'pass',
      httpCheck: 'pass',
      needsManualReview: false,
    });
  });

  test('keeps fair-use candidates as restricted backup options', () => {
    expect(
      classifyAssetLicense({
        shortName: 'Fair use',
        usageTerms: 'Fair use of copyrighted material',
        copyrighted: true,
      })
    ).toBe('restricted');

    const candidate = classifyClubAssetCandidate(
      {
        assetId: 'wikipedia-pageimage-any:Example_FC_logo.svg',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikipedia-pageimage-any',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/en/example.svg',
        fileTitle: 'File:Example_FC_logo.svg',
        license: {
          shortName: 'Fair use',
          usageTerms: 'Fair use of copyrighted material',
          copyrighted: true,
        },
      },
      exampleClub
    );

    expect(candidate.status).toBe('restricted');
    expect(candidate.verification.reviewReasons).toContain('license-restricted');
  });

  test('ranks usable candidates before restricted and review candidates', () => {
    const bundle = buildClubAssetBundle([
      {
        assetId: 'restricted',
        kind: 'crest',
        status: 'restricted',
        source: 'wikipedia-pageimage-any',
        fileTitle: 'File:Example_FC_logo.svg',
      },
      {
        assetId: 'usable',
        kind: 'crest',
        status: 'usable',
        source: 'wikipedia-pageimage-free',
        fileTitle: 'File:Example_FC_crest.svg',
      },
      {
        assetId: 'review',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikipedia-pageimage-free',
        fileTitle: 'File:Example_photo.jpg',
      },
    ]);

    expect(bundle.preferred).toBe('usable');
    expect(bundle.status).toBe('usable');
    expect(bundle.candidates.map((candidate) => candidate.assetId)).toEqual([
      'usable',
      'restricted',
      'review',
    ]);
    expect(bundle.candidates.map((candidate) => candidate.priority)).toEqual([1, 2, 3]);
  });

  test('builds manual review issues for missing and uncertain assets', () => {
    expect(buildClubAssetReviewIssues('example fc', exampleClub, { status: 'missing' })).toEqual([
      expect.objectContaining({
        type: 'club-asset-missing',
        clubKey: 'example fc',
      }),
    ]);

    const issues = buildClubAssetReviewIssues('example fc', exampleClub, {
      status: 'restricted',
      candidates: [
        {
          assetId: 'candidate',
          kind: 'crest',
          status: 'restricted',
          source: 'wikipedia-pageimage-any',
          verification: {
            reviewReasons: ['license-restricted', 'identity-uncertain', 'non-crest-filename'],
          },
        },
      ],
    });

    expect(issues.map((issue) => issue.type).sort()).toEqual([
      'club-asset-identity-uncertain',
      'club-asset-license-restricted',
      'club-asset-multiple-review-candidates',
      'club-asset-non-crest-candidate',
    ]);
  });
});
