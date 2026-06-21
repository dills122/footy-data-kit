# Club Asset Metadata

Club assets are optional metadata on `data/club-metadata.json` records. The first
supported asset kind is `assets.crest`; the shape is intentionally generic so
future asset kinds can reuse the same bundle and candidate model.

The asset pipeline stores image URLs and provenance only. It does not download
or commit image binaries.

## Contract

Each club can expose:

```json
{
  "assets": {
    "crest": {
      "preferred": "wikipedia-pageimage-free:Example_FC_crest.svg",
      "status": "usable",
      "candidates": []
    }
  }
}
```

`assets.crest.status` summarizes the candidate set:

- `usable` means at least one preferred candidate has an acceptable license and
  looks like a crest, badge, logo, shield, or emblem.
- `placeholder` means the preferred candidate is a generated shield based on
  curated/source-backed club colours. It is safe to render, but is not an
  official or historical club crest. Placeholder candidate notes may include
  `researchStatus: researched-no-source`, meaning targeted research found
  colors or identity context but no usable crest source.
- `restricted` means candidates exist but the best available candidate is
  restricted, commonly Wikipedia fair use.
- `needs-review` means candidates exist but identity, license, or crest
  confidence is unclear.
- `needs-more-research` means no acceptable candidate is available yet. These
  clubs need color/source research before a generated placeholder can be added.
- `failed` means a candidate could not be resolved.

Each candidate includes source fields such as `source`, `sourceUrl`, `imageUrl`,
`fileTitle`, `mimeType`, dimensions, license metadata, optional structured
`colors`, a `placeholder` flag for generated shields, and a `verification`
object with review reasons.

Recommended consumer filters:

- Use `status: usable` when you only want source-discovered assets with a
  passing license check.
- Include `status: placeholder` when generated fallback crests are acceptable.
  These are intentionally simple shields, not claims about official artwork.
- Include `status: restricted` only when your app or service can handle club
  mark licensing and trademark restrictions. These records are retained as
  useful links and mirrors, not as blanket permission to redistribute artwork.
- Treat `needs-review`, `needs-more-research`, and `failed` as non-display
  states unless your product has its own manual review flow.

## Sources

The current discovery order is:

1. Wikipedia PageImages with `pilicense=free`.
2. Wikidata media properties, resolved through Wikimedia image metadata:
   - `P154` logo image
   - `P94` coat of arms image
   - `P18` image
3. TheSportsDB team artwork from the public API:
   - `strBadge`
   - `strLogo`
   - `strColour1`/`strColour2`/`strColour3` when valid hex values are present
4. Wikipedia PageImages with `pilicense=any`.
5. Curated candidates from official club sites or Wikimedia files when targeted
   review finds a reliable image that automated discovery missed.
6. Generated placeholder shields for curated missing clubs with
   source-backed colours.

Restricted candidates are preserved as backups but should not be selected as
`preferred` while a usable candidate exists.

Current source identifiers:

- `wikipedia-pageimage-free`
- `wikidata-logo`
- `wikidata-coat-of-arms`
- `wikidata-image`
- `thesportsdb-badge`
- `thesportsdb-logo`
- `wikipedia-pageimage-any`
- `official-site-logo`
- `curated-wikimedia-logo`
- `generated-placeholder`

Wikidata `P154` and `P94` candidates are treated as crest-like when they match
the club identity. Generic `P18` image candidates still need filename or other
crest evidence, because they often point to squads, grounds, or match photos.

TheSportsDB candidates are kept as restricted backup artwork because club marks
may be copyrighted or trademarked. Matching is intentionally strict: exact
team-name/alias matches can become crest candidates, while successor or
current-club partial matches remain under identity review.

Curated official-site candidates are also kept as restricted backup artwork.
They are useful for consumers that can handle club-mark licensing themselves,
but they are not selected as preferred while a usable or generated placeholder
candidate exists.

Curated Wikimedia candidates are used when targeted review finds a reliable
Wikimedia file that automated PageImages/Wikidata discovery missed. They still
carry source and license metadata and flow through the same ranking and review
model as other candidates.

