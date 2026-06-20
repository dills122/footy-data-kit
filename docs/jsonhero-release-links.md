# JSON Hero Release Link Notes

These notes capture the JSON Hero handoff findings for a future release-process
slice. Do not treat JSON Hero links as required release assets yet; the hosted
service is third-party infrastructure and should stay optional until we decide
otherwise.

## Goal

Provide a convenient hosted JSON explorer link for each published data release.
The link should let users inspect the full release JSON in JSON Hero without
having to paste a URL manually.

## Working Manual Flow

Using JSON Hero's web UI with a GitHub release asset URL works for the full data
file, though it can take a while to load and index.

Release asset URL shape:

```text
https://github.com/dills122/footy-data-kit/releases/download/v1.0.0/all-seasons.min.json
```

JSON Hero create-from-URL route shape:

```text
https://jsonhero.io/actions/createFromUrl?jsonUrl=<encoded-release-asset-url>&utm_source=footy-data-kit
```

Example:

```text
https://jsonhero.io/actions/createFromUrl?jsonUrl=https%3A%2F%2Fgithub.com%2Fdills122%2Ffooty-data-kit%2Freleases%2Fdownload%2Fv1.0.0%2Fall-seasons.min.json&utm_source=footy-data-kit
```

This route redirects to a generated document URL:

```text
https://jsonhero.io/j/<generated-id>
```

That generated `/j/<generated-id>` URL is the value we would store with release
metadata if we automate this.

## Important Behavior

- JSON Hero's `/actions/createFromUrl?jsonUrl=...` path matches the hosted UI's
  URL submission flow better than `/new?url=...`.
- For release links, prefer GitHub release asset URLs over raw GitHub tag URLs
  because that is the flow confirmed manually in the hosted UI.
- Reusing a generated `/j/<generated-id>` link avoids creating a new JSON Hero
  document on every click.
- Reusing the generated link may not eliminate all load time. JSON Hero still has
  to render and index a large nested JSON document in the browser.
- JSON Hero has an undocumented `injest=true` option in source that stores fetched
  content as raw JSON at document creation time. Do not use it by default; it
  stores public release content in JSON Hero and relies more heavily on the
  hosted service.
- JSON Hero is desktop-oriented and is not a replacement for an in-site explorer.

## Proposed Release Automation Slice

Add an optional script:

```text
scripts/create-jsonhero-release-links.js --tag v1.0.0
```

Expected behavior:

1. Resolve the release asset URL for `all-seasons.min.json`.
2. Call JSON Hero's create-from-URL route.
3. Follow redirects.
4. Capture the final `https://jsonhero.io/j/<generated-id>` URL.
5. Print the URL and optionally update release metadata when explicitly asked.

Possible command shape:

```bash
JSON_URL="https://github.com/dills122/footy-data-kit/releases/download/v1.0.0/all-seasons.min.json"

curl -sS -I -L -o /dev/null -w '%{url_effective}\n' \
  "https://jsonhero.io/actions/createFromUrl?jsonUrl=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$JSON_URL")&utm_source=footy-data-kit"
```

## Metadata Shape

Add an optional field to release entries:

```json
{
  "tag": "v1.0.0",
  "jsonHeroUrl": "https://jsonhero.io/j/<generated-id>"
}
```

Docs should prefer `jsonHeroUrl` when present. If it is absent, docs can either
omit the JSON Hero link or fall back to the create-from-URL route.

## Open Decisions

- Whether JSON Hero link creation should be manual, optional automation, or part
  of the release checklist.
- Whether generated JSON Hero URLs should be committed to
  `docs/release-notes/releases.json` or a separate site manifest.
- Whether to create links only for `all-seasons.min.json` or also for focused
  assets such as `club-metadata.json`.
- Whether failed JSON Hero link creation should warn only or fail a release. The
  safe default is warn only.

## Started Release Flow

The release workflow should keep these responsibilities separated:

1. Build, verify, and upload immutable release data assets.
2. Generate `explorer-links.json` from the published release asset URLs.
3. Upload `explorer-links.json` back to the GitHub release.
4. Dispatch the docs-site workflow on `main` with `release_tag=<tag>`.
5. The docs workflow downloads release assets and publishes
   `docs/explorer-links.json` with the static site when that metadata exists.

The docs-site workflow should not deploy GitHub Pages directly from a tag
workflow run. GitHub Pages environment protection can reject tag refs even when
the release itself is valid. Dispatching the docs workflow on `main` keeps Pages
deployment aligned with the protected environment while still rendering the site
against the selected release tag.

`explorer-links.json` is intentionally optional for now. If JSON Hero is slow or
unavailable, the release workflow writes fallback metadata with the
create-from-URL link instead of failing the release. Docs can prefer the stored `/j/<id>` URL
when present and fall back to the create route when it is missing.
