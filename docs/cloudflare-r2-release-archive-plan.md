# Cloudflare R2 Release Archive Plan

This plan adds a persistent archive for published data releases without changing
the current full-regeneration release model. The generated files in
`data-output/` remain the canonical build output for a release; the archive is a
durable copy of exactly what was released.

## Decision

Use Cloudflare R2 as the primary archive and manage the Cloudflare resources with
OpenTofu.

R2 is the right first storage layer because the release artifacts are small and
append-only. The current compressed payload is well below 1 MB for the main
release files:

- `all-seasons.min.json.gz`: about 234 KB
- `club-metadata.json.gz`: about 59 KB
- `wiki_overview_tables_by_season.min.json.gz`: about 234 KB

This makes object storage a better fit than a managed document database. The
archive can tolerate future data shape changes because each release is immutable
and self-described by its manifest. Add D1 or KV later only if there is a real
query/API access pattern.

Pricing references checked on 2026-06-19:

- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/
- Cloudflare D1: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare KV: https://developers.cloudflare.com/kv/platform/pricing/
- DigitalOcean Spaces: https://www.digitalocean.com/pricing/spaces-object-storage
- DigitalOcean managed databases: https://www.digitalocean.com/pricing/managed-databases

## Goals

- Archive every release's generated data files in a persistent storage layer.
- Archive only the files that are shipped as release assets.
- Keep release generation reproducible from source.
- Make archive writes idempotent and safe to rerun.
- Preserve historical shape changes without schema migrations.
- Keep storage and request costs near zero.
- Manage Cloudflare infrastructure through OpenTofu, not manual dashboard setup.

## Non-Goals

- Do not replace GitHub release assets.
- Do not replace checked-in `data-output/` files.
- Do not archive temporary build intermediates or legacy comparison files unless
  they are shipped in that release.
- Do not introduce MongoDB or another managed NoSQL database for the first
  slice.
- Do not build a public archive API until an access pattern exists.
- Do not hand-edit generated release payloads before archiving.

## Settled Decisions

- Bucket name: `footy-data-kit-archive`.
- Bucket visibility: private for now. Keep GitHub releases as the public
  distribution channel.
- Upload execution: CI post-release job with Cloudflare/R2 credentials stored as
  CI secrets. The job must be rerunnable for the same tag.
- Historical source: prefer GitHub release assets, then release branches, then
  checked-in tag files.
- Archive scope: only final files normally shipped in a release, not temporary
  or non-source-of-truth files.

## Archive Layout

Use one R2 bucket with immutable release prefixes and small mutable index files.

```text
footy-data-kit-archive/
  releases/
    v0.9.1/
      manifest.json
      all-seasons.json.gz
      all-seasons.min.json.gz
      wiki_overview_tables_by_season.json.gz
      wiki_overview_tables_by_season.min.json.gz
      club-metadata.json.gz
      release-diff.json.gz
      release-diff.md
      release-notes.md
      SHA256SUMS
  index/
    releases.json
    latest.json
  schemas/
    football-data.schema.v1.json
    club-metadata.schema.v1.json
```

Release prefixes are append-only. `index/releases.json` and `index/latest.json`
are the only mutable archive objects.

The exact file list comes from the release asset set for that tag. For example,
`wiki_promotion_relegations_by_season*` should be archived only for releases
where it is actually shipped.

## Manifest Contract

Each release gets a `manifest.json`. Presence of this file means the release was
archived successfully.

```json
{
  "tag": "v0.9.1",
  "packageVersion": "0.9.1",
  "gitSha": "2fc566d",
  "releasedAt": "2026-06-19",
  "schemaVersion": 1,
  "schemaCompatibility": "compatible",
  "archiveVersion": 1,
  "files": [
    {
      "path": "all-seasons.min.json.gz",
      "logicalName": "all-seasons.min.json",
      "contentType": "application/json",
      "contentEncoding": "gzip",
      "bytes": 234429,
      "sha256": "..."
    }
  ],
  "counts": {
    "seasons": 138
  }
}
```

The manifest should be validated by a local JSON Schema before upload.

## OpenTofu Assumptions

- Runtime: OpenTofu, version floor `>= 1.8`.
- Provider: Cloudflare provider, pinned in `infra/cloudflare/versions.tf` during
  implementation.
- State backend: still to choose. In plain terms, this is where OpenTofu stores
  the record of the Cloudflare resources it manages. Local state is acceptable
  only for a one-person bootstrap; shared/CI usage needs a remote backend with
  locking and backup.
- Execution path: CI post-release upload for archive objects. OpenTofu
  plan/apply can start local, but CI validation should exist before the archive
  becomes part of the required release process.
