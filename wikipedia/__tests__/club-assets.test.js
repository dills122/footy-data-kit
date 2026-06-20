import {
  buildClubAssetBundle,
  buildClubAssetReviewIssues,
  buildWikipediaArticleTitles,
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
  test('prefers specific club page titles before generic source pages', () => {
    const titles = buildWikipediaArticleTitles({
      canonicalName: 'Chester City',
      derived: {
        aliases: ['Chester City'],
        identitySources: [
          {
            type: 'former-efl-clubs-list',
            sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
          },
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Chester_City_F.C.',
          },
        ],
      },
    });

    expect(titles[0]).toBe('Chester City F.C.');
    expect(titles).toContain('List of former English Football League clubs');
  });

  test('builds common English club article title fallbacks', () => {
    expect(
      buildWikipediaArticleTitles({
        canonicalName: 'AFC Totton',
        derived: { aliases: ['AFC Totton'] },
      }).slice(0, 4)
    ).toEqual(['AFC Totton', 'A.F.C. Totton', 'AFC Totton F.C.', 'AFC Totton A.F.C.']);

    expect(
      buildWikipediaArticleTitles({
        canonicalName: 'Tranmere Rovers',
        derived: { aliases: ['Tranmere Rovers'] },
      })
    ).toContain('Tranmere Rovers F.C.');
  });

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
    expect(candidate.verification.reviewReasons).not.toContain('non-crest-filename');
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

  test('does not mark free non-crest page images as usable', () => {
    const candidate = classifyClubAssetCandidate(
      {
        assetId: 'wikipedia-pageimage-free:Example_FC_match.jpg',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikipedia-pageimage-free',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/example.jpg',
        fileTitle: 'File:Example FC match.jpg',
        license: {
          shortName: 'CC BY-SA 4.0',
          usageTerms: 'Creative Commons Attribution-Share Alike 4.0',
          copyrighted: true,
        },
      },
      exampleClub
    );

    expect(candidate.status).toBe('needs-review');
    expect(candidate.verification.reviewReasons).toContain('non-crest-filename');
  });

  test('dedupes equivalent file candidates after ranking', () => {
    const bundle = buildClubAssetBundle([
      {
        assetId: 'wikipedia-pageimage-free:Example_FC_crest.svg',
        kind: 'crest',
        status: 'usable',
        source: 'wikipedia-pageimage-free',
        imageUrl: 'https://upload.wikimedia.org/example.svg',
        fileTitle: 'File:Example FC crest.svg',
      },
      {
        assetId: 'wikipedia-pageimage-any:Example_FC_crest.svg',
        kind: 'crest',
        status: 'usable',
        source: 'wikipedia-pageimage-any',
        imageUrl: 'https://upload.wikimedia.org/example.svg',
        fileTitle: 'File:Example FC crest.svg',
      },
    ]);

    expect(bundle.candidates).toHaveLength(1);
    expect(bundle.candidates[0].assetId).toBe('wikipedia-pageimage-free:Example_FC_crest.svg');
  });

  test('builds manual review issues for missing and uncertain assets', () => {
    expect(buildClubAssetReviewIssues('example fc', exampleClub, { status: 'missing' })).toEqual([
      expect.objectContaining({
        type: 'club-asset-missing',
        clubKey: 'example fc',
      }),
    ]);

    const singleCandidateIssues = buildClubAssetReviewIssues('example fc', exampleClub, {
      status: 'restricted',
      candidates: [
        {
          assetId: 'candidate',
          kind: 'crest',
          status: 'restricted',
          source: 'wikipedia-pageimage-any',
          verification: {
            reviewReasons: ['license-restricted'],
          },
        },
      ],
    });

    expect(singleCandidateIssues.map((issue) => issue.type)).toEqual([
      'club-asset-license-restricted',
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
        {
          assetId: 'candidate-2',
          kind: 'crest',
          status: 'needs-review',
          source: 'wikipedia-pageimage-free',
          verification: {
            reviewReasons: ['non-crest-filename'],
          },
        },
      ],
    });

    expect(issues.map((issue) => issue.type).sort()).toEqual([
      'club-asset-identity-uncertain',
      'club-asset-license-restricted',
      'club-asset-multiple-review-candidates',
      'club-asset-non-crest-candidate',
      'club-asset-non-crest-candidate',
    ]);
  });
});