Generated placeholders are SVG data URLs. They use `source: generated-placeholder`, `status: placeholder`, `placeholder: true`, and CC0
license metadata so consumers can render or filter them independently from
official/source-discovered crest candidates. The `researched-no-source` note is
the curated label for clubs where we looked for a real crest source and found
only enough source-backed colour information to build a placeholder.

## Running Discovery

Use the standalone command so normal club metadata generation stays
deterministic unless assets are explicitly refreshed:

```bash
pnpm -s wiki:club-assets
```

For full runs, prefer a cache and conservative delay:

```bash
node wikipedia/data/generate-club-assets.js ./data/club-metadata.json \
  --output ./data/club-metadata.json \
  --review-output ./data/club-assets-review.json \
  --cache ./data/club-assets-cache.json \
  --request-delay-ms 750
```

The cache is a resumable working artifact. Commit it only if we decide to make
asset-discovery state part of the published workflow; otherwise use a temporary
path during research.

Useful smoke options:

```bash
# Process only the first 50 clubs
node wikipedia/data/generate-club-assets.js ./data/club-metadata.json \
  --output /private/tmp/club-assets-sample.json \
  --review-output /private/tmp/club-assets-review-sample.json \
  --cache /private/tmp/club-assets-cache.json \
  --club-limit 50 \
  --request-delay-ms 500

# Ignore cache entries and refresh source lookups
node wikipedia/data/generate-club-assets.js ./data/club-metadata.json \
  --output /private/tmp/club-assets-refresh.json \
  --review-output /private/tmp/club-assets-review-refresh.json \
  --cache /private/tmp/club-assets-cache.json \
  --refresh-assets
```

## Manual Review

The review output reports issue types:

- `club-asset-needs-more-research`
- `club-asset-license-restricted`
- `club-asset-identity-uncertain`
- `club-asset-non-crest-candidate`
- `club-asset-quality-review`
- `club-asset-url-failed`
- `club-asset-multiple-review-candidates`

Expected high-volume findings:

- Most active professional club crests from English Wikipedia are fair-use files
  and should remain `restricted`.
- Some historical clubs have no discoverable page image.
- Some free page images are photos, charts, or grounds. These should stay
  `needs-review` unless they clearly represent a crest/badge/logo.
- Some crest-like candidates are correct but hard to read because of low image
  quality or transparent-background visibility. These stay available as
  candidates, but receive `club-asset-quality-review` so a better source can be
  found.
- Some Victorian or folded clubs may be curated as `researched-no-source` after
  targeted review finds source-backed colours but no usable crest source. Do
  not infer that automatically from a `needs-more-research` automated result.
- Generated placeholders should only be added from curated colors and should
  remain visibly simple. They are a fallback for consumers, not evidence that an
  official crest existed.

Reviewers should promote a candidate only when both identity and license are
clear. Do not hand-edit generated output without moving the rule into generator
logic or a future curated override file.

As of the current crest-audit branch, the expected non-license review baseline
is intentionally small:

- `Hounslow` remains the only `club-asset-needs-more-research` club.
- `Bridgend Town`, `Bromsgrove Rovers`, and `Solihull Borough` remain
  `club-asset-quality-review` because the known candidates look club-related
  but need better-quality replacements.
- `club-asset-identity-uncertain`, `club-asset-non-crest-candidate`, and
  `club-asset-multiple-review-candidates` should be zero. If they reappear,
  either reject the bad candidate, add a scoped rejection for a successor-club
  mismatch, or curate the identity in generator logic.

## Release Checklist

Before merging or tagging an asset refresh:

1. Regenerate assets through `wikipedia/data/generate-club-assets.js`; do not
   patch `data/club-metadata.json` or `data/club-assets-review.json` directly.
2. Review the non-license issue buckets in `data/club-assets-review.json`.
3. Confirm restricted-license volume is expected for club marks.
4. Run focused asset tests plus schema, formatting, docs, and lint checks.
5. Mention any remaining non-license review items in release notes.
