import {
  addGeneratedPlaceholderFallback,
  buildClubAssetBundle,
  buildGeneratedPlaceholderCrestCandidate,
  buildClubAssetReviewIssues,
  buildTheSportsDbAssetCandidates,
  buildTheSportsDbSearchNames,
  buildWikipediaArticleTitles,
  classifyAssetLicense,
  classifyClubAssetCandidate,
  isRejectedClubAssetCandidate,
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

  test('builds TheSportsDB search names from canonical name and aliases', () => {
    expect(
      buildTheSportsDbSearchNames({
        canonicalName: 'Derby County',
        derived: { aliases: ['Derby County F.C.', 'Derby County'] },
      })
    ).toEqual(['Derby County', 'Derby County F.C.']);
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

  test('accepts matching Wikidata coat-of-arms media as a historical crest candidate', () => {
    const candidate = classifyClubAssetCandidate(
      {
        assetId: 'wikidata-coat-of-arms:AberdareAthletic.jpg',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikidata-coat-of-arms',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/example.jpg',
        fileTitle: 'File:AberdareAthletic.jpg',
        license: {
          shortName: 'PD',
          usageTerms: 'Public domain',
          copyrighted: false,
        },
      },
      {
        clubId: 'aberdare-athletic',
        canonicalName: 'Aberdare Athletic',
        derived: {
          aliases: ['Aberdare Athletic F.C.'],
        },
      }
    );

    expect(candidate.status).toBe('usable');
    expect(candidate.verification.reviewReasons || []).not.toContain('non-crest-filename');
  });

  test('accepts the curated Leeds City historical arms crest candidate', () => {
    const candidate = classifyClubAssetCandidate(
      {
        assetId: 'wikipedia-pageimage-free:Leeds_old_arms.png',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikipedia-pageimage-free',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/en/9/9b/Leeds_old_arms.png',
        fileTitle: 'File:Leeds old arms.png',
        license: {
          shortName: 'PD',
          usageTerms: 'Public domain',
          copyrighted: false,
        },
      },
      {
        clubId: 'leeds-city',
        canonicalName: 'Leeds City',
        derived: {
          aliases: ['Leeds City F.C.'],
        },
      }
    );

    expect(candidate.status).toBe('usable');
    expect(candidate.notes).toContain('Leeds City historical crest/arms');
    expect(candidate.verification).toMatchObject({
      identityMatch: 'curated',
      needsManualReview: false,
    });
    expect(candidate.verification.reviewReasons || []).toEqual([]);
  });

  test('preserves manually quality-flagged crest candidates for replacement review', () => {
    const candidate = classifyClubAssetCandidate(
      {
        assetId: 'wikipedia-pageimage-any:Derby_County_crest.svg',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikipedia-pageimage-any',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/en/example.svg',
        fileTitle: 'File:Derby County crest.svg',
        license: {
          shortName: 'Fair use',
          usageTerms: 'Fair use of copyrighted material',
          copyrighted: true,
        },
      },
      {
        clubId: 'derby-county',
        canonicalName: 'Derby County',
      }
    );

    expect(candidate.status).toBe('restricted');
    expect(candidate.notes).toContain('poor readability');
    expect(candidate.verification.needsManualReview).toBe(true);
    expect(candidate.verification.reviewReasons).toEqual(
      expect.arrayContaining(['license-restricted', 'image-quality-review'])
    );

    const afcCandidate = classifyClubAssetCandidate(
      {
        assetId: 'wikipedia-pageimage-any:AFC_Telford_United_logo.svg',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikipedia-pageimage-any',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/en/example.svg',
        fileTitle: 'File:AFC Telford United logo.svg',
        license: {
          shortName: 'Fair use',
          usageTerms: 'Fair use of copyrighted material',
          copyrighted: true,
        },
      },
      {
        clubId: 'afc-telford-united',
        canonicalName: 'AFC Telford United',
      }
    );

    expect(afcCandidate.verification.reviewReasons).toContain('image-quality-review');
  });

  test('builds and classifies exact TheSportsDB badge candidates as restricted backups', () => {
    const [badgeCandidate, logoCandidate] = buildTheSportsDbAssetCandidates({
      idTeam: '133627',
      strTeam: 'Derby County',
      strTeamAlternate: 'Derby County Football Club',
      strSport: 'Soccer',
      strBadge: 'https://r2.thesportsdb.com/images/media/team/badge/example.png',
      strLogo: 'https://r2.thesportsdb.com/images/media/team/logo/example.png',
      strColour1: '#FFFFFF',
      strColour2: '#000000',
    });

    expect(badgeCandidate).toMatchObject({
      assetId: 'thesportsdb-badge:133627',
      kind: 'crest',
      source: 'thesportsdb-badge',
      fileTitle: 'TheSportsDB:Derby County badge',
      colors: [
        { role: 'primary', hex: '#FFFFFF' },
        { role: 'secondary', hex: '#000000' },
      ],
    });
    expect(logoCandidate.source).toBe('thesportsdb-logo');

    const classified = classifyClubAssetCandidate(badgeCandidate, {
      clubId: 'derby-county',
      canonicalName: 'Derby County',
      derived: { aliases: ['Derby County F.C.'] },
    });

    expect(classified.status).toBe('restricted');
    expect(classified.verification).toMatchObject({
      identityMatch: 'strong',
      licenseCheck: 'restricted',
      httpCheck: 'pass',
      needsManualReview: true,
    });
    expect(classified.verification.reviewReasons).toEqual(['license-restricted']);
  });

  test('keeps successor-style TheSportsDB matches under identity review', () => {
    const [candidate] = buildTheSportsDbAssetCandidates({
      idTeam: '134356',
      strTeam: 'Dagenham and Redbridge',
      strSport: 'Soccer',
      strBadge: 'https://r2.thesportsdb.com/images/media/team/badge/example.png',
    });

    const classified = classifyClubAssetCandidate(candidate, {
      clubId: 'dagenham',
      canonicalName: 'Dagenham',
    });

    expect(classified.status).toBe('restricted');
    expect(classified.verification.identityMatch).toBe('none');
    expect(classified.verification.reviewReasons).toEqual(
      expect.arrayContaining(['license-restricted', 'identity-uncertain'])
    );
  });

  test('ignores non-soccer TheSportsDB teams', () => {
    expect(
      buildTheSportsDbAssetCandidates({
        idTeam: '136592',
        strTeam: 'Team Bath',
        strSport: 'Netball',
        strBadge: 'https://r2.thesportsdb.com/images/media/team/badge/example.png',
      })
    ).toEqual([]);
  });

  test('does not trust generic Wikidata images without crest signals', () => {
    const candidate = classifyClubAssetCandidate(
      {
        assetId: 'wikidata-image:Example_FC_ground.jpg',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikidata-image',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/example.jpg',
        fileTitle: 'File:Example FC ground.jpg',
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

  test('recognizes curated rejected non-crest image candidates', () => {
    expect(
      isRejectedClubAssetCandidate({
        assetId: 'wikipedia-pageimage-free:Crown_Ground_sign-geograph-1761360.jpg',
      })
    ).toBe(true);
    expect(
      isRejectedClubAssetCandidate({
        assetId: 'wikidata-image:Man united vs derby.jpg',
      })
    ).toBe(true);
    expect(
      isRejectedClubAssetCandidate({
        assetId: 'wikipedia-pageimage-free:Example_FC_crest.svg',
      })
    ).toBe(false);
  });

  test('does not trust Wikidata logo properties without crest filename evidence', () => {
    const candidate = classifyClubAssetCandidate(
      {
        assetId: 'wikidata-logo:Example_FC_ground.jpg',
        kind: 'crest',
        status: 'needs-review',
        source: 'wikidata-logo',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/example.jpg',
        fileTitle: 'File:Example FC ground.jpg',
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

  test('builds generated placeholder crest candidates for curated historical clubs', () => {
    const candidate = buildGeneratedPlaceholderCrestCandidate(
      {
        clubId: 'sunderland-albion',
        canonicalName: 'Sunderland Albion',
        status: {
          sourceRefs: [
            {
              type: 'wikipedia-club-page',
              sourceUrl: 'https://en.wikipedia.org/wiki/Sunderland_Albion_F.C.',
            },
          ],
        },
      },
      { checkedAt: '2026-06-20T00:00:00.000Z' }
    );

    expect(candidate).toMatchObject({
      assetId: 'generated-placeholder:Generated:sunderland-albion-placeholder-crest.svg',
      kind: 'crest',
      status: 'placeholder',
      source: 'generated-placeholder',
      placeholder: true,
      mimeType: 'image/svg+xml',
      width: 256,
      height: 256,
      colors: [
        { role: 'primary', hex: '#000066' },
        { role: 'secondary', hex: '#FFFFFF' },
      ],
      license: {
        shortName: 'CC0-1.0',
        copyrighted: false,
      },
      verification: {
        identityMatch: 'generated-placeholder',
        licenseCheck: 'pass',
        httpCheck: 'pass',
        needsManualReview: false,
      },
    });
    expect(candidate.imageUrl).toMatch(/^data:image\/svg\+xml,/);
  });

  test('preserves generated placeholder status during reclassification', () => {
    const candidate = buildGeneratedPlaceholderCrestCandidate(
      {
        clubId: 'sunderland-albion',
        canonicalName: 'Sunderland Albion',
      },
      { checkedAt: '2026-06-20T00:00:00.000Z' }
    );

    const reclassified = classifyClubAssetCandidate(candidate, {
      clubId: 'sunderland-albion',
      canonicalName: 'Sunderland Albion',
    });

    expect(reclassified.status).toBe('placeholder');
    expect(reclassified.verification).toMatchObject({
      identityMatch: 'generated-placeholder',
      needsManualReview: false,
    });
  });

  test('uses generated placeholders only when no discovered candidates exist', () => {
    const placeholderBundle = addGeneratedPlaceholderFallback(
      {
        clubId: 'sunderland-albion',
        canonicalName: 'Sunderland Albion',
      },
      { status: 'needs-more-research' }
    );

    expect(placeholderBundle).toMatchObject({
      preferred: 'generated-placeholder:Generated:sunderland-albion-placeholder-crest.svg',
      status: 'placeholder',
    });
    expect(placeholderBundle.candidates[0].placeholder).toBe(true);

    const existingBundle = {
      status: 'restricted',
      candidates: [
        {
          assetId: 'existing',
          kind: 'crest',
          status: 'restricted',
          source: 'wikipedia-pageimage-any',
        },
      ],
    };
    expect(
      addGeneratedPlaceholderFallback(
        {
          clubId: 'sunderland-albion',
          canonicalName: 'Sunderland Albion',
        },
        existingBundle
      )
    ).toBe(existingBundle);
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

  test('ranks TheSportsDB badges before Wikipedia fair-use page images', () => {
    const bundle = buildClubAssetBundle([
      {
        assetId: 'wikipedia-pageimage-any:Example_FC_logo.svg',
        kind: 'crest',
        status: 'restricted',
        source: 'wikipedia-pageimage-any',
        fileTitle: 'File:Example FC logo.svg',
      },
      {
        assetId: 'thesportsdb-badge:123',
        kind: 'crest',
        status: 'restricted',
        source: 'thesportsdb-badge',
        fileTitle: 'TheSportsDB:Example FC badge',
      },
    ]);

    expect(bundle.candidates.map((candidate) => candidate.assetId)).toEqual([
      'thesportsdb-badge:123',
      'wikipedia-pageimage-any:Example_FC_logo.svg',
    ]);
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

  test('builds manual review issues for unresolved and uncertain assets', () => {
    expect(
      buildClubAssetReviewIssues('example fc', exampleClub, { status: 'needs-more-research' })
    ).toEqual([
      expect.objectContaining({
        type: 'club-asset-needs-more-research',
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
        {
          assetId: 'candidate-3',
          kind: 'crest',
          status: 'restricted',
          source: 'wikipedia-pageimage-any',
          verification: {
            reviewReasons: ['license-restricted', 'image-quality-review'],
          },
        },
      ],
    });

    expect(issues.map((issue) => issue.type).sort()).toEqual([
      'club-asset-identity-uncertain',
      'club-asset-license-restricted',
      'club-asset-license-restricted',
      'club-asset-multiple-review-candidates',
      'club-asset-non-crest-candidate',
      'club-asset-non-crest-candidate',
      'club-asset-quality-review',
    ]);
  });
});