- Environment criticality: low blast radius. The archive is additive, but bucket
  deletion or object overwrite would damage release history.

Risk categories addressed:

- Secret exposure: Cloudflare API tokens and R2 credentials must come from
  environment variables or CI secrets, never `.tfvars` or committed files.
- State corruption: use remote state with locking before shared usage.
- CI drift: pin OpenTofu and provider versions, and require a reviewed plan
  artifact before apply.
- Blast radius: manage only the archive bucket and optional service tokens in the
  first infra composition.

## Infrastructure Slice

Add an `infra/cloudflare/` composition:

```text
infra/
  cloudflare/
    README.md
    main.tf
    variables.tf
    outputs.tf
    versions.tf
    backend.tf.example
```

Resources:

- Private R2 bucket named `footy-data-kit-archive` for archive objects.
- Optional lifecycle/versioning controls if supported by the selected provider.
- Outputs for bucket name and account id.

Secrets:

- `CLOUDFLARE_API_TOKEN` for OpenTofu provider authentication.
- R2 S3-compatible upload credentials for release scripts, stored as local env
  vars or CI secrets.

Do not manage long-lived secret values directly in OpenTofu state. If Cloudflare
credentials need to be created later, prefer a documented manual bootstrap or CI
secret injection path over writing secret material to state.

Validation:

```bash
tofu fmt -check -recursive infra
tofu -chdir=infra/cloudflare init -backend=false
tofu -chdir=infra/cloudflare validate
tofu -chdir=infra/cloudflare plan -out=tfplan
```

Apply rule:

- Never apply directly without reviewing the `tfplan` output.
- Never destroy the bucket without a separate `tofu plan -destroy` review and an
  explicit backup of all objects.

## Release Automation Slice

Add archive scripts that run from CI as a post-release step after the existing
verification/minification/release publication steps.

Target package scripts:

```json
{
  "archive:manifest": "node scripts/build-archive-manifest.js",
  "archive:release": "node scripts/archive-release.js",
  "archive:release:dry-run": "node scripts/archive-release.js --dry-run"
}
```

Expected command:

```bash
pnpm -s archive:release --tag v0.9.1
```

Archive flow:

1. Read `package.json`, `docs/release-notes/releases.json`, generated release
   files, and git metadata.
2. Resolve the shipped release asset set for the tag.
3. Build gzip payloads in a temp directory.
4. Compute SHA-256 and byte size for every payload.
5. Validate `manifest.json` against `schemas/archive-manifest.schema.json`.
6. Check whether `releases/<tag>/manifest.json` already exists.
7. Refuse overwrite if the remote manifest exists with different checksums.
8. Accept reruns when the remote manifest and checksums already match.
9. Upload data files and `SHA256SUMS`.
10. Upload `manifest.json` last.
11. Update `index/releases.json` and `index/latest.json`.

Environment variables:

```text
FOOTY_ARCHIVE_R2_ACCOUNT_ID
FOOTY_ARCHIVE_R2_BUCKET
FOOTY_ARCHIVE_R2_ACCESS_KEY_ID
FOOTY_ARCHIVE_R2_SECRET_ACCESS_KEY
```

Use the S3-compatible R2 API for uploads so the release script can stay simple
and independent of OpenTofu.

## Backfill Slice

Backfill historical releases into the same archive layout.

Known tags currently listed locally:

- `v0.5.0`
- `v0.6.0`
- `v0.6.1`
- `v0.7.0`
- `v0.8.0`
- `v0.8.1`
- `v0.8.2`
- `v0.9.0`
- `v0.9.1`

Backfill order:

1. Prefer existing GitHub release assets, because they are what consumers could
   actually download.
2. If assets are unavailable, use the release branch if it exists.
3. If neither is available, use a git worktree checked out at the tag and archive
   the checked-in generated files.
4. Mark missing old artifacts in the manifest instead of regenerating them from
   current sources.
5. Upload older manifests before current release indexes are treated as complete.

Do not regenerate old releases from current Wikipedia sources for archival
truth. Regeneration is useful for current releases; archival backfill should
capture what was released.

## Implementation Tasks

### Task 1: Archive Manifest Contract

Description: Add the archive manifest schema and a local manifest builder that
can describe a release without contacting Cloudflare.

Acceptance criteria:

- `schemas/archive-manifest.schema.json` defines the manifest contract.
- `scripts/build-archive-manifest.js` emits deterministic JSON for a supplied
  tag and file list.
- Manifest generation includes file sizes, SHA-256 hashes, release metadata, and
  season counts.

Verification:

