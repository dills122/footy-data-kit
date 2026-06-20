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
- `restricted` means candidates exist but the best available candidate is
  restricted, commonly Wikipedia fair use.
- `needs-review` means candidates exist but identity, license, or crest
  confidence is unclear.
- `missing` means no candidate was discovered.
- `failed` means a candidate could not be resolved.

Each candidate includes source fields such as `source`, `sourceUrl`, `imageUrl`,
`fileTitle`, `mimeType`, dimensions, license metadata, and a `verification`
object with review reasons.

## Sources

The current discovery order is:

1. Wikipedia PageImages with `pilicense=free`.
2. Wikidata `P154` logo image, resolved through Wikimedia image metadata.
3. Wikipedia PageImages with `pilicense=any`.

Restricted candidates are preserved as backups but should not be selected as
`preferred` while a usable candidate exists.

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

- `club-asset-missing`
- `club-asset-license-restricted`
- `club-asset-identity-uncertain`
- `club-asset-non-crest-candidate`
- `club-asset-url-failed`
- `club-asset-multiple-review-candidates`

Expected high-volume findings:

- Most active professional club crests from English Wikipedia are fair-use files
  and should remain `restricted`.
- Some historical clubs have no discoverable page image.
- Some free page images are photos, charts, or grounds. These should stay
  `needs-review` unless they clearly represent a crest/badge/logo.

Reviewers should promote a candidate only when both identity and license are
clear. Do not hand-edit generated output without moving the rule into generator
logic or a future curated override file.
