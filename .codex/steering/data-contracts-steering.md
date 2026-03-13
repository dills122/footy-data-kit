# Data Contracts And Source Rules

The dataset shape is contractual. Preserve stable object structures across seasons.

## Core Objects

Primary objects:

- `seasonInfo`
- `tierN`
- `metadata`

Avoid dynamically shaped objects when a stable structure is possible.

## `seasonInfo`

Expected structure:

```js
{
  season: string,
  competition: string,
  promoted: string[],
  relegated: string[],
  metadata: object
}
```

Important rule:

- `seasonInfo.promoted` and `seasonInfo.relegated` describe movement into the following season's top division

## `tierN`

Expected structure:

```js
{
  season: string,
  table: [],
  promoted: [],
  relegated: [],
  metadata: {}
}
```

Constraints:

- `season` must match the dataset season
- `table` must stay ordered by final league position
- `promoted` and `relegated` must remain semantically consistent with the rest of the pipeline
- `metadata` should keep canonical source information

## Canonical Source Identifiers

Use shared config constants instead of ad hoc strings.

Canonical identifiers:

- `wikipedia-overview`
- `wikipedia-promotion`
- `rsssf`

Reuse constants from:

- `wikipedia/config.js`
- `rsssf/config.js`

## Normalization Rules

Normalize early after parsing.

Examples:

- normalize team names
- normalize season identifiers
- convert numeric fields
- extract promotion and relegation lists into stable arrays

Do not pass raw scraped values deep into transformation or output code.

## Change Policy

Do not silently change dataset semantics.

If a change affects:

- season boundary rules
- promotion/relegation interpretation
- league tier meaning
- shared metadata fields

then add or update focused tests with the change.