- `pnpm test -- build-archive-manifest`
- `pnpm -s schema:verify` if schema verification is extended to the archive
  manifest.
- Manual check: generated manifest for `v0.9.1` matches current release files.

Dependencies: None.

Estimated scope: Medium.

### Task 2: OpenTofu Cloudflare Composition

Description: Add the initial `infra/cloudflare/` composition for the R2 archive
bucket and document bootstrap/state setup.

Acceptance criteria:

- OpenTofu files are formatted and validate with provider credentials available.
- Cloudflare provider version and OpenTofu version are pinned.
- README documents required env vars, backend setup, plan/apply flow, and
  rollback precautions.
- README explains the selected state backend and why local state is not used for
  shared/CI applies.
- No secrets or secret defaults are committed.

Verification:

- `tofu fmt -check -recursive infra`
- `tofu -chdir=infra/cloudflare init -backend=false`
- `tofu -chdir=infra/cloudflare validate`
- `tofu -chdir=infra/cloudflare plan -out=tfplan`

Dependencies: None.

Estimated scope: Small.

### Task 3: R2 Upload Script

Description: Add an idempotent release archive uploader using the R2
S3-compatible API.

Acceptance criteria:

- `pnpm -s archive:release:dry-run --tag vX.Y.Z` shows planned objects without
  network writes.
- `pnpm -s archive:release --tag vX.Y.Z` uploads payload files first and
  `manifest.json` last.
- Only shipped release assets are archived for the tag.
- Existing matching remote manifests are accepted.
- Existing mismatched remote manifests fail closed.
- Index files are updated only after the release manifest exists remotely.

Verification:

- Focused Jest tests mock R2 client behavior.
- Dry run works against current `data-output/`.
- Real upload is manually verified in a non-production bucket before first
  production archive.

Dependencies: Task 1.

Estimated scope: Medium.

### Task 4: Release Workflow Integration

Description: Wire archive publishing into CI as a rerunnable post-release step.

Acceptance criteria:

- README release workflow includes archive publishing.
- `release:check` remains local-only and does not require Cloudflare secrets.
- The release checklist states that archive upload requires verified/minified
  data, release notes, and a published release tag.
- The CI job can be rerun safely for an already archived tag.
- Failure to archive marks post-release archival as failed without mutating the
  release payload.

Verification:

- `pnpm -s release:check`
- `pnpm -s archive:release:dry-run --tag <current-tag>`
- CI workflow dry run or mocked upload job.

Dependencies: Tasks 1 and 3.

Estimated scope: Small.

### Task 5: Historical Backfill

Description: Archive existing release tags into R2 and build the first complete
`index/releases.json`.

Acceptance criteria:

- Every known release tag has a `releases/<tag>/manifest.json`.
- Manifests identify whether files came from GitHub assets or checked-in tag
  files.
- Manifests include only the files shipped for that release.
- Missing old artifacts are recorded explicitly.
- `index/releases.json` lists releases in descending semver/date order.
- `index/latest.json` points to the latest stable data release.

Verification:

- `pnpm -s archive:release:dry-run --tag <tag>` for every historical tag.
- Real backfill upload into R2.
- Download and checksum verification for a sample of old and current releases.

Dependencies: Tasks 2 and 3.

Estimated scope: Medium.

## Checkpoints

Foundation checkpoint after Tasks 1 and 2:

- Manifest generation is local and tested.
- R2 bucket infrastructure can be planned safely.
- No release workflow depends on Cloudflare yet.

Archive checkpoint after Tasks 3 and 4:

- Current release can be archived idempotently.
- Dry-run mode is usable in local release review.
- Docs explain how to publish and verify the archive.

Backfill checkpoint after Task 5:

- Historical releases are present in R2.
- Index files represent the complete archived history.
- Sample downloads match stored checksums.

## Rollback Notes

Archive uploads are append-only. If an upload fails before `manifest.json`, delete
the partial `releases/<tag>/` objects and rerun.

If `manifest.json` exists and checksums are wrong, do not overwrite in place.
Instead:

1. Download all remote objects for evidence.
2. Compare against local release artifacts and GitHub assets.
3. Decide whether to create a corrected manifest version or manually remove the
   bad release prefix after backup.

For OpenTofu changes, rollback means applying a reviewed prior plan or restoring
the previous commit's infra configuration. Bucket deletion is destructive and
must not be part of normal rollback.

## Open Questions

- Which remote backend should hold OpenTofu state once CI/shared applies exist:
  Terraform Cloud, an existing S3-compatible state bucket, or another managed
  backend?
- Should a custom read-only archive domain be added after backfill, or should
  GitHub releases remain the only public download surface?
